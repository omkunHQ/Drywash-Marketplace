import { db } from '../../Firebase-Configuration.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { userLocation, calculateDistance, navigateTo, currentUser } from '../main.js';

let allStoresCache = []; // Search ke liye stores ko cache karein

// --- Main Init Function (Router dwara call kiya gaya) ---
export function init(hash, params) {
    // --- LOG 4: Check hash and params received by init ---
    console.log(`Store.js init received hash: ${hash}, received params object:`, JSON.stringify(params));
    
    requestAnimationFrame(() => {
        if (hash.startsWith('#stores')) {
            console.log("Initializing Stores List Page...");
            _initStores();
        } else if (hash.startsWith('#store-details')) {
            console.log("Initializing Store Details Page...");
            let storeId = null;
            
            // Attempt 1: Try getting from params object (passed by navigateTo)
            if (params && params.storeId) {
                storeId = params.storeId;
                console.log("Extracted storeId from params object:", storeId);
            }
            // Attempt 2: Fallback to parsing the hash string (useful for refresh/direct link)
            else if (hash.includes('?')) {
                const urlParams = new URLSearchParams(hash.split('?')[1]);
                storeId = urlParams.get('storeId');
                console.log("Extracted storeId by parsing hash string:", storeId);
            } else {
                console.warn("Could not find storeId in params object or hash string.");
            }
            
            _initStoreDetails(storeId); // Pass the potentially null storeId
        }
    });
}

// --- 1. Store List Page Logic ---
async function _initStores() {
    console.log("Running _initStores...");
    const storeListPageContainer = document.getElementById('store-list-container-page');
    const storeListLoader = document.getElementById('store-list-loader');
    const searchInput = document.getElementById('store-search-input-page');
    
    // **CRITICAL**: Check if HTML elements exist
    if (!storeListPageContainer || !storeListLoader || !searchInput) {
        console.error("Store list elements NOT FOUND in stores.html! Check IDs: store-list-container-page, store-list-loader, store-search-input-page");
        // Optionally display an error message to the user in the container
        if (storeListPageContainer) {
            storeListPageContainer.innerHTML = '<p class="p-4 text-red-600 font-bold">Error: Page elements missing. Cannot load stores.</p>';
        }
        return; // Stop execution if elements are missing
    }
    console.log("Store list elements found successfully.");
    
    storeListLoader.style.display = 'block';
    storeListPageContainer.innerHTML = ''; // Clear previous content
    storeListPageContainer.appendChild(storeListLoader); // Add loader
    
    // Setup search listener
    searchInput.onkeyup = (e) => {
        renderStoreList(e.target.value, storeListPageContainer, storeListLoader);
    };
    
    // Check if location is available
    if (!userLocation) {
        console.log("User location not available yet. Waiting...");
        storeListPageContainer.innerHTML = '<p class="text-center text-slate-500">Getting your location...</p>';
        return; // Wait for main.js to reload the page when location is ready
    }
    console.log("User location is available.");
    
    try {
        // Fetch data only if cache is empty
        if (allStoresCache.length === 0) {
            console.log("Store cache is empty. Fetching stores from Firestore...");
            const querySnapshot = await getDocs(collection(db, "store_profiles"));
            allStoresCache = []; // Reset cache before filling
            
            querySnapshot.forEach((doc) => {
                const storeData = doc.data();
                let distance = 9999; // Default distance
                
                // Safety check for location field
                if (storeData && storeData.location && typeof storeData.location.latitude === 'number' && typeof storeData.location.longitude === 'number') {
                    try {
                        distance = calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            storeData.location.latitude,
                            storeData.location.longitude
                        );
                    } catch (calcError) {
                        console.error(`Error calculating distance for store ${doc.id}:`, calcError);
                        distance = 9998; // Indicate calculation error
                    }
                } else {
                    console.warn(`Store ${storeData?.name || doc.id} is missing valid location data.`);
                }
                allStoresCache.push({ id: doc.id, ...storeData, distance: distance });
            });
            
            // Sort stores by distance
            allStoresCache.sort((a, b) => a.distance - b.distance);
            console.log(`Fetched and cached ${allStoresCache.length} stores.`);
        } else {
            console.log("Using cached store data.");
        }
        
        // Render the list using cache
        renderStoreList('', storeListPageContainer, storeListLoader);
    } catch (error) {
        console.error("Error fetching or processing store profiles: ", error);
        storeListPageContainer.innerHTML = '<p class="text-red-500 font-bold text-center">Error: Could not load stores.</p>';
    }
}

// Helper function to render the store list
function renderStoreList(searchTerm, container, loader) {
    if (!container || !loader) {
        console.error("RenderStoreList called without container or loader element.");
        return;
    }
    loader.style.display = 'none';
    container.innerHTML = ''; // Clear previous results
    
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const filteredStores = allStoresCache.filter(store =>
        store && store.name && store.name.toLowerCase().includes(normalizedSearchTerm)
    );
    
    if (filteredStores.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">No stores match your search.</p>';
        return;
    }
    
    console.log(`Rendering ${filteredStores.length} stores for search term: "${searchTerm}"`);
    filteredStores.forEach(store => {
        const storeCard = document.createElement('div');
        storeCard.className = 'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer';
        // Use ?? for default values to handle null/undefined safely
        storeCard.innerHTML = `
            <img class="h-40 w-full object-cover" src="${store.coverImage ?? 'https://placehold.co/600x250'}" alt="${store.name ?? 'Store'}">
            <div class="p-4">
                <h3 class="text-lg font-bold text-slate-800 mb-1">${store.name ?? 'Unnamed Store'}</h3>
                <p class="text-sm text-slate-500 mb-2">${store.shortDescription ?? 'Laundry & Dry Cleaning'}</p>
                <div class="flex items-center text-sm">
                    <i class="fas fa-star text-yellow-400 mr-1"></i>
                    <span class="font-semibold text-slate-700">${store.rating ? store.rating.toFixed(1) : 'N/A'}</span>
                    <span class="mx-2 text-slate-300">|</span>
                    <i class="fas fa-location-dot text-slate-400 mr-1"></i>
                    <span>${store.distance === 9999 || store.distance === 9998 ? 'N/A' : store.distance.toFixed(1) + ' km'}</span>
                </div>
            </div>
        `;
        storeCard.addEventListener('click', () => {
            console.log("Store card clicked. Navigating to details with storeId:", store.id);
            navigateTo('store-details', { storeId: store.id });
        });
        container.appendChild(storeCard);
    });
}


// --- 2. Store Details Page Logic ---
async function _initStoreDetails(storeId) {
    console.log(`Running _initStoreDetails for storeId: ${storeId}`);
    // Validate storeId early
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
        console.error("Invalid or missing Store ID received!");
        alert("Invalid Store ID. Redirecting to stores list.");
        navigateTo('stores'); // Redirect immediately
        return;
    }
    
    // Get DOM elements
    const nameEl = document.getElementById('store-details-name');
    const imageEl = document.getElementById('store-detail-image');
    const servicesShortEl = document.getElementById('store-details-services-short');
    const ratingEl = document.getElementById('store-details-rating');
    const distanceEl = document.getElementById('store-details-distance');
    const hoursEl = document.getElementById('store-details-hours');
    const serviceListEl = document.getElementById('store-service-list');
    const placeRequestBtn = document.getElementById('place-request-btn');
    
    // **CRITICAL**: Check if elements exist
    if (!nameEl || !imageEl || !servicesShortEl || !ratingEl || !distanceEl || !hoursEl || !serviceListEl || !placeRequestBtn) {
        console.error("Store details elements NOT FOUND in store-details.html! Check IDs.");
        // Optionally show an error on the page if possible
        if (nameEl) nameEl.textContent = "Error: Page elements missing.";
        if (serviceListEl) serviceListEl.innerHTML = '<li class="text-red-600 font-bold">Error loading services.</li>';
        return; // Stop if elements are missing
    }
    console.log("Store details elements found successfully.");
    
    // --- Fetch Store Profile ---
    try {
        console.log(`Fetching store profile for ID: ${storeId}`);
        const storeRef = doc(db, "store_profiles", storeId);
        const storeSnap = await getDoc(storeRef);
        
        if (storeSnap.exists()) {
            console.log("Store profile found.");
            const store = storeSnap.data();
            
            // Populate store details safely
            nameEl.textContent = store.name ?? 'Unnamed Store';
            imageEl.src = store.coverImage ?? 'https://placehold.co/600x250';
            servicesShortEl.textContent = store.shortDescription ?? 'Laundry, Ironing, Dry Cleaning';
            ratingEl.textContent = store.rating ? store.rating.toFixed(1) : 'N/A';
            hoursEl.textContent = 'Open: 9:00 AM - 9:00 PM'; // Placeholder - fetch from DB later
            
            // Calculate and display distance safely
            if (userLocation && store.location && typeof store.location.latitude === 'number' && typeof store.location.longitude === 'number') {
                try {
                    const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
                    distanceEl.textContent = `${distance.toFixed(1)} km`;
                } catch (calcError) {
                    console.error("Error calculating distance on details page:", calcError);
                    distanceEl.textContent = 'Error';
                }
            } else {
                console.warn("Cannot calculate distance - User location or store location missing/invalid.");
                distanceEl.textContent = 'N/A';
            }
            
        } else {
            console.error(`Store with ID ${storeId} not found in database.`);
            alert("Store not found.");
            navigateTo('stores'); // Redirect if store doesn't exist
            return; // Stop further execution for this page
        }
    } catch (error) {
        console.error("Error fetching store profile: ", error);
        nameEl.textContent = "Error loading store"; // Show error on page
        // Optionally disable the request button
        placeRequestBtn.disabled = true;
        placeRequestBtn.textContent = "Cannot place request";
    }
    
    // --- Fetch Store Products (Price List) ---
    // This runs even if store profile had an error, might show empty list
    try {
        console.log(`Fetching products for store ID: ${storeId}`);
        const q = query(collection(db, "products"), where("storeId", "==", storeId));
        const querySnapshot = await getDocs(q);
        
        serviceListEl.innerHTML = ''; // Clear loader/previous content
        
        if (querySnapshot.empty) {
            console.log("No products found for this store.");
            serviceListEl.innerHTML = '<li class="text-slate-500">No services listed for this store.</li>';
        } else {
            console.log(`Found ${querySnapshot.size} products.`);
            querySnapshot.forEach((productDoc) => { // Use different name
                const product = productDoc.data();
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center border-b border-slate-100 pb-3';
                // Use ?? for default price/name
                li.innerHTML = `
                    <span class="text-slate-700">${product.name ?? 'Unnamed Service'}</span>
                    <span class="font-semibold text-slate-800">₹${product.price ?? 'N/A'} <span class="text-xs text-slate-500 font-normal">/pc</span></span>
                `;
                serviceListEl.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching products: ", error);
        serviceListEl.innerHTML = '<li class="text-red-500 font-bold">Error loading services.</li>';
    }
    
    // --- Setup "Place Request" button ---
    placeRequestBtn.onclick = () => {
        if (!currentUser) {
            alert("Please log in to place a request.");
            navigateTo('profile');
            return;
        }
        console.log("Place Request button clicked. Navigating to order request with storeId:", storeId);
        navigateTo('order-request', { storeId: storeId });
    };
}
