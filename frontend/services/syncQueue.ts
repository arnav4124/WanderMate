import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

/**
 * Offline Sync Queue
 * Implements offline-first pattern (FR-03, NFR-07)
 * Queues mutations when offline, flushes on reconnect
 */

interface QueuedAction {
    id: string;
    method: 'POST' | 'PUT' | 'DELETE';
    url: string;
    data?: any;
    timestamp: number;
}

const QUEUE_KEY = '@wandermate_sync_queue';

export const syncQueue = {
    async add(action: Omit<QueuedAction, 'id' | 'timestamp'>): Promise<void> {
        const queue = await this.getAll();
        queue.push({
            ...action,
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
        });
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    },

    async getAll(): Promise<QueuedAction[]> {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    },

    async flush(): Promise<{ success: number; failed: number }> {
        const queue = await this.getAll();
        if (queue.length === 0) return { success: 0, failed: 0 };

        // Sort by timestamp to maintain operation order
        queue.sort((a, b) => a.timestamp - b.timestamp);

        let success = 0;
        let failed = 0;
        const remaining: QueuedAction[] = [];

        for (const action of queue) {
            try {
                switch (action.method) {
                    case 'POST':
                        await api.post(action.url, action.data);
                        break;
                    case 'PUT':
                        await api.put(action.url, action.data);
                        break;
                    case 'DELETE':
                        await api.delete(action.url);
                        break;
                }
                success++;
            } catch (error) {
                console.warn('Sync failed for action:', action.id, error);
                remaining.push(action);
                failed++;
            }
        }

        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
        return { success, failed };
    },

    async clear(): Promise<void> {
        await AsyncStorage.removeItem(QUEUE_KEY);
    },

    async count(): Promise<number> {
        const queue = await this.getAll();
        return queue.length;
    },
};

/**
 * Local cache for offline reading (Cache-Aside pattern)
 */
export const localCache = {
    async set(key: string, data: any): Promise<void> {
        await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify({
            data,
            cachedAt: Date.now(),
        }));
    },

    async get<T>(key: string, maxAgeMs: number = 3600000): Promise<T | null> {
        const raw = await AsyncStorage.getItem(`@cache_${key}`);
        if (!raw) return null;

        const { data, cachedAt } = JSON.parse(raw);
        if (Date.now() - cachedAt > maxAgeMs) return null;

        return data as T;
    },

    async remove(key: string): Promise<void> {
        await AsyncStorage.removeItem(`@cache_${key}`);
    },
};
