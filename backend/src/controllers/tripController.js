const Trip = require('../models/Trip');
const tripEvents = require('../services/tripObserver');

class TripController {
    // GET /api/trips
    static async getTrips(req, res) {
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
    }

    // GET /api/trips/:id
    static async getTrip(req, res) {
        try {
            const trip = await Trip.findById(req.params.id);
            if (!trip) {
                return res.status(404).json({ error: 'Trip not found' });
            }

            if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            res.json(trip);
        } catch (error) {
            console.error('Get trip error:', error);
            res.status(500).json({ error: 'Failed to fetch trip' });
        }
    }

    // POST /api/trips
    static async createTrip(req, res) {
        try {
            const { name, destination, startDate, endDate, coverImage } = req.body;

            if (!name || !destination || !startDate || !endDate) {
                return res.status(400).json({ error: 'Name, destination, startDate, and endDate are required' });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

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

            // Observer Pattern: Emit event instead of direct Firebase logic
            tripEvents.emit('TRIP_CREATED', trip);

            res.status(201).json(trip);
        } catch (error) {
            console.error('Create trip error:', error);
            res.status(500).json({ error: 'Failed to create trip' });
        }
    }

    // PUT /api/trips/:id
    static async updateTrip(req, res) {
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

            tripEvents.emit('TRIP_UPDATED', trip._id, req.user.uid);

            res.json(trip);
        } catch (error) {
            console.error('Update trip error:', error);
            res.status(500).json({ error: 'Failed to update trip' });
        }
    }

    // DELETE /api/trips/:id
    static async deleteTrip(req, res) {
        try {
            const trip = await Trip.findById(req.params.id);
            if (!trip) {
                return res.status(404).json({ error: 'Trip not found' });
            }

            if (trip.owner !== req.user.uid) {
                return res.status(403).json({ error: 'Only the owner can delete a trip' });
            }

            await Trip.findByIdAndDelete(req.params.id);

            tripEvents.emit('TRIP_DELETED', req.params.id);

            res.json({ message: 'Trip deleted' });
        } catch (error) {
            console.error('Delete trip error:', error);
            res.status(500).json({ error: 'Failed to delete trip' });
        }
    }

    // POST /api/trips/:id/days/:dayIndex/stops
    static async addStop(req, res) {
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

            tripEvents.emit('TRIP_UPDATED', trip._id, req.user.uid);

            res.status(201).json(trip);
        } catch (error) {
            console.error('Add stop error:', error);
            res.status(500).json({ error: 'Failed to add stop' });
        }
    }

    // PUT /api/trips/:id/days/:dayIndex/reorder
    static async reorderStops(req, res) {
        try {
            const trip = await Trip.findById(req.params.id);
            if (!trip) return res.status(404).json({ error: 'Trip not found' });

            if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const dayIndex = parseInt(req.params.dayIndex);
            const { stopOrder } = req.body;

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

            tripEvents.emit('TRIP_UPDATED', trip._id, req.user.uid);

            res.json(trip);
        } catch (error) {
            console.error('Reorder stops error:', error);
            res.status(500).json({ error: 'Failed to reorder stops' });
        }
    }

    // PUT /api/trips/:id/days/:dayIndex/stops/:stopId
    static async updateStop(req, res) {
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

            const stop = trip.days[dayIndex].stops.id(req.params.stopId);
            if (!stop) {
                return res.status(404).json({ error: 'Stop not found' });
            }

            const updates = req.body;
            delete updates.order;
            
            Object.assign(stop, updates);
            await trip.save();

            tripEvents.emit('TRIP_UPDATED', trip._id, req.user.uid);

            res.json(trip);
        } catch (error) {
            console.error('Update stop error:', error);
            res.status(500).json({ error: 'Failed to update stop' });
        }
    }

    // DELETE /api/trips/:id/days/:dayIndex/stops/:stopId
    static async removeStop(req, res) {
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

            trip.days[dayIndex].stops.forEach((stop, idx) => {
                stop.order = idx;
            });

            await trip.save();

            tripEvents.emit('TRIP_UPDATED', trip._id, req.user.uid);

            res.json(trip);
        } catch (error) {
            console.error('Remove stop error:', error);
            res.status(500).json({ error: 'Failed to remove stop' });
        }
    }

    // POST /api/trips/:id/collaborators
    static async addCollaborator(req, res) {
        try {
            const trip = await Trip.findById(req.params.id);
            if (!trip) return res.status(404).json({ error: 'Trip not found' });

            if (trip.owner !== req.user.uid) {
                return res.status(403).json({ error: 'Only the owner can add collaborators' });
            }

            const { userId } = req.body;
            const User = require('../models/User');
            const ownerUser = await User.findOne({ firebaseUid: req.user.uid });
            if (!ownerUser || (!ownerUser.following.includes(userId) && !ownerUser.followers.includes(userId))) {
                return res.status(403).json({ error: 'Collaborators must be friends (following or follower)' });
            }
            if (!userId) return res.status(400).json({ error: 'userId is required' });

            if (!trip.collaborators.includes(userId)) {
                trip.collaborators.push(userId);
                await trip.save();

                tripEvents.emit('COLLABORATORS_UPDATED', trip._id, trip.collaborators);
            }

            res.json(trip);
        } catch (error) {
            console.error('Add collaborator error:', error);
            res.status(500).json({ error: 'Failed to add collaborator' });
        }
    }
}

module.exports = TripController;
