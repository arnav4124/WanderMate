const express = require('express');
const Trip = require('../models/Trip');
const { firebaseDB } = require('../config/firebase');

const router = express.Router();

// GET /api/trips - Get all trips for authenticated user
router.get('/', async (req, res) => {
    try {
        const trips = await Trip.find({
            $or: [
                { owner: req.user.uid },
                { collaborators: req.user.uid },
            ],
        }).sort({ updatedAt: -1 });

        res.json(trips);
    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// GET /api/trips/:id - Get single trip
router.get('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        // Authorization check
        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(trip);
    } catch (error) {
        console.error('Get trip error:', error);
        res.status(500).json({ error: 'Failed to fetch trip' });
    }
});

// POST /api/trips - Create new trip
router.post('/', async (req, res) => {
    try {
        const { name, destination, startDate, endDate, coverImage } = req.body;

        if (!name || !destination || !startDate || !endDate) {
            return res.status(400).json({ error: 'Name, destination, startDate, and endDate are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Generate days array
        const days = [];
        for (let i = 0; i < dayCount; i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + i);
            days.push({
                date,
                dayNumber: i + 1,
                stops: [],
            });
        }

        const trip = new Trip({
            name,
            destination,
            startDate: start,
            endDate: end,
            coverImage,
            owner: req.user.uid,
            collaborators: [],
            days,
        });

        await trip.save();

        // Fire-and-forget Firebase sync — do not block the HTTP response
        firebaseDB.ref(`trips/${trip._id}`).set({
            name: trip.name,
            destination: trip.destination,
            owner: req.user.uid,
            updatedAt: Date.now(),
        })
            .then(() => console.log(`Firebase synced trip ${trip._id}`))
            .catch((err) => console.error('Firebase sync error:', err));

        res.status(201).json(trip);
    } catch (error) {
        console.error('Create trip error:', error);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

// PUT /api/trips/:id - Update trip
router.put('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = req.body;
        Object.assign(trip, updates);
        await trip.save();

        // Broadcast update to Firebase for real-time sync (Observer pattern)
        await firebaseDB.ref(`trips/${trip._id}`).update({
            updatedAt: Date.now(),
            lastEditedBy: req.user.uid,
        });

        res.json(trip);
    } catch (error) {
        console.error('Update trip error:', error);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});

// DELETE /api/trips/:id - Delete trip
router.delete('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (trip.owner !== req.user.uid) {
            return res.status(403).json({ error: 'Only the owner can delete a trip' });
        }

        await Trip.findByIdAndDelete(req.params.id);
        await firebaseDB.ref(`trips/${req.params.id}`).remove();

        res.json({ message: 'Trip deleted' });
    } catch (error) {
        console.error('Delete trip error:', error);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

// POST /api/trips/:id/days/:dayIndex/stops - Add stop to a day
router.post('/:id/days/:dayIndex/stops', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const dayIndex = parseInt(req.params.dayIndex);
        if (dayIndex < 0 || dayIndex >= trip.days.length) {
            return res.status(400).json({ error: 'Invalid day index' });
        }

        const stop = req.body;
        stop.order = trip.days[dayIndex].stops.length;
        trip.days[dayIndex].stops.push(stop);
        await trip.save();

        await firebaseDB.ref(`trips/${trip._id}`).update({
            updatedAt: Date.now(),
            lastEditedBy: req.user.uid,
        });

        res.status(201).json(trip);
    } catch (error) {
        console.error('Add stop error:', error);
        res.status(500).json({ error: 'Failed to add stop' });
    }
});

// PUT /api/trips/:id/days/:dayIndex/reorder - Reorder stops in a day
router.put('/:id/days/:dayIndex/reorder', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const dayIndex = parseInt(req.params.dayIndex);
        const { stopOrder } = req.body; // Array of stop IDs in new order

        if (dayIndex < 0 || dayIndex >= trip.days.length) {
            return res.status(400).json({ error: 'Invalid day index' });
        }

        const day = trip.days[dayIndex];
        const reorderedStops = stopOrder.map((stopId, index) => {
            const stop = day.stops.id(stopId);
            if (stop) stop.order = index;
            return stop;
        }).filter(Boolean);

        trip.days[dayIndex].stops = reorderedStops;
        await trip.save();

        await firebaseDB.ref(`trips/${trip._id}`).update({
            updatedAt: Date.now(),
            lastEditedBy: req.user.uid,
        });

        res.json(trip);
    } catch (error) {
        console.error('Reorder stops error:', error);
        res.status(500).json({ error: 'Failed to reorder stops' });
    }
});

// DELETE /api/trips/:id/days/:dayIndex/stops/:stopId - Remove stop
router.delete('/:id/days/:dayIndex/stops/:stopId', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const dayIndex = parseInt(req.params.dayIndex);
        if (dayIndex < 0 || dayIndex >= trip.days.length) {
            return res.status(400).json({ error: 'Invalid day index' });
        }

        trip.days[dayIndex].stops = trip.days[dayIndex].stops.filter(
            s => s._id.toString() !== req.params.stopId
        );

        // Reorder remaining stops
        trip.days[dayIndex].stops.forEach((stop, idx) => {
            stop.order = idx;
        });

        await trip.save();

        await firebaseDB.ref(`trips/${trip._id}`).update({
            updatedAt: Date.now(),
            lastEditedBy: req.user.uid,
        });

        res.json(trip);
    } catch (error) {
        console.error('Remove stop error:', error);
        res.status(500).json({ error: 'Failed to remove stop' });
    }
});

// POST /api/trips/:id/collaborators - Add collaborator
router.post('/:id/collaborators', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid) {
            return res.status(403).json({ error: 'Only the owner can add collaborators' });
        }

        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        if (!trip.collaborators.includes(userId)) {
            trip.collaborators.push(userId);
            await trip.save();

            await firebaseDB.ref(`trips/${trip._id}/collaborators`).set(trip.collaborators);
        }

        res.json(trip);
    } catch (error) {
        console.error('Add collaborator error:', error);
        res.status(500).json({ error: 'Failed to add collaborator' });
    }
});

module.exports = router;
