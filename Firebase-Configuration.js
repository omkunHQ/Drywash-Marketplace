
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // Import GoogleAuthProvider
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js"; // Optional: for Analytics

// TODO: Replace with your web app's Firebase configuration
// Get these details from your Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyCxVmGqlbomo47KqXZm4S8QqfL3bXZN6pg",
  authDomain: "drywash-7d086.firebaseapp.com",
  projectId: "drywash-7d086",
  storageBucket: "drywash-7d086.firebasestorage.app",
  messagingSenderId: "850083946512",
  appId: "1:850083946512:web:f0ae239d283abd1dffaa95",
  measurementId: "G-TLPBTQ31KT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Optional: Initialize Analytics

// Initialize core Firebase services
const auth = getAuth(app); // Firebase Authentication
const db = getFirestore(app); // Firestore Database
const googleProvider = new GoogleAuthProvider(); // Google Sign-in Provider

// Export the services so other files can use them
export { auth, db, googleProvider };
