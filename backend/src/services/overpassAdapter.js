// const axios = require('axios');
// 
// /**
//  * Overpass Adapter - Strategy pattern implementation
//  * Queries OpenStreetMap data via Overpass API (free, unlimited)
//  * Uses multiple mirrors with fallback for reliability.
//  */
// class OverpassAdapter {
//     constructor() {
//         this.mirrors = [
//             'https://overpass-api.de/api/interpreter',
//             'https://overpass.kumi.systems/api/interpreter',
//             'https://overpass.openstreetmap.ru/api/interpreter',
//             'https://overpass.osm.ch/api/interpreter',
//             'https://overpass.nchc.org.tw/api/interpreter',
//         ];
//     }
// 
//     async _post(body) {
//         const encoded = encodeURIComponent(body);
//         for (const url of this.mirrors) {
//             // Try POST first, then GET — some mirrors reject one but not the other
//             try {
//                 const response = await axios.post(url, `data=${encoded}`, {
//                     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//                 });
//                 console.log(`Overpass success via POST: ${url}`);
//                 return response.data;
//             } catch (postErr) {
//                 console.warn(`Overpass POST ${url} failed: ${postErr.message}. Trying GET...`);
//                 try {
//                     const response = await axios.get(`${url}?data=${encoded}`);
//                     console.log(`Overpass success via GET: ${url}`);
//                     return response.data;
//                 } catch (getErr) {
//                     console.warn(`Overpass GET ${url} failed: ${getErr.message}. Trying next mirror...`);
//                 }
//             }
//         }
//         throw new Error('All Overpass mirrors failed (POST + GET)');
//     }
// 
//     async searchPOI(query, lat, lng, radius = 5000) {
//         // Sanitize query to prevent QL injection
//         const safeQuery = query.replace(/[^\w\s]/g, '').trim().slice(0, 50);
//         const overpassQuery = `
//       [out:json][maxsize:1048576];
//       (
//         node["name"~"${safeQuery}",i](around:${radius},${lat},${lng});
//         node["tourism"~"hotel|hostel|motel|guest_house"](around:${radius},${lat},${lng});
//         node["amenity"~"restaurant|cafe|bar|fast_food"](around:${radius},${lat},${lng});
//         node["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lng});
//       );
//       out center 50;
//     `;
// 
//         try {
//             const data = await this._post(overpassQuery);
//             return data.elements.map(el => this._normalize(el));
//         } catch (error) {
//             console.error('Overpass API error:', error.message);
//             return [];
//         }
//     }
// 
//     async searchByCategory(category, lat, lng, radius = 5000) {
//         const categoryMap = {
//             hotel: '["tourism"~"hotel|hostel|motel|guest_house"]',
//             restaurant: '["amenity"~"restaurant|cafe|bar|fast_food"]',
//             landmark: '["tourism"~"attraction|museum|viewpoint"]',
//             activity: '["leisure"]',
//         };
// 
//         const filter = categoryMap[category] || '["tourism"]';
//         const overpassQuery = `
//       [out:json][maxsize:1048576];
//       node${filter}(around:${radius},${lat},${lng});
//       out center 50;
//     `;
// 
//         try {
//             const data = await this._post(overpassQuery);
//             return data.elements.map(el => this._normalize(el));
//         } catch (error) {
//             console.error('Overpass category search error:', error.message);
//             return [];
//         }
//     }
// 
//     _normalize(element) {
//         const tags = element.tags || {};
//         return {
//             id: `osm_${element.id}`,
//             name: tags.name || tags['name:en'] || 'Unknown Place',
//             lat: element.lat,
//             lng: element.lon,
//             category: this._detectCategory(tags),
//             address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(', ') || null,
//             phone: tags.phone || null,
//             website: tags.website || null,
//             openingHours: tags.opening_hours || null,
//             source: 'overpass',
//         };
//     }
// 
//     _detectCategory(tags) {
//         if (tags.tourism === 'hotel' || tags.tourism === 'hostel') return 'hotel';
//         if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') return 'restaurant';
//         if (tags.tourism === 'attraction' || tags.historic) return 'landmark';
//         return 'other';
//     }
// }
// 
// module.exports = OverpassAdapter;
