import { create } from 'zustand';

interface ActiveTripState {
    activeTripId: string | null;
    activeDayIndex: number;
    setActiveTrip: (tripId: string) => void;
    setActiveDay: (dayIndex: number) => void;
    clearActiveTrip: () => void;
}

export const useActiveTripStore = create<ActiveTripState>((set) => ({
    activeTripId: null,
    activeDayIndex: 0,
    setActiveTrip: (tripId: string) => set({ activeTripId: tripId, activeDayIndex: 0 }),
    setActiveDay: (dayIndex: number) => set({ activeDayIndex: dayIndex }),
    clearActiveTrip: () => set({ activeTripId: null, activeDayIndex: 0 }),
}));
