/* js/main.js
 * User App router with Session Storage Auth Check & Duplicate Functions Removed
 */

// Firebase services
import { db, auth } from '../Firebase-Configuration.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const contentArea = document.getElementById('page-content-wrapper');
const allNavLinks = document.querySelectorAll('.bottom-nav button');

// --- Global App State ---
export let currentUser = null;
export let userLocation = null;
export let userLocationText = "Loading location...";
let currentParams = {};
let authCheckPromiseResolver = null;
let authCheckResolved = false; // Flag to track if initial auth check completed

// Promise that resolves once the initial onAuthStateChanged has run
const authCheckCompleted = new Promise(resolve => {
    authCheckPromiseResolver = () => {
        if (!authCheckResolved) { // Resolve only once
            authCheckResolved = true;
            resolve();
            console.log("Initial authentication check promise resolved.");
        }
    };
});
// Add a helper property (optional, for easier checking elsewhere if needed)
authCheckCompleted.isResolved = () => authCheckResolved;


// --- Session Storage Check on Load ---
let isPotentiallyLoggedIn = sessionStorage.getItem('userLoggedIn') === 'true';
console.log("Initial check from sessionStorage: isPotentiallyLoggedIn =", isPotentiallyLoggedIn);

// --- Page Routes ---
const routes = {
    '#home':           { file: 'pages/home.html',          title: 'Home',          script: 'js/pages/home.js', protected: false },
    '#stores':         { file: 'pages/stores.html',        title: 'Stores',        script: 'js/pages/store.js', protected: false },
    '#store-details':  { file: 'pages/store-details.html', title: 'Store Details', script: 'js/pages/store.js', protected: false },
    '#order-history':  { file: 'pages/order-history.html', title: 'My Orders',     script: 'js/pages/order-history.js', protected: true }, // Protected
    '#profile':        { file: 'pages/profile.html',       title: 'My Account',    script: 'js/pages/profile.js', protected: false }, // Login/Signup page itself isn't protected
    '#order-request':  { file: 'pages/order-request.html', title: 'Place Request', script: 'js/pages/order-request.js', protected: true }, // Protected
    '#manage-addresses': { file: 'pages/manage-addresses.html', title: 'My Addresses', script: 'Js/pages/manage-address.js', protected: true }, // Protected
    '#help':           { file: 'pages/help.html',          title: 'Help',          script: 'js/pages/help.js', protected: false }
};

/**
 * MAIN ROUTER FUNCTION: Loads page HTML and associated JS.
 */
async function loadPage(hash) {
    const routeKey = hash.split('?')[0] || '#home'; // Get key like #home, #profile
    const route = routes[routeKey] || routes['#home']; // Find route details or default to home

    console.log(`loadPage called for routeKey: ${routeKey}`);

    // Ensure content area exists before proceeding
    if (!contentArea) {
        console.error("Fatal Error: #page-content-wrapper not found! Cannot load pages.");
        document.body.innerHTML = '<p style="color: red; padding: 20px;"><b>Application Error:</b> Core page container is missing.</p>';
        return;
    }
    // Clear content area immediately *before* auth checks
    contentArea.innerHTML = '';

    // --- Authentication Protection Logic ---
    if (route.protected) {
        // 1. Quick check using sessionStorage: If definitely logged out, redirect.
        if (!isPotentiallyLoggedIn) {
            console.log(`Protected route ${routeKey} - SessionStorage=false. Redirecting to profile.`);
            navigateTo('profile');
            return; // Stop loading this page
        }

        // 2. Wait for the definitive Firebase auth check if it hasn't completed yet.
        if (!authCheckCompleted.isResolved()) {
             console.log(`Protected route ${routeKey} - Waiting for initial Firebase auth check...`);
             // Show Full Page Spinner WHILE waiting
             contentArea.innerHTML = `<div class="flex justify-center items-center h-screen"> <i class="fas fa-spinner fa-spin text-primary-blue text-3xl"></i> </div>`;
             await authCheckCompleted; // Wait here
             console.log("Initial Firebase auth check finished. Proceeding...");
             // Spinner will be replaced by actual page content below
        }

        // 3. Final Check: After waiting (or if check was already done), verify currentUser.
        if (!currentUser) {
            console.log(`Protected route ${routeKey} - Firebase confirmed user is logged OUT after wait/check. Redirecting to profile.`);
             sessionStorage.removeItem('userLoggedIn');
             isPotentiallyLoggedIn = false;
            navigateTo('profile');
            return; // Stop loading this page
        }
        // User is confirmed logged in.
        console.log(`Access granted for protected route ${routeKey}. User verified.`);
         // Show simple loading text before fetching HTML
         contentArea.innerHTML = `<div class="p-4 text-center text-slate-500">Loading ${route.title}...</div>`;

    } else {
         // For non-protected routes, show simple loading text immediately
         contentArea.innerHTML = `<div class="p-4 text-center text-slate-500">Loading ${route.title}...</div>`;
    }
    // --- End Authentication Protection ---

    updateActiveLinks(routeKey);
    document.title = `${route.title} - Drywash`;

    // --- Fetch and Load Page Content ---
    try {
        console.log(`Fetching HTML: ./${route.file}`);
        const response = await fetch(`./${route.file}`); // Path relative to index.html
        if (!response.ok) throw new Error(`Page HTML not found: ${route.file} (Status: ${response.status})`);
        const html = await response.text();

        // Inject HTML (replaces spinner or loading text)
        if (contentArea) contentArea.innerHTML = html; else return;

        // --- Load and Run Page Script ---
        if (route.script) {
            const modulePath = `/${route.script}?v=${new Date().getTime()}`; // JS path relative to root
            console.log("Attempting to dynamically import module:", modulePath);
            try {
                const module = await import(modulePath);
                if (module && typeof module.init === 'function') {
                    console.log(`Calling init for ${routeKey}. User object being passed:`, currentUser ? currentUser.uid : 'null');
                    // Pass the confirmed currentUser object
                    module.init(hash, currentParams, currentUser);
                } else {
                    console.warn(`Module loaded for ${route.script}, but init function is missing or not exported.`);
                }
            } catch (importError) {
                 console.error(`Failed to import or run script: ${modulePath}`, importError);
                 if (contentArea) contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Script</h3><p>${importError.message}</p></div>`;
            }
        } else {
             console.log(`No script defined for route: ${routeKey}`);
        }

    } catch (error) { // Catch errors during HTML fetch
        console.error('Error loading page HTML:', error);
        if (contentArea) contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Page</h3><p>${error.message}</p></div>`;
    }
} // End loadPage

// --- Helper Functions (Defined ONLY ONCE Below) ---

function updateActiveLinks(routeKey) {
    const pageId = routeKey.substring(1);
    allNavLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
}

export function navigateTo(pageId, params = {}) {
    console.log(`MapsTo called for page: ${pageId}, with params:`, JSON.stringify(params));
    currentParams = params;
    let hash = `#${pageId}`;
    if (params && Object.keys(params).length > 0) {
        hash += `?${new URLSearchParams(params).toString()}`;
    }
    console.log(`Setting window.location.hash to: ${hash}`);
    if (hash !== window.location.hash) {
        window.location.hash = hash;
    } else {
        console.log("Hash is the same, manually calling loadPage for:", hash.split('?')[0] || '#home');
        loadPage(hash.split('?')[0] || '#home');
    }
}
window.navigateTo = navigateTo;
window.goBack = () => window.history.back();

// --- Location Helper Functions ---
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function updateLocationText(text) {
    requestAnimationFrame(() => {
        const locationTextEl = document.getElementById('current-location-text');
        if (locationTextEl) {
            locationTextEl.textContent = text;
        }
    });
}

async function fetchAddressFromCoords(lat, lng) {
    userLocationText = "Fetching address...";
    updateLocationText(userLocationText);
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error(`Nominatim API request failed: ${response.status}`);
        const data = await response.json();
        console.log("Nominatim API response:", data);
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state_district || "";
            const state = data.address.state || "";
            let formattedAddress = city;
            if (state && city && city !== state) formattedAddress = `${city}, ${state}`;
            else if (state) formattedAddress = state;
            userLocationText = formattedAddress || data.display_name || "Address details unclear.";
        } else if (data.display_name) {
             userLocationText = data.display_name;
             console.warn("Could not parse city/state, using display_name.");
        } else {
            userLocationText = "Address format unknown.";
            console.warn("Nominatim response missing address details and display_name.");
        }
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        userLocationText = "Could not fetch address.";
    }
    updateLocationText(userLocationText);
}

async function getUserLocation() {
    userLocationText = "Fetching location...";
    updateLocationText(userLocationText);
    if (navigator.geolocation) {
        console.log("Attempting to get user location...");
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log(`Geolocation success: Lat ${lat}, Lng ${lng}`);
                userLocation = { lat: lat, lng: lng };
                await fetchAddressFromCoords(lat, lng);
                const currentHash = (window.location.hash || '#home').split('?')[0];
                if (currentHash === '#home' || currentHash === '#stores') {
                     console.log("Reloading page after location obtained:", currentHash);
                     loadPage(currentHash);
                }
            },
            (error) => { // Error callback
                 console.warn(`Geolocation error (${error.code}): ${error.message}`);
                 userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback
                 if(error.code === 1) userLocationText = "Location denied. Using default.";
                 else userLocationText = "Could not get location.";
                 updateLocationText(userLocationText);
                 const currentHash = (window.location.hash || '#home').split('?')[0];
                  if (currentHash === '#home' || currentHash === '#stores') {
                     console.log("Reloading page with fallback location:", currentHash);
                     loadPage(currentHash);
                  }
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 } // Options
        );
    } else { // Geolocation not supported
        console.warn("Geolocation is not supported by this browser.");
        userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback
        userLocationText = "Geolocation not supported.";
        updateLocationText(userLocationText);
        const currentHash = (window.location.hash || '#home').split('?')[0];
         if (currentHash === '#home' || currentHash === '#stores') {
            console.log("Reloading page (no geolocation support):", currentHash);
            loadPage(currentHash);
         }
    }
}
// --- END Location Helper Functions ---


// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    const previousUser = currentUser;
    console.log("Firebase onAuthStateChanged triggered. User:", user ? user.uid : 'None');
    if (user) { // User is authenticated
        const userRef = doc(db, "users", user.uid);
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUser = { uid: user.uid, ...userSnap.data() };
            } else { // Create user doc if missing
                console.warn(`User ${user.uid} authenticated but Firestore document missing. Creating...`);
                const newUserDoc = { name: user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL || "", mobile: "", address: "", createdAt: new Date() };
                await setDoc(userRef, newUserDoc);
                currentUser = { uid: user.uid, ...newUserDoc };
            }
            console.log("User authenticated:", currentUser?.email);
            sessionStorage.setItem('userLoggedIn', 'true'); // Update session storage
            isPotentiallyLoggedIn = true;
        } catch (dbError) { // Handle DB errors during auth check
             console.error("Error accessing user document during auth check:", dbError);
             currentUser = null;
             sessionStorage.removeItem('userLoggedIn');
             isPotentiallyLoggedIn = false;
        }
    } else { // User is logged out
        currentUser = null;
        console.log("User is logged out.");
        sessionStorage.removeItem('userLoggedIn');
        isPotentiallyLoggedIn = false;
    }

    // Resolve the auth check promise ONCE after the first check completes
    if (authCheckPromiseResolver) {
        authCheckPromiseResolver(); // Signal that the check is done
        authCheckPromiseResolver = null; // Prevent resolving again
    }

    // --- Post-Authentication Reload/Redirect Logic ---
    const activePageKey = (window.location.hash || '#home').split('?')[0];
    const routeInfo = routes[activePageKey];

    // If user explicitly logs OUT while on a protected page, redirect
    if (previousUser && !currentUser && routeInfo?.protected) {
        console.log(`User logged out while on protected page (${activePageKey}). Redirecting to profile.`);
        navigateTo('profile');
    }
    // If user logs IN or OUT and is currently on the profile page, reload it
    else if (activePageKey === '#profile' && previousUser !== currentUser) {
         console.log(`User auth state changed while on profile page. Reloading profile.`);
         loadPage('#profile');
    }
});


// --- App Initialization (Event Listeners) ---

// Listen for hash changes (back/forward buttons, manual URL changes)
window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '#home').split('?')[0]; // Clean hash
    console.log("hashchange event detected. Loading page for:", hash);
    loadPage(hash); // Call the main router function
});

// Run when the initial HTML document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event. Initializing app...");

    // Setup bottom navigation button clicks to use navigateTo
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            const pageId = link.dataset.page;
             console.log(`Bottom nav clicked: ${pageId}`);
            navigateTo(pageId); // Use navigateTo to handle hash change and params
        });
    });

    // Start fetching user location early (don't wait for it)
    getUserLocation();

    // Load the initial page based on the current URL hash
    // The loadPage function itself will now wait for the initial auth check if needed
    const initialHash = (window.location.hash || '#home').split('?')[0]; // Clean initial hash
    console.log("Initial page load for hash:", initialHash);
    loadPage(initialHash);
});
