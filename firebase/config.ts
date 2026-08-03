import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence exists at runtime in the RN bundle of firebase/auth
// but isn't included in its web-facing type definitions; a known, documented mismatch.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

// TODO(user): replace with your Firebase project's "Web app" config, from
// Firebase Console → Project settings → General → Your apps → Web app.
// Nothing below this line will actually authenticate until this is filled in.
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);

function resolvePersistence() {
  return Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage);
}

export const auth = initializeAuth(app, { persistence: resolvePersistence() });

export const firestore = getFirestore(app);
export const functions = getFunctions(app);
