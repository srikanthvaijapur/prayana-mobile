// firebase.ts - Firebase initialization for React Native (Expo managed workflow)
// Uses Firebase JS SDK with AsyncStorage persistence (NOT @react-native-firebase)

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration - same project as the web app (prayanaai-b0c73)
const firebaseConfig = {
  apiKey: 'AIzaSyAa4KIws7SWD5wWOzA5vBQjAz7NytyJtT0',
  authDomain: 'prayanaai-b0c73.firebaseapp.com',
  projectId: 'prayanaai-b0c73',
  storageBucket: 'prayanaai-b0c73.firebasestorage.app',
  messagingSenderId: '629033939569',
  appId: '1:629033939569:web:2230021e5f3503e27461d0',
  measurementId: 'G-Z6C7GKF46K',
};

// Initialize Firebase app (singleton - prevent re-initialization on hot reload)
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with React Native AsyncStorage persistence.
// This keeps the user signed in across app restarts.
// NOTE: We must use initializeAuth (not getAuth) to set persistence in React Native.
// Calling getAuth() after initializeAuth() on the same app instance is safe and
// returns the already-initialized auth instance.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error: any) {
  // If auth was already initialized (e.g., hot reload), just get the existing instance.
  // initializeAuth throws if called twice on the same app.
  if (error.code === 'auth/already-initialized') {
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
  } else {
    throw error;
  }
}

export { app, auth };
