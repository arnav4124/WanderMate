const NodeCache = require('node-cache');

/**
 * Cache middleware using node-cache (Cache-Aside pattern)
 * Reduces latency and respects free-tier quotas (FR-07, NFR-06)
 */
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL

const cacheMiddleware = (keyPrefix, ttl = 3600) => {
    return (req, res, next) => {
        const key = `${keyPrefix}:${req.originalUrl}`;
        const cached = cache.get(key);

        if (cached) {
            return res.json(cached);
        }

        // Override res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            if (res.statusCode === 200) {
                cache.set(key, data, ttl);
            }
            return originalJson(data);
        };

        next();
    };
};

const clearCache = (keyPrefix) => {
    const keys = cache.keys().filter(k => k.startsWith(keyPrefix));
    keys.forEach(k => cache.del(k));
};

module.exports = { cacheMiddleware, clearCache, cache };
