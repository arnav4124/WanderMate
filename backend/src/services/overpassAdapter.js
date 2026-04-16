const axios = require('axios');

/**
 * Overpass Adapter - Strategy pattern implementation
 * Queries OpenStreetMap data via Overpass API (free, unlimited)
 */
class OverpassAdapter {
    constructor() {
        this.baseUrl = 'https://overpass-api.de/api/interpreter';
    }

    async searchPOI(query, lat, lng, radius = 5000) {
        const overpassQuery = `
      [out:json][timeout:25];
      (
        node["tourism"~"hotel|hostel|motel|guest_house"](around:${radius},${lat},${lng});
        node["amenity"~"restaurant|cafe|bar|fast_food"](around:${radius},${lat},${lng});
        node["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lng});
        node["historic"](around:${radius},${lat},${lng});
        node["name"~"${query}",i](around:${radius},${lat},${lng});
      );
      out body;
    `;

        try {
            const response = await axios.post(this.baseUrl, `data=${encodeURIComponent(overpassQuery)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            });

            return response.data.elements.map(el => this._normalize(el));
        } catch (error) {
            console.error('Overpass API error:', error.message);
            return [];
        }
    }

    async searchByCategory(category, lat, lng, radius = 5000) {
        const categoryMap = {
            hotel: '["tourism"~"hotel|hostel|motel|guest_house"]',
            restaurant: '["amenity"~"restaurant|cafe|bar|fast_food"]',
            landmark: '["tourism"~"attraction|museum|viewpoint"]["historic"]',
            activity: '["leisure"]["sport"]',
        };

        const filter = categoryMap[category] || '["tourism"]';
        const overpassQuery = `
      [out:json][timeout:25];
      node${filter}(around:${radius},${lat},${lng});
      out body;
    `;

        try {
            const response = await axios.post(this.baseUrl, `data=${encodeURIComponent(overpassQuery)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            });

            return response.data.elements.map(el => this._normalize(el));
        } catch (error) {
            console.error('Overpass category search error:', error.message);
            return [];
        }
    }

    _normalize(element) {
        const tags = element.tags || {};
        return {
            id: `osm_${element.id}`,
            name: tags.name || tags['name:en'] || 'Unknown Place',
            lat: element.lat,
            lng: element.lon,
            category: this._detectCategory(tags),
            address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(', ') || null,
            phone: tags.phone || null,
            website: tags.website || null,
            openingHours: tags.opening_hours || null,
            source: 'overpass',
        };
    }

    _detectCategory(tags) {
        if (tags.tourism === 'hotel' || tags.tourism === 'hostel') return 'hotel';
        if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'restaurant';
        if (tags.tourism === 'attraction' || tags.historic) return 'landmark';
        return 'other';
    }
}

module.exports = OverpassAdapter;
