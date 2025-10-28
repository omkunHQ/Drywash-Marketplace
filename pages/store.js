import { db } from '../../Firebase-Configuration.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { userLocation, calculateDistance, navigateTo, currentUser } from '../main.js';

let allStoresCache = []; // Search ke liye stores ko cache karein

// --- Main Init Function (Router dwara call kiya gaya) ---
export function init(hash, params) {
    if (hash.startsWith('#stores')) {
        _initStores();
        
    } else if (hash.startsWith('#store-details')) {
        // --- YEH NAYA BADLAAV HAI ---
        // Hum 'params' object (jo refresh par khaali hota hai) par nirbhar nahin rahenge.
        // Hum 'storeId' ko seedhe 'hash' string se nikaalenge.
        
        const urlParams = new URLSearchParams(hash.split('?')[1]);
        const storeId = urlParams.get('storeId'); 
        // Ab yeh refresh karne par bhi kaam karega

        _initStoreDetails(storeId);
    }
}

// --- 1. Store List Page Logic ---

async function _initStores() {
    const storeListPageContainer = document.getElementById('store-list-container-page');
    const storeListLoader = document.getElementById('store-list-loader');
    const searchInput = document.getElementById('store-search-input-page');

    if (!storeListPageContainer || !storeListLoader || !searchInput) {
        console.error("Store list elements not found");
        return;
    }

    storeListLoader.style.display = 'block';
    storeListPageContainer.innerHTML = ''; // Purani list clear karein
    storeListPageContainer.appendChild(storeListLoader);
    
    searchInput.onkeyup = (e) => {
        renderStoreList(e.target.value, storeListPageContainer, storeListLoader);
    };

    if (!userLocation) {
        storeListPageContainer.innerHTML = '<p class="text-center text-slate-500">Getting your location...</p>';
        return;
    }

    try {
        if (allStoresCache.length === 0) {
            console.log("Fetching stores from Firestore...");
            const querySnapshot = await getDocs(collection(db, "store_profiles"));
            allStoresCache = []; 
            
            querySnapshot.forEach((doc) => {
                const storeData = doc.data();
                let distance = 9999; 

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
                allStoresCache.push({ id: doc.id, ...storeData, distance: distance });
            });
            
            allStoresCache.sort((a, b) => a.distance - b.distance);
        }
        
        renderStoreList('', storeListPageContainer, storeListLoader);
    } catch (error) {
        console.error("Error fetching all stores: ", error);
        storeListPageContainer.innerHTML = '<p class="text-red-500">Could not load stores.</p>';
    }
}

function renderStoreList(searchTerm, container, loader) {
    loader.style.display = 'none';
    container.innerHTML = ''; 
    
    const filteredStores = allStoresCache.filter(store => 
        store.name && store.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredStores.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center">No stores match your search.</p>';
        return;
    }

    filteredStores.forEach(store => {
        const storeCard = document.createElement('div');
        storeCard.className = 'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer';
        storeCard.innerHTML = `
            <img class="h-40 w-full object-cover" src="${store.coverImage || 'https://placehold.co/600x250'}" alt="${store.name || 'Store'}">
            <div class="p-4">
                <h3 class="text-lg font-bold text-slate-800 mb-1">${store.name || 'Unnamed Store'}</h3>
                <p class="text-sm text-slate-500 mb-2">${store.shortDescription || 'Laundry & Dry Cleaning'}</p>
                <div class="flex items-center text-sm">
                    <i class="fas fa-star text-yellow-400 mr-1"></i>
                    <span class="font-semibold text-slate-700">${store.rating ? store.rating.toFixed(1) : 'N/A'}</span>
                    <span class="mx-2 text-slate-300">|</span>
                    <i class="fas fa-location-dot text-slate-400 mr-1"></i>
                    <span>${store.distance.toFixed(1)} km</span>
                </div>
            </div>
        `;
        storeCard.addEventListener('click', () => {
            navigateTo('store-details', { storeId: store.id });
        });
        container.appendChild(storeCard);
    });
}


// --- 2. Store Details Page Logic ---

async function _initStoreDetails(storeId) {
    // Ab 'storeId' seedhe URL se aa raha hai
    if (!storeId) {
        console.error("Store ID URL mein nahi mila!");
        alert("Store ID not found. Redirecting to stores list.");
        navigateTo('stores');
        return;
    }

    const nameEl = document.getElementById('store-details-name');
    const imageEl = document.getElementById('store-detail-image');
    const servicesShortEl = document.getElementById('store-details-services-short');
    const ratingEl = document.getElementById('store-details-rating');
    const distanceEl = document.getElementById('store-details-distance');
    const hoursEl = document.getElementById('store-details-hours');
    const serviceListEl = document.getElementById('store-service-list');
    const placeRequestBtn = document.getElementById('place-request-btn');

    if (!nameEl || !serviceListEl || !placeRequestBtn) {
        console.error("Store details elements not found");
        return;
    }

    // 1. Fetch Store Profile
    try {
        const storeRef = doc(db, "store_profiles", storeId);
        const storeSnap = await getDoc(storeRef);

        if (storeSnap.exists()) {
            const store = storeSnap.data();
            nameEl.textContent = store.name || 'Unnamed Store';
            imageEl.src = store.coverImage || 'https://placehold.co/600x250';
            servicesShortEl.textContent = store.shortDescription || 'Laundry, Ironing, Dry Cleaning';
            ratingEl.textContent = store.rating ? store.rating.toFixed(1) : 'N/A';
            hoursEl.textContent = 'Open: 9:00 AM - 9:00 PM'; // Placeholder
            
            if (userLocation && store.location && store.location.latitude) {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
                distanceEl.textContent = `${distance.toFixed(1)} km`;
            } else {
                distanceEl.textContent = `N/A`;
            }

        } else {
            console.error("Store not found in database (ID: " + storeId + ")");
            alert("Store not found.");
            navigateTo('stores');
        }
    } catch (error) {
        console.error("Error fetching store details: ", error);
    }
    
    // 2. Fetch Store Products (Price List)
    try {
        const q = query(collection(db, "products"), where("storeId", "==", storeId));
        const querySnapshot = await getDocs(q);
        
        serviceListEl.innerHTML = ''; // Loader clear karein
        
        if (querySnapshot.empty) {
            serviceListEl.innerHTML = '<li class="text-slate-500">No services listed for this store.</li>';
        } else {
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center border-b border-slate-100 pb-3';
                li.innerHTML = `
                    <span class="text-slate-700">${product.name}</span>
                    <span class="font-semibold text-slate-800">₹${product.price} <span class="text-xs text-slate-500 font-normal">/pc</span></span>
                `;
                serviceListEl.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching products: ", error);
    }
    
    // 3. Setup "Place Request" button
    placeRequestBtn.onclick = () => {
        if (!currentUser) {
            alert("Please log in to place a request.");
            navigateTo('profile');
            return;
        }
        navigateTo('order-request', { storeId: storeId });
    };
}