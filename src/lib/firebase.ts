import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyC299MIplaieO8ojdr8Carna4qOwIF6uIY",
  authDomain: "ml2-master-game.firebaseapp.com",
  projectId: "ml2-master-game",
  storageBucket: "ml2-master-game.firebasestorage.app",
  messagingSenderId: "1031209894901",
  appId: "1:1031209894901:web:2cfceb5e7eecb9f2cd56bc"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
// Restrict to specific domain (uncomment for production)
// googleProvider.setCustomParameters({ hd: 'uai.cl' });

// Login with Google (required for this game)
export const loginWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

// Sign out
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

// Auth state observer helper
export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// Check if user is enrolled in a course (helper)
export const isEmailFromDomain = (email: string | null, domain: string): boolean => {
  if (!email) return false;
  return email.endsWith(`@${domain}`);
};
