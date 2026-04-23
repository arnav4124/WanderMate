const express = require('express');
const { getTravelService } = require('../services/travelService');
const { externalApiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const travelService = getTravelService();

// POST /api/routes/calculate - Calculate route between stops
router.post('/calculate', externalApiLimiter, async (req, res) => {
    try {
        const { coordinates, profile } = req.body;

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
            return res.status(400).json({ error: 'At least 2 coordinates required' });
        }

        const route = await travelService.getRoute(coordinates, profile || 'driving-car');

        if (!route) {
            return res.status(200).json(null); // Fallback gracefully
        }

        res.json(route);
    } catch (error) {
        console.error('Route calculation error:', error);
        res.status(200).json(null); // Fallback gracefully
    }
});

// POST /api/routes/optimize - Optimize multi-stop route
router.post('/optimize', externalApiLimiter, async (req, res) => {
    try {
        const { coordinates, profile } = req.body;

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
            return res.status(400).json({ error: 'At least 2 coordinates required' });
        }

        const route = await travelService.optimizeRoute(coordinates, profile || 'driving-car');

        if (!route) {
            return res.status(200).json(null); // Return 200 with null to fallback gracefully without red errors
        }

        res.json(route);
    } catch (error) {
        console.error('Route optimization error:', error);
        res.status(200).json(null); // Fallback gracefully
    }
});

module.exports = router;
