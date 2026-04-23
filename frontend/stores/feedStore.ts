import { create } from 'zustand';
import api from '../services/api';
import { FeedPost } from '../types';
import { syncQueue } from '../services/syncQueue';

interface FeedState {
    posts: FeedPost[];
    isLoading: boolean;
    page: number;
    totalPages: number;
    feedType: 'discover' | 'following';

    fetchFeed: (type?: 'discover' | 'following', page?: number) => Promise<void>;
    loadMore: () => Promise<void>;
    likePost: (postId: string) => Promise<void>;
    cloneTrip: (postId: string) => Promise<string | null>;
    publishTrip: (tripId: string) => Promise<void>;
    setFeedType: (type: 'discover' | 'following') => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
    posts: [],
    isLoading: false,
    page: 1,
    totalPages: 1,
    feedType: 'discover',

    fetchFeed: async (type, page = 1) => {
        const feedType = type || get().feedType;
        set({ isLoading: true });
        try {
            const response = await api.get('/feed', {
                params: { type: feedType === 'following' ? 'following' : undefined, page, limit: 10 },
            });
            set({
                posts: page === 1 ? response.data.posts : [...get().posts, ...response.data.posts],
                page: response.data.page,
                totalPages: response.data.totalPages,
                isLoading: false,
                feedType,
            });
        } catch (error: any) {
            console.error('Feed fetch error:', error);
            set({ isLoading: false });
        }
    },

    loadMore: async () => {
        const { page, totalPages, feedType } = get();
        if (page < totalPages) {
            await get().fetchFeed(feedType, page + 1);
        }
    },

    likePost: async (postId) => {
        try {
            const response = await api.post(`/feed/${postId}/like`);
            set((state) => ({
                posts: state.posts.map(p =>
                    p._id === postId
                        ? { ...p, likeCount: response.data.likeCount, liked: response.data.liked }
                        : p
                ),
            }));
        } catch (error) {
            await syncQueue.add({ method: 'POST', url: `/feed/${postId}/like` });
            console.error('Like error (queued offline):', error);
        }
    },

    cloneTrip: async (postId) => {
        try {
            const response = await api.post(`/feed/${postId}/clone`);
            return response.data._id;
        } catch (error) {
            console.error('Clone error:', error);
            return null;
        }
    },

    publishTrip: async (tripId) => {
        try {
            await api.post(`/feed/publish/${tripId}`);
        } catch (error) {
            await syncQueue.add({ method: 'POST', url: `/feed/publish/${tripId}` });
            console.error('Publish error (queued offline):', error);
        }
    },

    setFeedType: (type) => {
        set({ feedType: type, posts: [], page: 1 });
        get().fetchFeed(type, 1);
    },
}));
