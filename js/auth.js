import { auth, db, googleProvider } from '../Firebase-Configuration.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let isLoginMode = false;

// Function to toggle between Login and Sign Up
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const authTitle = document.getElementById('auth-title');
    const mainAuthBtn = document.getElementById('main-auth-btn');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');

    if (authTitle) authTitle.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    if (mainAuthBtn) mainAuthBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
    if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = isLoginMode ? "Don't have an account? Sign Up" : 'Already have an account? Sign In';
}

// Function to handle Email/Password Auth
async function handleEmailAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        if (isLoginMode) {
            // Sign In
            await signInWithEmailAndPassword(auth, email, password);
            alert("Signed in successfully!");
        } else {
            // Sign Up
            await createUserWithEmailAndPassword(auth, email, password);
            alert("Account created successfully!");
        }
    } catch (error) {
        console.error("Auth Error: ", error);
        alert(`Error: ${error.message}`);
    }
}

// Function to handle Google Sign-In
export async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
        alert("Signed in with Google successfully!");
    } catch (error) {
        console.error("Google Sign-In Error: ", error);
        alert(`Error: ${error.message}`);
    }
}

// Function to handle Logout
export async function handleLogout() {
    try {
        await signOut(auth);
        alert("Logged out successfully.");
    } catch (error) {
        console.error("Logout Error: ", error);
    }
}

// Initialize listeners for the auth page
export function initAuth() {
    window.signInWithGoogle = signInWithGoogle; 
    
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const emailForm = document.getElementById('email-auth-form');

    if(toggleBtn) toggleBtn.onclick = toggleAuthMode;
    if(emailForm) emailForm.onsubmit = handleEmailAuth;
}