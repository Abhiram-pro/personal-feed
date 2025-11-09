import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration from GoogleService-Info.plist
const firebaseConfig = {
  apiKey: "AIzaSyDzygKAt9WL6MkxGo9uXTJ2ZV4zxwl4WxQ",
  authDomain: "beeepic-d4f01.firebaseapp.com",
  projectId: "beeepic-d4f01",
  storageBucket: "beeepic-d4f01.firebasestorage.app",
  messagingSenderId: "210230765100",
  appId: "1:210230765100:ios:d6a8a01ec2fa5089d05389",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Cloud Functions (default region: us-central1)
const functions = getFunctions(app, 'us-central1');

// Optionally connect to emulator in development
if (__DEV__ && process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === 'true') {
  const host = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST || 'localhost';
  const port = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);
  connectFunctionsEmulator(functions, host, port);
}

export { auth, db, functions };
export default app;
