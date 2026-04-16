const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: String,
    followers: [{ type: String }], // Firebase UIDs
    following: [{ type: String }], // Firebase UIDs
    publishedTrips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trip' }],
}, {
    timestamps: true,
});

userSchema.index({ firebaseUid: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);
