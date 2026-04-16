const express = require('express');
const User = require('../models/User');

const router = express.Router();

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res) => {
    try {
        let user = await User.findOne({ firebaseUid: req.user.uid });

        if (!user) {
            // Create user profile on first login
            user = new User({
                firebaseUid: req.user.uid,
                email: req.user.email,
                displayName: req.user.name || req.user.email?.split('@')[0] || 'Traveler',
                avatarUrl: req.user.picture || null,
            });
            await user.save();
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// PUT /api/users/me - Update current user profile
router.put('/me', async (req, res) => {
    try {
        const { displayName, avatarUrl } = req.body;

        const user = await User.findOneAndUpdate(
            { firebaseUid: req.user.uid },
            { displayName, avatarUrl },
            { new: true }
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// POST /api/users/:uid/follow - Follow a user
router.post('/:uid/follow', async (req, res) => {
    try {
        const targetUid = req.params.uid;
        if (targetUid === req.user.uid) {
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }

        const targetUser = await User.findOne({ firebaseUid: targetUid });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        if (!currentUser) return res.status(404).json({ error: 'Current user not found' });

        if (!currentUser.following.includes(targetUid)) {
            currentUser.following.push(targetUid);
            targetUser.followers.push(req.user.uid);
            await Promise.all([currentUser.save(), targetUser.save()]);
        }

        res.json({ following: currentUser.following });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Failed to follow user' });
    }
});

// POST /api/users/:uid/unfollow - Unfollow a user
router.post('/:uid/unfollow', async (req, res) => {
    try {
        const targetUid = req.params.uid;

        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        const targetUser = await User.findOne({ firebaseUid: targetUid });

        if (currentUser) {
            currentUser.following = currentUser.following.filter(uid => uid !== targetUid);
            await currentUser.save();
        }

        if (targetUser) {
            targetUser.followers = targetUser.followers.filter(uid => uid !== req.user.uid);
            await targetUser.save();
        }

        res.json({ following: currentUser?.following || [] });
    } catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
});

// GET /api/users/search?q=query - Search users
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Search query required' });

        const users = await User.find({
            $or: [
                { displayName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
            firebaseUid: { $ne: req.user.uid },
        }).limit(20).select('firebaseUid displayName avatarUrl');

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// GET /api/users/:uid - Get user by Firebase UID
router.get('/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ firebaseUid: req.params.uid })
            .select('firebaseUid displayName avatarUrl followers following publishedTrips');

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

module.exports = router;
