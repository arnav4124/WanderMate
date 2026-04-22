import { Platform } from 'react-native';

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

const DEFAULT_API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.25.82.240:5001/api'
  : 'http://localhost:5001/api';

// Set EXPO_PUBLIC_API_BASE_URL for physical device testing, e.g. http://192.168.1.10:5001/api
export const API_BASE_URL = 'http://10.25.82.240:5000/api'

export const GOOGLE_WEB_CLIENT_ID = '483835352991-ivhlte3v6mj8d8nkkkof1gfouncveu3b.apps.googleusercontent.com';