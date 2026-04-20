import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from './env';

// Singleton pattern: initialize Firebase once
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

// Auth with AsyncStorage persistence (FR-23: sessions persist across app restarts)
const auth = (() => {
    if (Platform.OS === 'web') {
        return getAuth(app);
    }

    try {
        return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
        });
    } catch {
        return getAuth(app);
    }
})();

const database = getDatabase(app);

export { app, auth, database };
