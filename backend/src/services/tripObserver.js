const EventEmitter = require('events');
const { firebaseDB } = require('../config/firebase');

class TripEmitter extends EventEmitter {}
const tripEvents = new TripEmitter();

// Observer for TRIP_CREATED
tripEvents.on('TRIP_CREATED', (trip) => {
    firebaseDB.ref(`trips/${trip._id}`).set({
        name: trip.name,
        destination: trip.destination,
        owner: trip.owner,
        updatedAt: Date.now(),
    })
    .then(() => console.log(`Firebase synced new trip ${trip._id}`))
    .catch((err) => console.error('Firebase sync error on create:', err));
});

// Observer for TRIP_UPDATED
tripEvents.on('TRIP_UPDATED', (tripId, userId) => {
    firebaseDB.ref(`trips/${tripId}`).update({
        updatedAt: Date.now(),
        lastEditedBy: userId,
    })
    .then(() => console.log(`Firebase synced update for trip ${tripId}`))
    .catch((err) => console.error('Firebase sync error on update:', err));
});

// Observer for TRIP_DELETED
tripEvents.on('TRIP_DELETED', (tripId) => {
    firebaseDB.ref(`trips/${tripId}`).remove()
    .then(() => console.log(`Firebase removed trip ${tripId}`))
    .catch((err) => console.error('Firebase sync error on delete:', err));
});

// Observer for COLLABORATORS_UPDATED
tripEvents.on('COLLABORATORS_UPDATED', (tripId, collaborators) => {
    firebaseDB.ref(`trips/${tripId}/collaborators`).set(collaborators)
    .then(() => console.log(`Firebase synced collaborators for trip ${tripId}`))
    .catch((err) => console.error('Firebase sync error on collaborators:', err));
});

module.exports = tripEvents;
