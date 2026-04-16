import axios from 'axios';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/env';

/**
 * Singleton API client with JWT token injection
 * All API calls proxied through backend gateway (NFR-11)
 */
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach Firebase JWT token
api.interceptors.request.use(async (config) => {
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
        const message = error.response?.data?.error || error.message || 'Network error';
        console.error('API Error:', message);
        return Promise.reject(new Error(message));
    }
);

export default api;
