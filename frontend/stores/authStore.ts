import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../services/api';
import { syncQueue } from '../services/syncQueue';
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
    followUser: (uid: string) => Promise<void>;
    unfollowUser: (uid: string) => Promise<void>;
    acceptFollowRequest: (uid: string) => Promise<void>;
    denyFollowRequest: (uid: string) => Promise<void>;
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
            await syncQueue.clear();
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

    followUser: async (uid: string) => {
        try {
            const response = await api.post(`/users/${uid}/follow`);
            set((state) => ({
                profile: state.profile ? { ...state.profile, following: response.data.following, pendingFollowing: response.data.pendingFollowing } : null
            }));
        } catch (error) {
            console.error('Follow error:', error);
        }
    },

    unfollowUser: async (uid: string) => {
        try {
            const response = await api.post(`/users/${uid}/unfollow`);
            set((state) => ({
                profile: state.profile ? { ...state.profile, following: response.data.following, pendingFollowing: response.data.pendingFollowing } : null
            }));
        } catch (error) {
            console.error('Unfollow error:', error);
        }
    },

    acceptFollowRequest: async (uid: string) => {
        try {
            const response = await api.post(`/users/${uid}/accept-follow`);
            set((state) => ({
                profile: state.profile ? { ...state.profile, followRequests: response.data.followRequests, followers: response.data.followers } : null
            }));
        } catch (error) {
            console.error('Accept follow error:', error);
        }
    },

    denyFollowRequest: async (uid: string) => {
        try {
            const response = await api.post(`/users/${uid}/deny-follow`);
            set((state) => ({
                profile: state.profile ? { ...state.profile, followRequests: response.data.followRequests } : null
            }));
        } catch (error) {
            console.error('Deny follow error:', error);
        }
    }
}));
