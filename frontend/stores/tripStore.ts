import { create } from 'zustand';
import api from '../services/api';
import { Trip, Stop } from '../types';
import { localCache, syncQueue } from '../services/syncQueue';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';

/**
 * Command pattern for undo/redo (FR-04)
 */
interface Command {
    type: 'ADD_STOP' | 'REMOVE_STOP' | 'REORDER_STOPS' | 'UPDATE_TRIP';
    tripId: string;
    dayIndex?: number;
    data: any;
    previousState: any;
}

interface TripState {
    trips: Trip[];
    currentTrip: Trip | null;
    isLoading: boolean;
    error: string | null;
    undoStack: Command[];
    redoStack: Command[];

    fetchTrips: () => Promise<void>;
    fetchTrip: (id: string) => Promise<void>;
    createTrip: (data: Partial<Trip>) => Promise<Trip | null>;
    updateTrip: (id: string, data: Partial<Trip>) => Promise<void>;
    deleteTrip: (id: string) => Promise<void>;
    addStop: (tripId: string, dayIndex: number, stop: Partial<Stop>) => Promise<void>;
    removeStop: (tripId: string, dayIndex: number, stopId: string) => Promise<void>;
    reorderStops: (tripId: string, dayIndex: number, stopOrder: string[]) => Promise<void>;
    addCollaborator: (tripId: string, userId: string) => Promise<void>;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    subscribeTripUpdates: (tripId: string) => () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
    trips: [],
    currentTrip: null,
    isLoading: false,
    error: null,
    undoStack: [],
    redoStack: [],

    fetchTrips: async () => {
        set({ isLoading: true, error: null });
        try {
            // Try API first, fallback to cache
            const response = await api.get('/trips');
            set({ trips: response.data, isLoading: false });
            await localCache.set('trips', response.data);
        } catch (error: any) {
            // Offline fallback
            const cached = await localCache.get<Trip[]>('trips', Infinity);
            if (cached) {
                set({ trips: cached, isLoading: false });
            } else {
                set({ error: error.message, isLoading: false });
            }
        }
    },

    fetchTrip: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/trips/${id}`);
            set({ currentTrip: response.data, isLoading: false });
            await localCache.set(`trip_${id}`, response.data);
        } catch (error: any) {
            const cached = await localCache.get<Trip>(`trip_${id}`, Infinity);
            if (cached) {
                set({ currentTrip: cached, isLoading: false });
            } else {
                set({ error: error.message, isLoading: false });
            }
        }
    },

    createTrip: async (data) => {
        try {
            const response = await api.post('/trips', data);
            const newTrip = response.data;
            set((state) => ({ trips: [newTrip, ...state.trips] }));
            return newTrip;
        } catch (error: any) {
            // Queue for offline sync
            await syncQueue.add({ method: 'POST', url: '/trips', data });
            set({ error: error.message });
            return null;
        }
    },

    updateTrip: async (id, data) => {
        const previousTrip = get().currentTrip;
        try {
            const response = await api.put(`/trips/${id}`, data);
            set((state) => ({
                currentTrip: response.data,
                trips: state.trips.map(t => t._id === id ? response.data : t),
                undoStack: [...state.undoStack, {
                    type: 'UPDATE_TRIP',
                    tripId: id,
                    data,
                    previousState: previousTrip,
                }],
                redoStack: [],
            }));
        } catch (error: any) {
            await syncQueue.add({ method: 'PUT', url: `/trips/${id}`, data });
            set({ error: error.message });
        }
    },

    deleteTrip: async (id) => {
        try {
            await api.delete(`/trips/${id}`);
            set((state) => ({
                trips: state.trips.filter(t => t._id !== id),
                currentTrip: state.currentTrip?._id === id ? null : state.currentTrip,
            }));
        } catch (error: any) {
            await syncQueue.add({ method: 'DELETE', url: `/trips/${id}` });
            set({ error: error.message });
        }
    },

    addStop: async (tripId, dayIndex, stop) => {
        const previousTrip = get().currentTrip;
        try {
            const response = await api.post(`/trips/${tripId}/days/${dayIndex}/stops`, stop);
            set((state) => ({
                currentTrip: response.data,
                undoStack: [...state.undoStack, {
                    type: 'ADD_STOP',
                    tripId,
                    dayIndex,
                    data: stop,
                    previousState: previousTrip,
                }],
                redoStack: [],
            }));
        } catch (error: any) {
            await syncQueue.add({
                method: 'POST',
                url: `/trips/${tripId}/days/${dayIndex}/stops`,
                data: stop,
            });
            set({ error: error.message });
        }
    },

    removeStop: async (tripId, dayIndex, stopId) => {
        const previousTrip = get().currentTrip;
        try {
            const response = await api.delete(`/trips/${tripId}/days/${dayIndex}/stops/${stopId}`);
            set((state) => ({
                currentTrip: response.data,
                undoStack: [...state.undoStack, {
                    type: 'REMOVE_STOP',
                    tripId,
                    dayIndex,
                    data: { stopId },
                    previousState: previousTrip,
                }],
                redoStack: [],
            }));
        } catch (error: any) {
            await syncQueue.add({
                method: 'DELETE',
                url: `/trips/${tripId}/days/${dayIndex}/stops/${stopId}`,
            });
            set({ error: error.message });
        }
    },

    reorderStops: async (tripId, dayIndex, stopOrder) => {
        const previousTrip = get().currentTrip;
        try {
            const response = await api.put(`/trips/${tripId}/days/${dayIndex}/reorder`, { stopOrder });
            set((state) => ({
                currentTrip: response.data,
                undoStack: [...state.undoStack, {
                    type: 'REORDER_STOPS',
                    tripId,
                    dayIndex,
                    data: { stopOrder },
                    previousState: previousTrip,
                }],
                redoStack: [],
            }));
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    addCollaborator: async (tripId, userId) => {
        try {
            const response = await api.post(`/trips/${tripId}/collaborators`, { userId });
            set({ currentTrip: response.data });
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    // Command pattern: undo (FR-04)
    undo: async () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return;

        const command = undoStack[undoStack.length - 1];
        const currentTrip = get().currentTrip;

        try {
            // Restore previous state
            if (command.previousState) {
                const response = await api.put(`/trips/${command.tripId}`, command.previousState);
                set((state) => ({
                    currentTrip: response.data,
                    undoStack: state.undoStack.slice(0, -1),
                    redoStack: [...state.redoStack, { ...command, previousState: currentTrip }],
                }));
            }
        } catch (error) {
            console.error('Undo failed:', error);
        }
    },

    // Command pattern: redo (FR-04)
    redo: async () => {
        const { redoStack } = get();
        if (redoStack.length === 0) return;

        const command = redoStack[redoStack.length - 1];
        const currentTrip = get().currentTrip;

        try {
            if (command.previousState) {
                const response = await api.put(`/trips/${command.tripId}`, command.previousState);
                set((state) => ({
                    currentTrip: response.data,
                    redoStack: state.redoStack.slice(0, -1),
                    undoStack: [...state.undoStack, { ...command, previousState: currentTrip }],
                }));
            }
        } catch (error) {
            console.error('Redo failed:', error);
        }
    },

    // Observer pattern: subscribe to real-time Firebase updates (FR-20)
    subscribeTripUpdates: (tripId) => {
        const tripRef = ref(database, `trips/${tripId}`);
        const listener = onValue(tripRef, async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Re-fetch trip from MongoDB for full data
                get().fetchTrip(tripId);
            }
        });

        return () => off(tripRef, 'value', listener);
    },
}));
