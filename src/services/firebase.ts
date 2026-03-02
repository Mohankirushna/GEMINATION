import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (only once, even with HMR)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let analytics: Analytics | null = null;

export const initializeFirebase = (): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  analytics: Analytics | null;
} => {
  // Check if Firebase is already initialized
  const existingApps = getApps();

  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    // Validate required config values
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('Firebase configuration is incomplete. Please check your .env.local file.');
    }
    app = initializeApp(firebaseConfig);
  }

  // Initialize services
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Initialize Analytics only if measurementId is provided
  if (firebaseConfig.measurementId) {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  }

  return { app, auth, db, storage, analytics };
};

// Export initialized services (call initializeFirebase first)
export const getAuthInstance = (): Auth | null => auth;
export const getDbInstance = (): Firestore | null => db;
export const getStorageInstance = (): FirebaseStorage | null => storage;
export const getAppInstance = (): FirebaseApp | null => app;
export const getAnalyticsInstance = (): Analytics | null => analytics;

// Helper to check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
};
