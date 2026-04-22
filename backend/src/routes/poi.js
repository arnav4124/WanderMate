const express = require('express');
const { getTravelService } = require('../services/travelService');
const { externalApiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const travelService = getTravelService();

// All routes use external API rate limiter to protect quotas (NFR-06)

// GET /api/poi/search?q=query&lat=&lng=&radius=&refresh=true
router.get('/search', externalApiLimiter, async (req, res) => {
    const startTime = Date.now();
    try {
        const { q, lat, lng, radius, refresh } = req.query;
        const ignoreCache = refresh === 'true';
        console.log(`[POI /search] q="${q}" lat=${lat} lng=${lng} radius=${radius} refresh=${ignoreCache}`);

        if (!q || !lat || !lng) {
            return res.status(400).json({ error: 'q, lat, and lng are required' });
        }

        const results = await travelService.searchPOI(
            q,
            parseFloat(lat),
            parseFloat(lng),
            parseInt(radius) || 5000,
            ignoreCache
        );

        console.log(`[POI /search] ${results.length} results in ${Date.now() - startTime}ms`);
        res.json(results);
    } catch (error) {
        console.error('POI search error:', error);
        res.status(500).json({ error: 'Failed to search POIs' });
    }
});

// GET /api/poi/category/:category?lat=&lng=&radius=&refresh=true
router.get('/category/:category', externalApiLimiter, async (req, res) => {
    try {
        const { lat, lng, radius, refresh } = req.query;
        const { category } = req.params;
        const ignoreCache = refresh === 'true';

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng are required' });
        }

        const results = await travelService.searchByCategory(
            category,
            parseFloat(lat),
            parseFloat(lng),
            parseInt(radius) || 5000,
            ignoreCache
        );

        res.json(results);
    } catch (error) {
        console.error('Category search error:', error);
        res.status(500).json({ error: 'Failed to search by category' });
    }
});

// GET /api/poi/details/:placeId
router.get('/details/:placeId', externalApiLimiter, async (req, res) => {
    try {
        const details = await travelService.getPlaceDetails(req.params.placeId);

        if (!details) {
            return res.status(404).json({ error: 'Place details not found' });
        }

        res.json(details);
    } catch (error) {
        console.error('Place details error:', error);
        res.status(500).json({ error: 'Failed to fetch place details' });
    }
});

module.exports = router;
