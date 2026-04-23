import axios from 'axios';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/env';

/**
 * Singleton API client with JWT token injection
 * All API calls proxied through backend gateway (NFR-11)
 */
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 35000, // Increased timeout to prevent dropping slow route optimizations
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach Firebase JWT token
api.interceptors.request.use(async (config) => {
    // Prevent early unauthenticated requests while persisted auth is being restored.
    if (typeof (auth as any).authStateReady === 'function') {
        await (auth as any).authStateReady();
    }

    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response interceptor: structured error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message || 'Network error';

        if (!(status === 401 && !auth.currentUser)) {
            console.error('API Error:', message);
        }

        return Promise.reject(new Error(message));
    }
);

export default api;
