const OverpassAdapter = require('./overpassAdapter');
const PlacesAdapter = require('./placesAdapter');
const ORSAdapter = require('./orsAdapter');
const { cache } = require('../middleware/cache');

/**
 * TravelService Facade (Facade + Strategy patterns)
 * 
 * Single interface encapsulating dual-API POI strategy and route optimization.
 * - Overpass (primary, free unlimited) for POI search
 * - Google Places (enrichment, quota-sensitive) for details/photos/ratings
 * - ORS for route optimization (2,000 req/day)
 * 
 * Implements graceful degradation (NFR-08): if Google Places is unavailable,
 * falls back to Overpass-only results.
 */
class TravelService {
    constructor() {
        this.overpass = new OverpassAdapter();
        this.places = new PlacesAdapter(process.env.GOOGLE_PLACES_API_KEY);
        this.ors = new ORSAdapter(process.env.ORS_API_KEY);
    }

    /**
     * Search POIs - uses Overpass as primary, enriches with Google Places
     * Implements cache-aside pattern for quota protection
     */
    async searchPOI(query, lat, lng, radius = 5000) {
        const cacheKey = `poi:${query}:${lat}:${lng}:${radius}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`POI cache hit: ${cacheKey}`);
            return cached;
        }

        console.log(`POI search: query="${query}" lat=${lat} lng=${lng} radius=${radius}`);

        // Run Overpass and Google Places in parallel to avoid sequential timeout stacking
        const [overpassResults, placesResults] = await Promise.all([
            this.overpass.searchPOI(query, lat, lng, radius).catch(err => {
                console.warn('Overpass failed:', err.message);
                return [];
            }),
            this.places.apiKey
                ? this.places.searchPOI(query, lat, lng, radius).catch(err => {
                    console.warn('Google Places failed:', err.message);
                    return [];
                })
                : Promise.resolve([]),
        ]);
        console.log("Ma ka bhosda aag : ", overpassResults, placesResults);
        console.log(`POI results: overpass=${overpassResults.length}, places=${placesResults.length}`);

        let results = placesResults.length > 0
            ? this._mergeResults(overpassResults, placesResults)
            : overpassResults;

        cache.set(cacheKey, results, 1800); // Cache for 30 minutes
        return results;
    }

    /**
     * Search by category — Overpass + Google Places in parallel
     */
    async searchByCategory(category, lat, lng, radius = 5000) {
        const cacheKey = `cat:${category}:${lat}:${lng}:${radius}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`Category cache hit: ${cacheKey}`);
            return cached;
        }

        console.log(`Category search: "${category}" lat=${lat} lng=${lng} radius=${radius}`);

        const [overpassResults, placesResults] = await Promise.all([
            this.overpass.searchByCategory(category, lat, lng, radius).catch(err => {
                console.warn('Overpass category failed:', err.message);
                return [];
            }),
            this.places.apiKey
                ? this.places.searchPOI(category, lat, lng, radius).catch(err => {
                    console.warn('Google Places category fallback failed:', err.message);
                    return [];
                })
                : Promise.resolve([]),
        ]);

        console.log(`Category results: overpass=${overpassResults.length}, places=${placesResults.length}`);

        let results = placesResults.length > 0
            ? this._mergeResults(overpassResults, placesResults)
            : overpassResults;

        cache.set(cacheKey, results, 1800);
        return results;
    }

    /**
     * Get detailed place info from Google Places
     */
    async getPlaceDetails(placeId) {
        const cacheKey = `details:${placeId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        try {
            const details = await this.places.getPlaceDetails(placeId);
            if (details) {
                cache.set(cacheKey, details, 86400); // Cache for 24 hours
            }
            return details;
        } catch (error) {
            console.warn('Could not fetch place details:', error.message);
            return null;
        }
    }

    /**
     * Get optimized multi-stop route via ORS
     */
    async getRoute(coordinates, profile = 'driving-car') {
        if (!coordinates || coordinates.length < 2) {
            return { error: 'At least 2 coordinates required' };
        }

        const cacheKey = `route:${JSON.stringify(coordinates)}:${profile}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const route = await this.ors.getRoute(coordinates, profile);
        if (route) {
            cache.set(cacheKey, route, 3600); // Cache for 1 hour
        }
        return route;
    }

    /**
     * Optimize route order for multiple stops
     */
    async optimizeRoute(coordinates, profile = 'driving-car') {
        if (!coordinates || coordinates.length < 3) {
            return this.getRoute(coordinates, profile);
        }

        const route = await this.ors.optimizeRoute(coordinates, profile);
        return route;
    }

    /**
     * Merge Overpass and Google Places results
     * Google Places results take priority when matching by proximity
     */
    _mergeResults(overpassResults, placesResults) {
        const merged = [...placesResults];
        const placesCoords = new Set(
            placesResults.map(p => `${p.lat?.toFixed(4)},${p.lng?.toFixed(4)}`)
        );

        for (const osm of overpassResults) {
            const coordKey = `${osm.lat?.toFixed(4)},${osm.lng?.toFixed(4)}`;
            if (!placesCoords.has(coordKey)) {
                merged.push(osm);
            }
        }

        return merged.slice(0, 50); // Limit results
    }
}

// Singleton pattern: single instance of TravelService
let instance = null;

const getTravelService = () => {
    if (!instance) {
        instance = new TravelService();
    }
    return instance;
};

module.exports = { TravelService, getTravelService };
