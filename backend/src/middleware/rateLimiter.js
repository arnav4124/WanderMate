const rateLimit = require('express-rate-limit');

/**
 * Rate limiting middleware - architectural tactic for scalability
 * Protects free-tier API quotas (NFR-06)
 */

// General API rate limit
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limit for external API proxying (Google Places, ORS)
const externalApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: { error: 'External API rate limit exceeded, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { generalLimiter, externalApiLimiter };
