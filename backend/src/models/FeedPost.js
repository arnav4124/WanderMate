const mongoose = require('mongoose');

const feedPostSchema = new mongoose.Schema({
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    author: { type: String, required: true }, // Firebase UID
    authorName: { type: String, required: true },
    authorAvatar: String,
    tripName: { type: String, required: true },
    destination: { type: String, required: true },
    coverImage: String,
    startDate: Date,
    endDate: Date,
    duration: Number, // days
    participantCount: { type: Number, default: 1 },
    totalBudget: { type: Number, default: 0 },
    stopCount: { type: Number, default: 0 },
    likes: [{ type: String }], // Firebase UIDs
    likeCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});

feedPostSchema.index({ createdAt: -1 });
feedPostSchema.index({ author: 1, createdAt: -1 });
feedPostSchema.index({ likeCount: -1 });

module.exports = mongoose.model('FeedPost', feedPostSchema);
