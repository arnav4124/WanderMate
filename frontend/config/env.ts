import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAd4PVuFTGHhJ1fWY4vISZ_aaIUcAo8KQM",
  authDomain: "wandermate-68a9d.firebaseapp.com",
  databaseURL: "https://wandermate-68a9d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wandermate-68a9d",
  storageBucket: "wandermate-68a9d.firebasestorage.app",
  messagingSenderId: "483835352991",
  appId: "1:483835352991:web:44babb075b3b1c5eb70faa",
  measurementId: "G-FDFZ1ENBB7"
};

const API_PORT = '5001';

const getHostFromValue = (value?: string | null) => {
  if (!value) return null;

  if (value.includes('://')) {
    try {
      return new URL(value).hostname;
    } catch {
      return null;
    }
  }

  return value.split(':')[0] || null;
};

const getExpoHost = () => {
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (NativeModules as any).SourceCode?.scriptURL,
  ];

  for (const candidate of hostCandidates) {
    const host = getHostFromValue(candidate);
    if (host) return host;
  }

  return null;
};

const DEFAULT_API_BASE_URL = Platform.OS === 'android'
  ? `http://10.0.2.2:${API_PORT}/api`
  : `http://127.0.0.1:${API_PORT}/api`;

const AUTO_DETECTED_DEVICE_API_BASE_URL = (() => {
  const host = getExpoHost();
  if (!host) return null;

  if (Constants.isDevice && (host === 'localhost' || host === '127.0.0.1')) {
    return null;
  }

  return host ? `http://${host}:${API_PORT}/api` : null;
})();

export const API_BASE_URL = AUTO_DETECTED_DEVICE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const GOOGLE_WEB_CLIENT_ID = '483835352991-ivhlte3v6mj8d8nkkkof1gfouncveu3b.apps.googleusercontent.com';
