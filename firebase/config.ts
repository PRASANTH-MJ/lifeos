import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence exists at runtime in the RN bundle of firebase/auth
// but isn't included in its web-facing type definitions; a known, documented mismatch.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyDS9UkjSxl6x1RV-mzWMvR7l5PZ7OVPVq8',
  authDomain: 'lifeos-8f0bf.firebaseapp.com',
  projectId: 'lifeos-8f0bf',
  storageBucket: 'lifeos-8f0bf.firebasestorage.app',
  messagingSenderId: '537711771675',
  appId: '1:537711771675:web:638e0567e003a83d2078be',
};

const app = initializeApp(firebaseConfig);

function resolvePersistence() {
  return Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage);
}

export const auth = initializeAuth(app, { persistence: resolvePersistence() });

export const firestore = getFirestore(app);
export const functions = getFunctions(app);
