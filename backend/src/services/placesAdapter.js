const axios = require('axios');

/**
 * Google Places Adapter - Strategy pattern implementation
 * Provides enriched POI data (photos, ratings, reviews)
 * Quota-sensitive: 5,000 req/month on free tier
 */
class PlacesAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    }

    async searchPOI(query, lat, lng, radius = 5000) {
        try {
            const params = {
                query: query,
                key: this.apiKey,
            };
            if (lat !== null && lng !== null) {
                params.location = `${lat},${lng}`;
                params.radius = radius;
            }

            const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
                params,
                timeout: 10000,
            });

            if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
                console.error('Google Places API status:', response.data.status, response.data.error_message || '');
                return [];
            }

            console.log(`Google Places: ${response.data.results?.length || 0} results (status: ${response.data.status})`);
            return response.data.results.map(place => this._normalize(place));
        } catch (error) {
            console.error('Google Places search error:', error.message);
            return [];
        }
    }

    async searchByCategory(category, lat, lng, radius = 5000) {
        const categoryMap = {
            hotel: 'lodging',
            restaurant: 'restaurant',
            landmark: 'tourist_attraction',
            activity: 'amusement_park',
            shopping: 'shopping_mall',
            transport: 'transit_station',
            museum: 'museum',
            park: 'park',
            nightlife: 'night_club',
            medical: 'hospital',
            grocery: 'supermarket',
            finance: 'bank'
        };

        const type = categoryMap[category] || 'point_of_interest';

        try {
            const response = await axios.get(`${this.baseUrl}/nearbysearch/json`, {
                params: {
                    location: `${lat},${lng}`,
                    radius,
                    type: type,
                    key: this.apiKey,
                },
                timeout: 10000,
            });

            if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
                console.error('Google Places API status:', response.data.status, response.data.error_message || '');
                return [];
            }

            console.log(`Google Places Category: ${response.data.results?.length || 0} results (status: ${response.data.status})`);
            return response.data.results.map(place => this._normalize(place));
        } catch (error) {
            console.error('Google Places category search error:', error.message);
            return [];
        }
    }

    async findPlaceAndGetDetails(name, lat, lng) {
        if (!this.apiKey || !name || !lat || !lng) return null;

        try {
            // Find Place ID from name and location radius
            const findResponse = await axios.get(`${this.baseUrl}/findplacefromtext/json`, {
                params: {
                    input: name,
                    inputtype: 'textquery',
                    locationbias: `circle:50@${lat},${lng}`,
                    fields: 'place_id',
                    key: this.apiKey,
                },
                timeout: 10000,
            });

            if (findResponse.data.status !== 'OK' || !findResponse.data.candidates?.length) {
                return null; // Could not find a match
            }

            const googlePlaceId = findResponse.data.candidates[0].place_id;
            
            // Now fetch details using the found ID
            return await this.getPlaceDetails(googlePlaceId);
        } catch (error) {
            console.error('Google Places findPlace error:', error.message);
            return null;
        }
    }

    async getPlaceDetails(placeId) {
        try {
            const response = await axios.get(`${this.baseUrl}/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'name,formatted_address,geometry,rating,user_ratings_total,photos,opening_hours,formatted_phone_number,website,price_level,types',
                    key: this.apiKey,
                },
                timeout: 10000,
            });

            const place = response.data.result;
            return {
                placeId: placeId,
                name: place.name,
                address: place.formatted_address,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                rating: place.rating,
                totalRatings: place.user_ratings_total,
                photos: place.photos?.slice(0, 3).map(p => this._getPhotoUrl(p.photo_reference)) || [],
                openingHours: place.opening_hours?.weekday_text || null,
                phone: place.formatted_phone_number || null,
                website: place.website || null,
                priceLevel: place.price_level,
                source: 'google_places',
            };
        } catch (error) {
            console.error('Google Places details error:', error.message);
            return null;
        }
    }

    _getPhotoUrl(photoReference, maxWidth = 400) {
        return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
    }

    _normalize(place) {
        return {
            id: `gp_${place.place_id}`,
            placeId: place.place_id,
            name: place.name,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            category: this._detectCategory(place.types || []),
            address: place.vicinity || null,
            rating: place.rating || null,
            totalRatings: place.user_ratings_total || 0,
            photo: place.photos?.[0]
                ? this._getPhotoUrl(place.photos[0].photo_reference)
                : null,
            priceLevel: place.price_level,
            source: 'google_places',
        };
    }

    _detectCategory(types) {
        if (types.includes('grocery_or_supermarket') || types.includes('supermarket') || types.includes('convenience_store')) return 'grocery';
        if (types.includes('hospital') || types.includes('pharmacy') || types.includes('doctor')) return 'medical';
        if (types.includes('bank') || types.includes('atm')) return 'finance';
        if (types.includes('night_club') || types.includes('casino') || types.includes('bar')) return 'nightlife';
        if (types.includes('shopping_mall') || types.includes('clothing_store') || types.includes('department_store')) return 'shopping';
        if (types.includes('transit_station') || types.includes('bus_station') || types.includes('train_station') || types.includes('airport')) return 'transport';
        if (types.includes('museum') || types.includes('art_gallery')) return 'museum';
        if (types.includes('park') || types.includes('campground') || types.includes('natural_feature')) return 'park';
        if (types.includes('lodging') || types.includes('hotel') || types.includes('accommodation')) return 'hotel';
        if (types.includes('restaurant') || types.includes('cafe') || types.includes('food')) return 'restaurant';
        if (types.includes('tourist_attraction') || types.includes('point_of_interest') || types.includes('landmark')) return 'landmark';
        if (types.includes('amusement_park') || types.includes('stadium') || types.includes('zoo')) return 'activity';
        return 'other';
    }
}

module.exports = PlacesAdapter;
