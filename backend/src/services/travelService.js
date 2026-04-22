// const OverpassAdapter = require('./overpassAdapter');
const PlacesAdapter = require('./placesAdapter');
const ORSAdapter = require('./orsAdapter');
const { cache } = require('../middleware/cache');

/**
 * TravelService Facade (Facade + Strategy patterns)
 * 
 * Single interface encapsulating dual-API POI strategy and route optimization.
 * - ORS Adapter (primary) for POI search / routing
 * - Google Places (enrichment, quota-sensitive) for details/photos/ratings
 * 
 * Implements graceful degradation (NFR-08): if Google Places is unavailable,
 * falls back to ORS-only results.
 */
class TravelService {
    constructor() {
        // this.overpass = new OverpassAdapter(); // Commented out overpass stuff
        this.places = new PlacesAdapter(process.env.GOOGLE_PLACES_API_KEY);
        this.ors = new ORSAdapter(process.env.ORS_API_KEY);
    }

    /**
     * Search POIs - uses ORS as primary, enriches with Google Places
     * Implements cache-aside pattern for quota protection
     */
    async searchPOI(query, lat, lng, radius = 5000, ignoreCache = false) {
        const cacheKey = `poi:${query}:${lat}:${lng}:${radius}`;
        if (!ignoreCache) {
            const cached = cache.get(cacheKey);
            if (cached) {
                console.log(`POI cache hit: ${cacheKey}`);
                return cached;
            }
        }

        console.log(`POI search: query="${query}" lat=${lat} lng=${lng} radius=${radius} ignoreCache=${ignoreCache}`);

        // Run ORS and Google Places in parallel to avoid sequential timeout stacking
        const [primaryResults, placesResults] = await Promise.all([
            this.ors.searchPOI(query, lat, lng, radius).catch(err => {
                console.warn('ORS POI failed:', err.message);
                return [];
            }),
            this.places.apiKey
                ? this.places.searchPOI(query, lat, lng, radius).catch(err => {
                    console.warn('Google Places failed:', err.message);
                    return [];
                })
                : Promise.resolve([]),
        ]);
        
        console.log(`POI results: primary=${primaryResults.length}, places=${placesResults.length}`);

        let results = placesResults.length > 0
            ? this._mergeResults(primaryResults, placesResults)
            : primaryResults;

        cache.set(cacheKey, results, 1800); // Cache for 30 minutes
        return results;
    }

    /**
     * Search by category — ORS + Google Places in parallel
     */
    async searchByCategory(category, lat, lng, radius = 5000, ignoreCache = false) {
        const cacheKey = `cat:${category}:${lat}:${lng}:${radius}`;
        if (!ignoreCache) {
            const cached = cache.get(cacheKey);
            if (cached) {
                console.log(`Category cache hit: ${cacheKey}`);
                return cached;
            }
        }

        console.log(`Category search: "${category}" lat=${lat} lng=${lng} radius=${radius} ignoreCache=${ignoreCache}`);

        const [primaryResults, placesResults] = await Promise.all([
            this.ors.searchByCategory(category, lat, lng, radius).catch(err => {
                console.warn('ORS category failed:', err.message);
                return [];
            }),
            this.places.apiKey
                ? this.places.searchByCategory(category, lat, lng, radius).catch(err => {
                    console.warn('Google Places category fallback failed:', err.message);
                    return [];
                })
                : Promise.resolve([]),
        ]);

        console.log(`Category results: primary=${primaryResults.length}, places=${placesResults.length}`);

        let results = placesResults.length > 0
            ? this._mergeResults(primaryResults, placesResults)
            : primaryResults;

        // Enforce the requested category so the UI displays the correct icon/color
        // even if the place has multiple tags (e.g. both lodging and restaurant)
        results = results.map(r => ({ ...r, category }));

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
     * Merge primary (ORS) and Google Places results
     * Google Places results take priority when matching by proximity
     */
    _mergeResults(primaryResults, placesResults) {
        const merged = [...placesResults];
        const placesCoords = new Set(
            placesResults.map(p => `${p.lat?.toFixed(4)},${p.lng?.toFixed(4)}`)
        );

        for (const osm of primaryResults) {
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
