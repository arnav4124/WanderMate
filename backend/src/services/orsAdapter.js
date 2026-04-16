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
            console.error('ORS route error:', error.message);
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
            console.error('ORS optimization error:', error.message);
            // Fallback to non-optimized route
            return this.getRoute(coordinates, profile);
        }
    }
}

module.exports = ORSAdapter;
