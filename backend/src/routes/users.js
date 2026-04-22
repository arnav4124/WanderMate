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

        if (!currentUser.following.includes(targetUid) && !currentUser.pendingFollowing.includes(targetUid)) {
            currentUser.pendingFollowing.push(targetUid);
            targetUser.followRequests.push(req.user.uid);
            await Promise.all([currentUser.save(), targetUser.save()]);
        }

        res.json({ following: currentUser.following, pendingFollowing: currentUser.pendingFollowing });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Failed to send follow request' });
    }
});

// POST /api/users/:uid/accept-follow - Accept follow request
router.post('/:uid/accept-follow', async (req, res) => {
    try {
        const requesterUid = req.params.uid;
        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        const requester = await User.findOne({ firebaseUid: requesterUid });

        if (currentUser && requester) {
            currentUser.followRequests = currentUser.followRequests.filter(uid => uid !== requesterUid);
            requester.pendingFollowing = requester.pendingFollowing.filter(uid => uid !== req.user.uid);

            if (!currentUser.followers.includes(requesterUid)) {
                currentUser.followers.push(requesterUid);
            }
            if (!requester.following.includes(req.user.uid)) {
                requester.following.push(req.user.uid);
            }

            await Promise.all([currentUser.save(), requester.save()]);
        }

        res.json({ followRequests: currentUser?.followRequests || [], followers: currentUser?.followers || [] });
    } catch (error) {
        console.error('Accept follow error:', error);
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

// POST /api/users/:uid/deny-follow - Deny follow request
router.post('/:uid/deny-follow', async (req, res) => {
    try {
        const requesterUid = req.params.uid;
        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        const requester = await User.findOne({ firebaseUid: requesterUid });

        if (currentUser && requester) {
            currentUser.followRequests = currentUser.followRequests.filter(uid => uid !== requesterUid);
            requester.pendingFollowing = requester.pendingFollowing.filter(uid => uid !== req.user.uid);

            await Promise.all([currentUser.save(), requester.save()]);
        }

        res.json({ followRequests: currentUser?.followRequests || [] });
    } catch (error) {
        console.error('Deny follow error:', error);
        res.status(500).json({ error: 'Failed to deny request' });
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
            currentUser.pendingFollowing = currentUser.pendingFollowing.filter(uid => uid !== targetUid);
            await currentUser.save();
        }

        if (targetUser) {
            targetUser.followers = targetUser.followers.filter(uid => uid !== req.user.uid);
            targetUser.followRequests = targetUser.followRequests.filter(uid => uid !== req.user.uid);
            await targetUser.save();
        }

        res.json({ following: currentUser?.following || [], pendingFollowing: currentUser?.pendingFollowing || [] });
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

// GET /api/users/me/requests - Get full user profiles for follow requests
router.get('/me/requests', async (req, res) => {
    try {
        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        if (!currentUser || !currentUser.followRequests.length) {
            return res.json([]);
        }

        const requesters = await User.find({ firebaseUid: { $in: currentUser.followRequests } })
            .select('firebaseUid displayName avatarUrl');
        
        res.json(requesters);
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Failed to fetch follow requests' });
    }
});

// GET /api/users/me/friends - Get friends (people you follow + people following you)
router.get('/me/friends', async (req, res) => {
    try {
        const currentUser = await User.findOne({ firebaseUid: req.user.uid });
        if (!currentUser) {
            return res.json([]);
        }

        const friendUids = [...new Set([...currentUser.following, ...currentUser.followers])];
        
        const friends = await User.find({ firebaseUid: { $in: friendUids } })
            .select('firebaseUid displayName avatarUrl email');
        
        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to fetch friends' });
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
