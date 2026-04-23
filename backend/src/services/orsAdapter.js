const axios = require('axios');

/**
 * OpenRouteService Adapter - Strategy pattern implementation
 * Provides multi-stop route optimization
 * Quota: 2,000 requests/day on free tier
 */
class ORSAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openrouteservice.org';
    }

    async searchPOI(query, lat, lng, radius = 5000) {
        try {
            // ORS restricts buffer to max 2000 meters
            const safeRadius = Math.min(radius, 2000);
            const response = await axios.post(
                `${this.baseUrl}/pois`,
                {
                    request: 'pois',
                    geometry: {
                        geojson: {
                            type: 'Point',
                            coordinates: [lng, lat],
                        },
                        buffer: safeRadius,
                    },
                    limit: 50,
                },
                {
                    headers: {
                        Authorization: this.apiKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            // Filter results by name if a query is provided
            let features = response.data.features || [];
            if (query) {
                const lowerQuery = query.toLowerCase();
                features = features.filter((f) => {
                    const name = f.properties?.osm_tags?.name || '';
                    return name.toLowerCase().includes(lowerQuery);
                });
            }

            return features.slice(0, 50).map((f) => this._normalizePOI(f));
        } catch (error) {
            console.error('ORS POI search error:', error.message);
            return [];
        }
    }

    async searchByCategory(category, lat, lng, radius = 5000) {
        // ORS category group mapping
        // https://openrouteservice.org/dev/#/api-docs/pois/category_list
        const categoryMap = {
            hotel: [100], // accommodation
            restaurant: [560], // sustenance (eat and drink) - includes cafe, fast food
            landmark: [130, 220, 330, 620], // arts_and_culture, historic, natural, tourism
            activity: [260], // leisure_and_entertainment
            shopping: [500], // shopping
            transport: [600], // transport
            museum: [130], // arts_and_culture
            park: [330], // natural
            nightlife: [260, 560], // leisure(club) or sustenance(bar/pub)
            medical: [460], // healthcare
            grocery: [500], // shopping (supermarket inside)
            finance: [430] // financial
        };

        const categoryGroupIds = categoryMap[category] || [620]; // default: tourism
        // ORS restricts buffer to max 2000 meters
        const safeRadius = Math.min(radius, 2000);

        try {
            const response = await axios.post(
                `${this.baseUrl}/pois`,
                {
                    request: 'pois',
                    geometry: {
                        geojson: {
                            type: 'Point',
                            coordinates: [lng, lat],
                        },
                        buffer: safeRadius,
                    },
                    limit: 50,
                    filters: {
                        category_group_ids: categoryGroupIds,
                    },
                },
                {
                    headers: {
                        Authorization: this.apiKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            const features = response.data.features || [];
            return features.slice(0, 50).map((f) => this._normalizePOI(f));
        } catch (error) {
            console.error('ORS POI category search error:', error.message);
            return [];
        }
    }

    _normalizePOI(feature) {
        const props = feature.properties || {};
        const tags = props.osm_tags || {};
        
        let name = tags.name || tags['name:en'];
        // Ignore "Unknown Place" noise for tourism spots without explicit names
        if (!name || name === 'yes') {
            const raw = tags.historic || tags.tourism || 'Point of Interest';
            name = String(raw).charAt(0).toUpperCase() + String(raw).slice(1).replace(/_/g, ' ');
        }

        return {
            id: `ors_${props.osm_id || Math.random().toString(36).substring(7)}`,
            name: name,
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            category: this._detectCategory(props.category_ids || {}),
            address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
                .filter(Boolean)
                .join(', ') || null,
            phone: tags.phone || null,
            website: tags.website || null,
            openingHours: tags.opening_hours || null,
            distance: props.distance || null,
            source: 'ors_poi',
        };
    }

    _detectCategory(categoryIds) {
        const catVals = Object.keys(categoryIds);
        if (catVals.length === 0) return 'other';

        const rawCat = categoryIds[catVals[0]]?.category_group || '';
        if (rawCat === 'accomodation' || rawCat === 'accommodation') return 'hotel';
        if (rawCat === 'healthcare') return 'medical';
        if (rawCat === 'financial') return 'finance';
        if (rawCat === 'sustenance' || rawCat === 'eat_and_drink') return 'restaurant';
        if (['arts_and_culture', 'historic', 'tourism', 'natural'].includes(rawCat)) return 'landmark';
        if (rawCat === 'leisure_and_entertainment') return 'activity';
        if (rawCat === 'transport' || rawCat === 'public_transport') return 'transport';
        if (rawCat === 'shopping' || rawCat === 'money') return 'shopping';
        return 'other';
    }

    async getRoute(coordinates, profile = 'driving-car') {
        if (!coordinates || coordinates.length < 2) {
            return null;
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/v2/directions/${profile}/geojson`,
                {
                    coordinates: coordinates.map(c => [c.lng, c.lat]),
                    instructions: true,
                    units: 'km',
                },
                {
                    headers: {
                        Authorization: this.apiKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                }
            );

            const feature = response.data.features[0];
            return {
                geometry: feature.geometry,
                distance: feature.properties.summary.distance, // km
                duration: feature.properties.summary.duration, // seconds
                steps: feature.properties.segments.flatMap(s =>
                    s.steps.map(step => ({
                        instruction: step.instruction,
                        distance: step.distance,
                        duration: step.duration,
                    }))
                ),
            };
        } catch (error) {
            console.error('ORS route error:', error.response ? JSON.stringify(error.response.data) : error.message);
            return null;
        }
    }

    async optimizeRoute(coordinates, profile = 'driving-car') {
        if (!coordinates || coordinates.length < 3) {
            return this.getRoute(coordinates, profile);
        }

        try {
            // Use optimization endpoint for multi-stop route optimization
            const jobs = coordinates.slice(1, -1).map((c, i) => ({
                id: i + 1,
                location: [c.lng, c.lat],
            }));

            const response = await axios.post(
                `${this.baseUrl}/optimization`,
                {
                    jobs,
                    vehicles: [{
                        id: 1,
                        profile,
                        start: [coordinates[0].lng, coordinates[0].lat],
                        end: [coordinates[coordinates.length - 1].lng, coordinates[coordinates.length - 1].lat],
                    }],
                },
                {
                    headers: {
                        Authorization: this.apiKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                }
            );

            const optimizedOrder = response.data.routes[0]?.steps
                ?.filter(s => s.type === 'job')
                ?.map(s => s.id) || [];

            // Reorder coordinates based on optimized order
            const reorderedCoords = [
                coordinates[0],
                ...optimizedOrder.map(id => coordinates[id]),
                coordinates[coordinates.length - 1],
            ];

            // Get the actual route with optimized order
            return await this.getRoute(reorderedCoords, profile);
        } catch (error) {
            console.error('ORS optimization error:', error.response ? JSON.stringify(error.response.data) : error.message);
            // Fallback to non-optimized route
            return this.getRoute(coordinates, profile);
        }
    }
}

module.exports = ORSAdapter;
