import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBelv06gvLFT43yeBtH0x3Elij0t7gZtsE",
  authDomain: "vidya-share-30112.firebaseapp.com",
  projectId: "vidya-share-30112",
  storageBucket: "vidya-share-30112.firebasestorage.app",
  messagingSenderId: "899340443248",
  appId: "1:899340443248:web:e48e2fabf365dc2aab9eb5",
  measurementId: "G-32DZ4DQQV7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export instances for use in components
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export { analytics };
