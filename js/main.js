/* js/main.js
 * User App router
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
export let userLocationText = "Loading location..."; // Default Text
let currentParams = {};

// --- Page Routes ---
const routes = {
    '#home':           { file: 'pages/home.html',          title: 'Home',          script: 'js/pages/home.js' },
    '#stores':         { file: 'pages/stores.html',        title: 'Stores',        script: 'js/pages/store.js' }, // Ensure this points to store.js
    '#store-details':  { file: 'pages/store-details.html', title: 'Store Details', script: 'js/pages/store.js' }, // This also points to store.js
    '#order-history':  { file: 'pages/order-history.html', title: 'My Orders',     script: 'js/pages/order-history.js' },
    '#profile':        { file: 'pages/profile.html',       title: 'My Account',    script: 'js/pages/profile.js' },
    '#order-request':  { file: 'pages/order-request.html', title: 'Place Request', script: 'js/pages/order-request.js' },
    '#manage-addresses': { file: 'pages/manage-addresses.html', title: 'My Addresses', script: 'js/pages/manage-address.js' },
    '#help':           { file: 'pages/help.html',          title: 'Help',          script: null }
};

/**
 * MAIN ROUTER FUNCTION
 */
async function loadPage(hash) {
    // Hash se parameters alag karein (e.g., #store-details?storeId=XYZ -> #store-details)
    const routeKey = hash.split('?')[0] || '#home';
    const route = routes[routeKey] || routes['#home']; // Default route #home

    // Check if main content area exists
    if (!contentArea) {
        console.error("Fatal Error: #page-content-wrapper not found in index.html! Cannot load pages.");
        // Optionally display an error message to the user, though the page structure is broken
        document.body.innerHTML = '<p style="color: red; padding: 20px;"><b>Application Error:</b> Core page container is missing. Please check index.html.</p>';
        return; // Stop execution if the main container is missing
    }
    contentArea.innerHTML = `<div class="p-4 text-center text-slate-500">Loading...</div>`;


    updateActiveLinks(routeKey);
    document.title = `${route.title} - Drywash`;

    try {
        // Fetch HTML using a path relative to index.html's location
        const response = await fetch(`./${route.file}`); // e.g., ./pages/home.html
        if (!response.ok) throw new Error(`Page HTML not found: ${route.file} (Status: ${response.status})`);
        const html = await response.text();

        // Check again if contentArea exists before inserting HTML
        if (contentArea) {
            contentArea.innerHTML = html;
        } else {
             console.error("Fatal Error: #page-content-wrapper disappeared while loading content.");
             return;
        }


        // Load and execute page-specific JavaScript if defined
        if (route.script) {
            // **Corrected Path:** Build path relative to the root '/'
            const modulePath = `/${route.script}?v=${new Date().getTime()}`; // e.g., /Js/pages/home.js?v=...

            console.log("Attempting to import module:", modulePath); // Debug log

            try {
                const module = await import(modulePath);
                if (module && typeof module.init === 'function') {
                    // Pass the original hash (with params) and the saved params object
                    console.log(`Calling init for ${routeKey} with hash: ${hash} and currentParams:`, JSON.stringify(currentParams)); // Debug log
                    module.init(hash, currentParams);
                } else {
                     console.warn(`Module loaded for ${route.script}, but init function not found or not exported.`);
                }
            } catch (importError) {
                 console.error(`Failed to import module: ${modulePath}`, importError);
                 if (contentArea) {
                     contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Page Script</h3><p>Could not load: ${route.script}</p><p>${importError.message}</p></div>`;
                 }
            }
        } else {
             console.log(`No script defined for route: ${routeKey}`); // Debug log for routes without scripts
        }

    } catch (error) {
        console.error('Error loading page HTML:', error);
         if (contentArea) {
            contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Page</h3><p>${error.message}</p></div>`;
         }
    }
}

// --- Helper Functions ---

function updateActiveLinks(routeKey) {
    const pageId = routeKey.substring(1);
    allNavLinks.forEach(link => {
        const linkPageId = link.dataset.page;
        link.classList.toggle('active', linkPageId === pageId);
    });
}

export function navigateTo(pageId, params = {}) {
    // --- LOG 1: Check parameters received ---
    console.log(`navigateTo called for page: ${pageId}, with params:`, JSON.stringify(params));

    currentParams = params; // Store params globally
    let hash = `#${pageId}`;

    // Append parameters to hash for bookmarking/refresh
    if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams(params);
        hash += `?${searchParams.toString()}`; // e.g., #store-details?storeId=XYZ
    }

    // --- LOG 2: Check the final hash being set ---
    console.log(`Setting window.location.hash to: ${hash}`);

    if (hash !== window.location.hash) {
        window.location.hash = hash; // Trigger hashchange event
    } else {
        // If hash is the same, manually reload the page logic using the cleaned hash
        console.log("Hash is the same, manually calling loadPage for:", hash.split('?')[0] || '#home');
        loadPage(hash.split('?')[0] || '#home');
    }
}
// Make navigateTo globally accessible for inline HTML onclick attributes
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
    // Update text only if the element exists (relevant for home page)
    requestAnimationFrame(() => { // Ensure DOM updates are safe
        const locationTextEl = document.getElementById('current-location-text');
        if (locationTextEl) {
            locationTextEl.textContent = text;
        }
    });
}

async function fetchAddressFromCoords(lat, lng) {
    userLocationText = "Fetching address..."; // Update status immediately
    updateLocationText(userLocationText);
    try {
        // Use HTTPS for API call
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const data = await response.json();

        if (data && data.address) {
            // Extract relevant address parts
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
            const state = data.address.state || "";
            let formattedAddress = city;
            if (state && city) formattedAddress = `${city}, ${state}`;
            else if (state) formattedAddress = state;
            // Use address display name as fallback if city/state not found
            userLocationText = formattedAddress || data.display_name || "Address details not found.";
        } else {
             userLocationText = data.display_name || "Address format unknown."; // Fallback to display_name
        }
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        userLocationText = "Could not fetch address.";
    }
    updateLocationText(userLocationText); // Update UI with result or error
}

async function getUserLocation() {
    userLocationText = "Fetching location...";
    updateLocationText(userLocationText);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success callback
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log(`Location obtained: Lat ${lat}, Lng ${lng}`);
                userLocation = { lat: lat, lng: lng };
                await fetchAddressFromCoords(lat, lng); // Fetch address after getting coords

                // Reload current page if it's home or stores (to update distances)
                const currentHash = (window.location.hash || '#home').split('?')[0];
                if (currentHash === '#home' || currentHash === '#stores') {
                     console.log("Reloading page after location update:", currentHash);
                     loadPage(currentHash);
                }
            },
            // Error callback
            (error) => {
                console.warn(`Geolocation error (${error.code}): ${error.message}`);
                userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback (Delhi)
                userLocationText = "Location access denied.";
                if(error.code === 1) { // User denied permission explicitly
                     userLocationText = "Location denied. Using default.";
                } else {
                    userLocationText = "Could not get location.";
                }
                updateLocationText(userLocationText);
                const currentHash = (window.location.hash || '#home').split('?')[0];
                 if (currentHash === '#home' || currentHash === '#stores') {
                    console.log("Reloading page with fallback location:", currentHash);
                    loadPage(currentHash);
                 }
            },
            // Options
            {
                 enableHighAccuracy: false, // Faster, less battery usage
                 timeout: 10000, // 10 seconds timeout
                 maximumAge: 60000 // Allow cached location up to 1 minute old
            }
        );
    } else {
        console.warn("Geolocation is not supported by this browser.");
        userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback (Delhi)
        userLocationText = "Geolocation not supported.";
        updateLocationText(userLocationText);
        const currentHash = (window.location.hash || '#home').split('?')[0];
         if (currentHash === '#home' || currentHash === '#stores') {
            console.log("Reloading page (no geolocation support):", currentHash);
            loadPage(currentHash);
         }
    }
}


// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    const previousUser = currentUser; // Track if user state changed
    console.log("Auth state changed. New user:", user ? user.uid : 'Logged out');
    if (user) {
        const userRef = doc(db, "users", user.uid);
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUser = { uid: user.uid, ...userSnap.data() };
                 console.log("User data loaded from Firestore:", currentUser);
            } else {
                console.warn("User document not found in Firestore, creating one...");
                const newUserDoc = {
                    name: user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL || "", mobile: "", address: "", createdAt: new Date()
                };
                await setDoc(userRef, newUserDoc);
                currentUser = { uid: user.uid, ...newUserDoc };
                 console.log("New user document created:", currentUser);
            }
        } catch (dbError) {
             console.error("Error accessing user document:", dbError);
             currentUser = null; // Set to null if DB read/write fails
        }
    } else {
        currentUser = null;
         console.log("User is logged out.");
    }

    // --- Reload or Redirect Logic ---
    const activePageKey = (window.location.hash || '#home').split('?')[0]; // Get key like #profile
    const protectedPages = ['#order-history', '#profile', '#order-request', '#manage-addresses'];

    // If user logs out while on a protected page, redirect to home
    if (!currentUser && protectedPages.includes(activePageKey)) {
        console.log(`User logged out on protected page (${activePageKey}). Redirecting to home.`);
        navigateTo('home');
    }
    // If user logs in/out and is currently on the profile page, reload it
    else if (activePageKey === '#profile' && previousUser !== currentUser) {
         console.log(`User state changed on profile page. Reloading profile.`);
         loadPage('#profile');
    }
    // Optional: Add more conditions if other pages need reload on auth change
});


// --- App Initialization (Event Listeners) ---

// Listen for hash changes (back/forward button or manual hash change)
window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '#home').split('?')[0]; // Clean hash
    console.log("hashchange event detected. Loading page for:", hash);
    loadPage(hash);
});

// Run when the initial HTML document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event. Initializing app...");
    // Setup bottom navigation button clicks
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            const pageId = link.dataset.page;
             console.log(`Bottom nav clicked: ${pageId}`);
            navigateTo(pageId);
        });
    });

    // Start fetching user location early
    getUserLocation();

    // Load the initial page based on the current URL hash
    const initialHash = (window.location.hash || '#home').split('?')[0]; // Clean initial hash
    console.log("Initial page load for hash:", initialHash);
    loadPage(initialHash);
});
