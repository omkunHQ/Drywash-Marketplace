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
    '#home':           { file: 'pages/home.html',          title: 'Home',          script: 'Js/pages/home.js' },
    '#stores':         { file: 'pages/stores.html',        title: 'Stores',        script: 'Js/pages/store.js' }, // Ensure this points to store.js
    '#store-details':  { file: 'pages/store-details.html', title: 'Store Details', script: 'Js/pages/store.js' }, // This also points to store.js
    '#order-history':  { file: 'pages/order-history.html', title: 'My Orders',     script: 'Js/pages/order-history.js' },
    '#profile':        { file: 'pages/profile.html',       title: 'My Account',    script: 'Js/pages/profile.js' },
    '#order-request':  { file: 'pages/order-request.html', title: 'Place Request', script: 'Js/pages/order-request.js' },
    '#manage-addresses': { file: 'pages/manage-addresses.html', title: 'My Addresses', script: 'Js/pages/manage-address.js' },
    '#help':           { file: 'pages/help.html',          title: 'Help',          script: null }
};

/**
 * MAIN ROUTER FUNCTION
 */
async function loadPage(hash) {
    const routeKey = hash.split('?')[0] || '#home';
    const route = routes[routeKey] || routes['#home'];

    // Basic loading text
    if (contentArea) {
        contentArea.innerHTML = `<div class="p-4 text-center text-slate-500">Loading...</div>`;
    } else {
        console.error("Fatal Error: #page-content-wrapper not found in index.html");
        return; // Stop if the main container is missing
    }

    updateActiveLinks(routeKey);
    document.title = `${route.title} - Drywash`;

    try {
        const response = await fetch(route.file);
        if (!response.ok) throw new Error(`Page not found: ${route.file}`);
        const html = await response.text();

        // Check again if contentArea exists before inserting HTML
        if (contentArea) {
            contentArea.innerHTML = html;
        } else {
             console.error("Fatal Error: #page-content-wrapper disappeared while loading content.");
             return;
        }


        if (route.script) {
            const relativePath = route.script.replace('Js/', '');
            // Add cache busting query parameter
            const modulePath = `./${relativePath}?v=${new Date().getTime()}`;
            const module = await import(modulePath);

            if (module && typeof module.init === 'function') {
                module.init(hash, currentParams);
            }
        }

    } catch (error) {
        console.error('Error loading page:', error);
         if (contentArea) { // Check if contentArea still exists
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
    currentParams = params;
    let hash = `#${pageId}`;

    if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams(params);
        hash += `?${searchParams.toString()}`;
    }
    // Only change hash if it's different to prevent unnecessary reloads
    if (hash !== window.location.hash) {
        window.location.hash = hash;
    } else {
        // If hash is the same, manually reload the page logic
        loadPage(hash);
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
    // This function relies on the element being present in the currently loaded HTML
    requestAnimationFrame(() => { // Wait for potential DOM update
        const locationTextEl = document.getElementById('current-location-text');
        if (locationTextEl) {
            locationTextEl.textContent = text;
        }
    });
}

async function fetchAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();

        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
            const state = data.address.state || "";
            let formattedAddress = city;
            if (state && city) formattedAddress = `${city}, ${state}`;
            else if (state) formattedAddress = state;
            userLocationText = formattedAddress || "Detailed address not found.";
        } else {
            userLocationText = "Address format unknown.";
        }
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        userLocationText = "Could not fetch address.";
    }
    updateLocationText(userLocationText); // Update UI after fetch
}

async function getUserLocation() {
    userLocationText = "Fetching location..."; // Initial text
    updateLocationText(userLocationText);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                userLocation = { lat: lat, lng: lng };
                userLocationText = "Fetching address...";
                updateLocationText(userLocationText);
                await fetchAddressFromCoords(lat, lng);

                // Reload current page if it's home or stores (to update distances)
                const currentHash = window.location.hash || '#home';
                if (currentHash === '#home' || currentHash === '#stores') {
                     loadPage(currentHash);
                }
            },
            (error) => {
                userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback
                userLocationText = "Location access denied.";
                updateLocationText(userLocationText);
                const currentHash = window.location.hash || '#home';
                 if (currentHash === '#home' || currentHash === '#stores') {
                    loadPage(currentHash);
                 }
            }
        );
    } else {
        userLocation = { lat: 28.6139, lng: 77.2090 }; // Fallback
        userLocationText = "Geolocation not supported.";
        updateLocationText(userLocationText);
        const currentHash = window.location.hash || '#home';
         if (currentHash === '#home' || currentHash === '#stores') {
            loadPage(currentHash);
         }
    }
}


// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    const previousUser = currentUser; // Store previous state
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            currentUser = { uid: user.uid, ...userSnap.data() };
        } else {
            const newUserDoc = {
                name: user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL || "", mobile: "", address: "", createdAt: new Date()
            };
            try {
                await setDoc(userRef, newUserDoc);
                currentUser = { uid: user.uid, ...newUserDoc };
            } catch (dbError) {
                console.error("Error creating user document:", dbError);
                currentUser = null; // Fallback if DB write fails
            }
        }
    } else {
        currentUser = null;
    }

    // --- Reload or Redirect Logic ---
    const activePageId = window.location.hash || '#home';
    const protectedPages = ['#order-history', '#profile', '#order-request', '#manage-addresses'];

    // If user logs out while on a protected page, redirect to home
    if (!currentUser && protectedPages.includes(activePageId)) {
        navigateTo('home');
    }
    // If user logs in/out and is on profile page, reload profile page
    else if (activePageId === '#profile' && previousUser !== currentUser) {
         loadPage('#profile');
    }
    // Optional: Reload other pages if needed after login/logout
    // else if ((previousUser && !currentUser) || (!previousUser && currentUser)) {
    //     // Reload current page maybe?
    //     loadPage(activePageId);
    // }
});


// --- App Initialization (Event Listeners) ---
window.addEventListener('hashchange', () => {
    // Extract hash without parameters for loading page logic
    const hash = window.location.hash.split('?')[0] || '#home';
    loadPage(hash); // Use the cleaned hash
});

document.addEventListener('DOMContentLoaded', () => {
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            navigateTo(pageId);
        });
    });

    getUserLocation(); // Start location fetching

    // Initial page load based on current hash
    const initialHash = window.location.hash.split('?')[0] || '#home';
    loadPage(initialHash); // Use the cleaned hash
});
