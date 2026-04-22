const express = require('express');
const TripController = require('../controllers/tripController');

const router = express.Router();

// GET /api/trips - Get all trips for authenticated user
router.get('/', TripController.getTrips);

// GET /api/trips/:id - Get single trip
router.get('/:id', TripController.getTrip);

// POST /api/trips - Create new trip
router.post('/', TripController.createTrip);

// PUT /api/trips/:id - Update trip
router.put('/:id', TripController.updateTrip);

// DELETE /api/trips/:id - Delete trip
router.delete('/:id', TripController.deleteTrip);

// POST /api/trips/:id/days/:dayIndex/stops - Add stop to a day
router.post('/:id/days/:dayIndex/stops', TripController.addStop);

// PUT /api/trips/:id/days/:dayIndex/reorder - Reorder stops in a day
router.put('/:id/days/:dayIndex/reorder', TripController.reorderStops);

// PUT /api/trips/:id/days/:dayIndex/stops/:stopId - Update a stop
router.put('/:id/days/:dayIndex/stops/:stopId', TripController.updateStop);

// DELETE /api/trips/:id/days/:dayIndex/stops/:stopId - Remove stop
router.delete('/:id/days/:dayIndex/stops/:stopId', TripController.removeStop);

// POST /api/trips/:id/collaborators - Add collaborator
router.post('/:id/collaborators', TripController.addCollaborator);

module.exports = router;
