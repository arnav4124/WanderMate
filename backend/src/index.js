require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const authenticate = require('./middleware/auth');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const tripRoutes = require('./routes/trips');
const userRoutes = require('./routes/users');
const feedRoutes = require('./routes/feed');
const budgetRoutes = require('./routes/budget');
const poiRoutes = require('./routes/poi');
const routeRoutes = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use('/api/', generalLimiter);

// Health check (unauthenticated)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All API routes require authentication
app.use('/api/trips', authenticate, tripRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/feed', authenticate, feedRoutes);
app.use('/api/budget', authenticate, budgetRoutes);
app.use('/api/poi', authenticate, poiRoutes);
app.use('/api/routes', authenticate, routeRoutes);

// Structured error handling (NFR-09)
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Connect to MongoDB and start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`WanderMate API Gateway running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = app;
