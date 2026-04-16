const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
    name: { type: String, required: true },
    placeId: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    category: { type: String, enum: ['hotel', 'restaurant', 'landmark', 'activity', 'transport', 'other'], default: 'other' },
    notes: String,
    order: { type: Number, required: true },
    duration: Number, // minutes
    address: String,
    rating: Number,
    photo: String,
});

const daySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    dayNumber: { type: Number, required: true },
    stops: [stopSchema],
});

const tripSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    coverImage: String,
    owner: { type: String, required: true }, // Firebase UID
    collaborators: [{ type: String }], // Firebase UIDs
    days: [daySchema],
    isPublished: { type: Boolean, default: false },
    publishedAt: Date,
    status: { type: String, enum: ['planning', 'active', 'completed'], default: 'planning' },
}, {
    timestamps: true,
});

tripSchema.index({ owner: 1, createdAt: -1 });
tripSchema.index({ collaborators: 1 });
tripSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('Trip', tripSchema);
