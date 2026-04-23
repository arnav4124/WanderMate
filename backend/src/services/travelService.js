const axios = require("axios");
// const OverpassAdapter = require('./overpassAdapter');
const PlacesAdapter = require('./placesAdapter');
const ORSAdapter = require('./orsAdapter');
const { cache } = require('../middleware/cache');

/**
 * TravelService Facade (Facade + Strategy patterns)
 * 
 * Single interface encapsulating dual-API POI strategy and route optimization.
 * - ORS Adapter (primary) for POI search / routing
 * - Google Places (enrichment, quota-sensitive) ONLY used for details/photos/ratings
 */
class TravelService {
    constructor() {
        this.places = new PlacesAdapter(process.env.GOOGLE_PLACES_API_KEY);
        this.ors = new ORSAdapter(process.env.ORS_API_KEY);
    }

    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }

    /**
     * Search POIs - uses Google Places to fetch photos and ratings, falls back to ORS
     */
    async geocode(query) {
        try {
            console.log(`[Geocode] Attempting Nominatim for "${query}"...`);
            const response = await axios.get("https://nominatim.openstreetmap.org/search", {
                params: { q: query, format: "json", limit: 5 },
                headers: { "User-Agent": "WanderMate/1.0" },
                timeout: 5000 // Short timeout to fail fast
            });
            
            if (response.data && response.data.length > 0) {
                return response.data.map(item => ({
                    name: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon)
                }));
            }
            throw new Error("Empty Nominatim result");
        } catch (error) {
            console.warn(`[Geocode] Nominatim failed or empty (${error.message}). Falling back to Google Places...`);
            try {
                // Fallback to Google Places Text Search (without location bias)
                const fallbackResults = await this.places.searchPOI(query, null, null, null);
                if (fallbackResults && fallbackResults.length > 0) {
                    return fallbackResults.map(item => ({
                        name: item.name,
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lng)
                    }));
                }
                return [];
            } catch (fallbackError) {
                console.error("[Geocode] Both geocoders failed:", fallbackError.message);
                return [];
            }
        }
    }

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

        let results = await this.places.searchPOI(query, lat, lng, radius).catch(err => {
            console.warn('Google Places POI failed:', err.message);
            return [];
        });

        if (!results || results.length === 0) {
            console.log('Falling back to ORS for POI search');
            results = await this.ors.searchPOI(query, lat, lng, radius).catch(err => {
                console.warn('ORS POI failed:', err.message);
                return [];
            });
        }
        
        // Calculate distances and sort
        if (results && results.length > 0) {
            results = results.map(r => ({
                ...r,
                distance: r.distance !== undefined ? r.distance : this._calculateDistance(lat, lng, r.lat, r.lng)
            }));
            results.sort((a, b) => a.distance - b.distance);
            
            // Apply threshold to limit results length to ensure relevancy
            results = results.slice(0, 15);
        }

        console.log(`POI results: Returned ${results.length} items`);
        
        cache.set(cacheKey, results, 1800); // Cache for 30 minutes
        return results;
    }

    /**
     * Search by category — uses Google Places to fetch photos and ratings, falls back to ORS
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

        let results = await this.places.searchByCategory(category, lat, lng, radius).catch(err => {
            console.warn('Google Places category failed:', err.message);
            return [];
        });

        if (!results || results.length === 0) {
            console.log('Falling back to ORS for category search');
            results = await this.ors.searchByCategory(category, lat, lng, radius).catch(err => {
                console.warn('ORS category failed:', err.message);
                return [];
            });
        }

        // Calculate distance, sort, and threshold
        if (results && results.length > 0) {
            results = results.map(r => ({
                ...r,
                category, // Enforce the requested category
                distance: r.distance !== undefined ? r.distance : this._calculateDistance(lat, lng, r.lat, r.lng)
            }));
            results.sort((a, b) => a.distance - b.distance);
            results = results.slice(0, 20); // Top 20 for category
        }

        console.log(`Category results: Returned ${results.length} items`);

        cache.set(cacheKey, results, 1800);
        return results;
    }

    /**
     * Get detailed place info using Google Places matching
     */
    async getPlaceDetails(placeId, name = null, lat = null, lng = null) {
        const cacheKey = `details:${placeId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        try {
            let details = null;
            if (placeId.startsWith('ors_') && name && lat && lng) {
                // To get Google photos/reviews for an ORS place, we must "find" it in Places first
                details = await this.places.findPlaceAndGetDetails(name, lat, lng);
            } else {
                // If it is already a Google ID
                details = await this.places.getPlaceDetails(placeId);
            }

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
