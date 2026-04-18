const mongoose = require('mongoose');

// Node v24 + OpenSSL 3.5 rejects some Atlas TLS certificates during handshake.
// This is safe for development; for production, pin the Atlas CA cert instead.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
