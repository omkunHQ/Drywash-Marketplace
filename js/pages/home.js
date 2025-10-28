// 📁 Js/pages/home.js

import { db } from '../../Firebase-Configuration.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { userLocation, userLocationText, calculateDistance, navigateTo } from '../main.js';

// Main init function (router calls this)
export function init(hash, params) {
    // Use requestAnimationFrame for a slight delay
    requestAnimationFrame(() => {
        _initHome();
    });
}

// Internal function that does the work for the home page
async function _initHome() {

    // Set the location text in the header first
    const locationTextEl = document.getElementById('current-location-text');
    if (locationTextEl) {
        locationTextEl.textContent = userLocationText; // Get text from main.js
    }

    // Get references to the list container and loader
    const storeListContainer = document.getElementById('home-store-list');
    const loader = document.getElementById('home-store-loader');

    // If elements aren't found, stop (shouldn't happen with requestAnimationFrame)
    if (!storeListContainer || !loader) {
        console.error("Home page elements not found even after delay.");
        return;
    }

    // Show loader, clear previous list
    loader.style.display = 'block';
    storeListContainer.innerHTML = '';
    storeListContainer.appendChild(loader);

    // If location is still being fetched by main.js, show message and wait
    if (!userLocation) {
        // Only update loader's innerHTML if it exists
        if (loader) {
            loader.innerHTML = '<p class="text-center text-slate-500">Getting your location...</p>';
        }
        return; // main.js will call init() again when location is ready
    }

    // Location is ready, fetch stores
    try {
        const querySnapshot = await getDocs(collection(db, "store_profiles"));
        let stores = [];
        querySnapshot.forEach((doc) => {
            const storeData = doc.data();
            let distance = 9999; // Default distance

            // Safety check for location field before calculating distance
            if (storeData.location && storeData.location.latitude && storeData.location.longitude) {
                distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    storeData.location.latitude,
                    storeData.location.longitude
                );
            } else {
                console.warn(`Store ${storeData.name || doc.id} has no location data.`);
            }

            stores.push({ id: doc.id, ...storeData, distance: distance });
        });

        // Sort stores by distance and get the top 5
        stores.sort((a, b) => a.distance - b.distance);
        const topStores = stores.slice(0, 5);

        // Render the stores onto the page
        renderStores(topStores, storeListContainer, loader);

    } catch (error) {
        console.error("Error fetching stores: ", error);
        // Only update container if it exists
         if (storeListContainer) {
            storeListContainer.innerHTML = '<p class="text-red-500">Could not load stores.</p>';
         }
    }
}

// Function to render the store cards onto the page
function renderStores(stores, container, loaderEl) {
    // Safety check if elements don't exist
    if (!container || !loaderEl) return;

    loaderEl.style.display = 'none'; // Hide loader
    container.innerHTML = ''; // Clear container

    if (!stores || stores.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">No stores found nearby.</p>';
        return;
    }

    stores.forEach(store => {
        const storeCard = document.createElement('div');
        storeCard.className = 'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer';
        // Use optional chaining (?.) and nullish coalescing (??) for safety
        storeCard.innerHTML = `
            <img class="h-40 w-full object-cover" src="${store?.coverImage ?? 'https://placehold.co/600x250'}" alt="${store?.name ?? 'Store'}">
            <div class="p-4">
                <h3 class="text-lg font-bold text-slate-800 mb-1">${store?.name ?? 'Unnamed Store'}</h3>
                <p class="text-sm text-slate-500 mb-2">${store?.shortDescription ?? 'Laundry & Dry Cleaning'}</p>
                <div class="flex items-center text-sm">
                    <i class="fas fa-star text-yellow-400 mr-1"></i>
                    <span class="font-semibold text-slate-700">${store?.rating?.toFixed(1) ?? 'N/A'}</span>
                    <span class="mx-2 text-slate-300">|</span>
                    <i class="fas fa-location-dot text-slate-400 mr-1"></i>
                    <span>${store?.distance?.toFixed(1) ?? 'N/A'} km</span>
                </div>
            </div>
        `;

        // Add click listener to navigate to store details
        storeCard.addEventListener('click', () => {
            navigateTo('store-details', { storeId: store.id });
        });

        container.appendChild(storeCard);
    });
}