/* js/main.js
 * User App router with Auth Check Fix
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
let initialAuthCheckComplete = false; // <-- BADLAAV: Flag to track initial check
let authCheckPromiseResolver = null; // <-- BADLAAV: Resolver for the promise

// --- BADLAAV: Promise jo initial auth check ka wait karega ---
const waitForAuthCheck = new Promise(resolve => {
    authCheckPromiseResolver = resolve; // Store the resolve function
});
// --- END BADLAAV ---


// --- Page Routes ---
const routes = {
    '#home':           { file: 'pages/home.html',          title: 'Home',          script: 'js/pages/home.js' },
    '#stores':         { file: 'pages/stores.html',        title: 'Stores',        script: 'js/pages/store.js' }, // Ensure this points to store.js
    '#store-details':  { file: 'pages/store-details.html', title: 'Store Details', script: 'js/pages/store.js' }, // This also points to store.js
    '#order-history':  { file: 'pages/order-history.html', title: 'My Orders',     script: 'js/pages/order-history.js' },
    '#profile':        { file: 'pages/profile.html',       title: 'My Account',    script: 'js/pages/profile.js' },
    '#order-request':  { file: 'pages/order-request.html', title: 'Place Request', script: 'js/pages/order-request.js' },
    '#manage-addresses': { file: 'pages/manage-addresses.html', title: 'My Addresses', script: 'js/pages/manage-addresses.js' },
    '#help':           { file: 'pages/help.html',          title: 'Help',          script: null }
};

/**
 * MAIN ROUTER FUNCTION
 */
async function loadPage(hash) {
    const routeKey = hash.split('?')[0] || '#home';
    const route = routes[routeKey] || routes['#home'];

    // --- BADLAAV: Wait for initial auth check BEFORE loading protected pages ---
    if (route.protected && !initialAuthCheckComplete) {
        console.log(`Waiting for auth check before loading protected route: ${routeKey}`);
        await waitForAuthCheck; // Yahaan wait karega
        console.log("Auth check complete. Proceeding...");
        // Re-check currentUser after waiting
        if (!currentUser) {
            console.log(`User not authenticated after wait. Redirecting ${routeKey} to profile.`);
            navigateTo('profile'); // Agar wait ke baad bhi login nahi hai, toh profile bhejein
            return; // Page load karna band karein
        }
    } else if (route.protected && !currentUser) {
         // Agar check ho chuka hai lekin user logged out hai
         console.log(`User not authenticated. Redirecting protected route ${routeKey} to profile.`);
         navigateTo('profile');
         return;
    }
    // --- END BADLAAV ---


    if (contentArea) {
        contentArea.innerHTML = `<div class="p-4 text-center text-slate-500">Loading ${route.title}...</div>`;
    } else {
        console.error("Fatal Error: #page-content-wrapper not found!");
        return;
    }

    updateActiveLinks(routeKey);
    document.title = `${route.title} - Drywash`;

    try {
        const response = await fetch(`./${route.file}`); // Relative path for HTML
        if (!response.ok) throw new Error(`Page HTML not found: ${route.file}`);
        const html = await response.text();

        if (contentArea) {
            contentArea.innerHTML = html;
        } else {
             console.error("Fatal Error: #page-content-wrapper disappeared.");
             return;
        }

        if (route.script) {
            const modulePath = `/${route.script}?v=${new Date().getTime()}`; // Root-relative path for JS
            console.log("Attempting to import module:", modulePath);
            try {
                const module = await import(modulePath);
                if (module && typeof module.init === 'function') {
                    console.log(`Calling init for ${routeKey}`);
                    module.init(hash, currentParams);
                } else {
                     console.warn(`Module loaded for ${route.script}, but init function not found.`);
                }
            } catch (importError) {
                 console.error(`Failed to import module: ${modulePath}`, importError);
                 if (contentArea) contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Script</h3><p>${importError.message}</p></div>`;
            }
        }

    } catch (error) {
        console.error('Error loading page HTML:', error);
         if (contentArea) contentArea.innerHTML = `<div class="text-center p-5 text-red-600"><h3>Error Loading Page</h3><p>${error.message}</p></div>`;
    }
}

// --- Helper Functions ---

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
export function calculateDistance(lat1, lon1, lat2, lon2) { /* ... (calculateDistance code same) ... */ }
function updateLocationText(text) { /* ... (updateLocationText code same) ... */ }
async function fetchAddressFromCoords(lat, lng) { /* ... (fetchAddressFromCoords code same) ... */ }
async function getUserLocation() { /* ... (getUserLocation code same) ... */ }


// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    const previousUser = currentUser;
    console.log("Auth state changed. Checking user...");
    if (user) {
        const userRef = doc(db, "users", user.uid);
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUser = { uid: user.uid, ...userSnap.data() };
            } else {
                console.warn("User document not found, creating one...");
                const newUserDoc = { /* ... (newUserDoc data) ... */ };
                await setDoc(userRef, newUserDoc);
                currentUser = { uid: user.uid, ...newUserDoc };
            }
             console.log("User authenticated:", currentUser?.email);
        } catch (dbError) {
             console.error("Error accessing user document:", dbError);
             currentUser = null;
        }
    } else {
        currentUser = null;
         console.log("User is logged out.");
    }

    // --- BADLAAV: Signal that the initial auth check is complete ---
    if (!initialAuthCheckComplete) {
        initialAuthCheckComplete = true;
        if (authCheckPromiseResolver) {
            authCheckPromiseResolver(); // Resolve the promise
             console.log("Initial authentication check complete.");
        }
    }
    // --- END BADLAAV ---


    // --- Reload or Redirect Logic (Remains mostly the same) ---
    const activePageKey = (window.location.hash || '#home').split('?')[0];

    // If user logs out while on a protected page, redirect NOW
    if (!currentUser && routes[activePageKey]?.protected) {
        console.log(`User logged out on protected page (${activePageKey}). Redirecting to profile.`);
        navigateTo('profile'); // Redirect to profile/login page
    }
    // If user state changes and they are on the profile page, reload it
    else if (activePageKey === '#profile' && previousUser !== currentUser) {
         console.log(`User state changed on profile page. Reloading profile.`);
         loadPage('#profile');
    }
});


// --- App Initialization (Event Listeners) ---
window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '#home').split('?')[0]; // Clean hash
    console.log("hashchange event detected. Loading page for:", hash);
    loadPage(hash); // Call loadPage on hash change
});

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event. Initializing app...");
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
             console.log(`Bottom nav clicked: ${pageId}`);
            navigateTo(pageId);
        });
    });

    getUserLocation(); // Start location fetching

    // Initial page load based on the current URL hash
    // The loadPage function itself will now wait for auth if needed
    const initialHash = (window.location.hash || '#home').split('?')[0];
    console.log("Initial page load for hash:", initialHash);
    loadPage(initialHash);
});

// --- Baaki ke functions jaise calculateDistance, updateLocationText, etc. ko yahan paste karein ---
// (Maine unhe upar comments mein chhod diya hai taaki code chhota dikhe, lekin aapko unhe yahaan rakhna hoga)

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
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const data = await response.json();
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
            const state = data.address.state || "";
            let formattedAddress = city;
            if (state && city) formattedAddress = `${city}, ${state}`;
            else if (state) formattedAddress = state;
            userLocationText = formattedAddress || data.display_name || "Address details not found.";
        } else {
             userLocationText = data.display_name || "Address format unknown.";
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
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log(`Location obtained: Lat ${lat}, Lng ${lng}`);
                userLocation = { lat: lat, lng: lng };
                await fetchAddressFromCoords(lat, lng);
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
