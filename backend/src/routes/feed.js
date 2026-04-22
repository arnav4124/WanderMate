const express = require('express');
const FeedPost = require('../models/FeedPost');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { firebaseDB } = require('../config/firebase');

const router = express.Router();

// GET /api/feed - Get paginated feed (following + popular)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        const following = currentUser?.following || [];

        let posts;
        if (req.query.type === 'following') {
            if (following.length > 0) {
                // Feed from followed users
                posts = await FeedPost.find({ author: { $in: following } })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit);
            } else {
                posts = [];
            }
        } else {
            // Discover/popular feed
            posts = await FeedPost.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
        }

        const total = req.query.type === 'following' 
            ? (following.length > 0 ? await FeedPost.countDocuments({ author: { $in: following } }) : 0)
            : await FeedPost.countDocuments({});

        res.json({
            posts,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error('Get feed error:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

// POST /api/feed/publish/:tripId - Publish a trip to the social feed
router.post('/publish/:tripId', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid) {
            return res.status(403).json({ error: 'Only the owner can publish a trip' });
        }

        if (trip.isPublished) {
            return res.status(400).json({ error: 'Trip is already published' });
        }

        const user = await User.findOne({ firebaseUid: req.user.uid });

        // Calculate budget summary
        const expenses = await Expense.find({ trip: trip._id });
        const totalBudget = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Count total stops
        const stopCount = trip.days.reduce((sum, day) => sum + day.stops.length, 0);

        const duration = Math.ceil(
            (new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)
        ) + 1;

        const feedPost = new FeedPost({
            trip: trip._id,
            author: req.user.uid,
            authorName: user?.displayName || 'Traveler',
            authorAvatar: user?.avatarUrl,
            tripName: trip.name,
            destination: trip.destination,
            coverImage: trip.coverImage,
            startDate: trip.startDate,
            endDate: trip.endDate,
            duration,
            participantCount: 1 + (trip.collaborators?.length || 0),
            totalBudget,
            stopCount,
        });

        await feedPost.save();

        // Mark trip as published
        trip.isPublished = true;
        trip.publishedAt = new Date();
        await trip.save();

        // Add to user's published trips
        if (user) {
            user.publishedTrips.push(trip._id);
            await user.save();
        }

        // Broadcast to Firebase for real-time feed updates
        await firebaseDB.ref(`feed/${feedPost._id}`).set({
            author: req.user.uid,
            tripName: trip.name,
            createdAt: Date.now(),
        });

        res.status(201).json(feedPost);
    } catch (error) {
        console.error('Publish trip error:', error);
        res.status(500).json({ error: 'Failed to publish trip' });
    }
});

// POST /api/feed/:postId/like - Like/unlike a feed post
router.post('/:postId/like', async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const userIndex = post.likes.indexOf(req.user.uid);
        if (userIndex === -1) {
            post.likes.push(req.user.uid);
            post.likeCount += 1;
        } else {
            post.likes.splice(userIndex, 1);
            post.likeCount -= 1;
        }

        await post.save();
        res.json({ likeCount: post.likeCount, liked: userIndex === -1 });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// POST /api/feed/:postId/clone - Clone a published itinerary (FR-19)
router.post('/:postId/clone', async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const originalTrip = await Trip.findById(post.trip);
        if (!originalTrip) return res.status(404).json({ error: 'Original trip not found' });

        // Privacy check: must be owner or a follower
        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        if (originalTrip.owner !== req.user.uid && currentUser && !currentUser.following.includes(originalTrip.owner)) {
            return res.status(403).json({ error: 'Only followers can clone this trip' });
        }

        // Deep-copy trip document, assign new owner
        const clonedTrip = new Trip({
            name: `${originalTrip.name} (Copy)`,
            destination: originalTrip.destination,
            startDate: originalTrip.startDate,
            endDate: originalTrip.endDate,
            coverImage: originalTrip.coverImage,
            owner: req.user.uid,
            collaborators: [],
            days: originalTrip.days.map(day => ({
                date: day.date,
                dayNumber: day.dayNumber,
                stops: day.stops.map(stop => ({
                    name: stop.name,
                    placeId: stop.placeId,
                    lat: stop.lat,
                    lng: stop.lng,
                    category: stop.category,
                    notes: stop.notes,
                    order: stop.order,
                    duration: stop.duration,
                    address: stop.address,
                    rating: stop.rating,
                    photo: stop.photo,
                })),
            })),
            isPublished: false,
            status: 'planning',
        });

        await clonedTrip.save();

        // Sync cloned trip to Firebase
        await firebaseDB.ref(`trips/${clonedTrip._id}`).set({
            name: clonedTrip.name,
            destination: clonedTrip.destination,
            owner: req.user.uid,
            updatedAt: Date.now(),
        });

        res.status(201).json(clonedTrip);
    } catch (error) {
        console.error('Clone error:', error);
        res.status(500).json({ error: 'Failed to clone trip' });
    }
});

module.exports = router;
