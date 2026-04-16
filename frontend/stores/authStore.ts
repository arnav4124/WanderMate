import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
    firebaseUser: FirebaseUser | null;
    profile: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setFirebaseUser: (user: FirebaseUser | null) => void;
    fetchProfile: () => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    firebaseUser: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,

    setFirebaseUser: (user) => {
        set({
            firebaseUser: user,
            isAuthenticated: !!user,
            isLoading: false,
        });
    },

    fetchProfile: async () => {
        try {
            const response = await api.get('/users/me');
            set({ profile: response.data });
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    },

    signOut: async () => {
        try {
            await firebaseSignOut(auth);
            set({ firebaseUser: null, profile: null, isAuthenticated: false });
        } catch (error) {
            console.error('Sign out error:', error);
        }
    },

    // Observer pattern: Firebase auth state listener
    initialize: () => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            set({
                firebaseUser: user,
                isAuthenticated: !!user,
                isLoading: false,
            });
            if (user) {
                get().fetchProfile();
            } else {
                set({ profile: null });
            }
        });
        return unsubscribe;
    },
}));
