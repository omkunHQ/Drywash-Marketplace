import { db } from '../../Firebase-Configuration.js';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// currentUser यहाँ import नहीं करना है, यह init parameter से मिलेगा
import { navigateTo } from '../main.js'; // navigateTo redirect के लिए ज़रूरी है

// --- Global variables for modal elements (defined in index.html) ---
let modal = null;
let modalCloseBtn = null;
let modalBackdrop = null;
let modalOrderId = null;
let modalOrderTotal = null;
let modalOrderStatus = null;
let modalOrderDelivery = null; // Note: Delivery estimation is static for now
let modalOrderItems = null;
let modalRatingBox = null;
let starRatingInput = null;
let submitRatingBtn = null;

// State for rating
let currentSelectedRating = 0;
let currentOrderToRate = null; // Stores the ID of the order being rated

// --- Main Init Function (Router calls this) ---
export function init(hash, params, user) { // <-- Added 'user' parameter
    // Use requestAnimationFrame to ensure modal elements from index.html are ready
     requestAnimationFrame(() => {
        // Find modal elements only once when the page loads
        modal = document.getElementById('order-details-modal');
        modalCloseBtn = document.getElementById('modal-close-btn');
        modalBackdrop = document.getElementById('modal-backdrop');
        modalOrderId = document.getElementById('modal-order-id');
        modalOrderTotal = document.getElementById('modal-order-total');
        modalOrderStatus = document.getElementById('modal-order-status');
        modalOrderDelivery = document.getElementById('modal-order-delivery'); // Static element
        modalOrderItems = document.getElementById('modal-order-items');
        modalRatingBox = document.getElementById('modal-rating-box');
        starRatingInput = document.getElementById('star-rating-input');
        submitRatingBtn = document.getElementById('submit-rating-btn');

        // Basic check if core modal elements exist
        if (!modal || !modalCloseBtn || !modalBackdrop || !modalRatingBox || !submitRatingBtn || !starRatingInput) {
            console.error("Order details modal elements NOT FOUND in index.html! Rating/Details might not work.");
            // Proceed without modal functionality or show a persistent error
        } else {
             // Setup modal close listeners (only if elements exist)
             modalCloseBtn.onclick = hideOrderDetails;
             modalBackdrop.onclick = hideOrderDetails;
             submitRatingBtn.onclick = submitRating; // Rating submit listener
        }

        // Now load the actual order history list, passing the user object
        _initOrderHistory(user); // <-- Pass user object here
     });
}

// --- Internal Page Logic: Fetches and displays history ---
async function _initOrderHistory(user) { // <-- Added 'user' parameter
    console.log("Running _initOrderHistory...");
    // Get list elements from order-history.html
    const historyListContainer = document.getElementById('order-history-list');
    const loader = document.getElementById('order-history-loader');
    const noOrdersView = document.getElementById('no-orders-view'); // Use the modern empty state view

    // Check if list elements are found
    if (!historyListContainer || !loader || !noOrdersView) {
        console.error("Order history page elements NOT FOUND in order-history.html! Check IDs.");
        if(historyListContainer) historyListContainer.innerHTML = '<p class="p-4 text-red-600 font-bold">Error: Page elements missing.</p>';
        return; // Stop if list elements are missing
    }
    console.log("Order history page elements found.");

    // Initial state: Show loader, hide list and empty view
    loader.style.display = 'block';
    historyListContainer.classList.add('hidden'); // List hidden initially
    historyListContainer.innerHTML = ''; // Clear previous content
    noOrdersView.classList.add('hidden'); // Empty view hidden initially

    // Check if user object was passed correctly
    if (!user || !user.uid) { // Check the passed user object and its uid
        console.log("User object not valid or missing uid in _initOrderHistory. Showing login prompt.");
        loader.style.display = 'none';
        // Modify and show the empty state view for login
         noOrdersView.querySelector('h2').textContent = "Please Log In";
         noOrdersView.querySelector('p').textContent = "Log in to view your order history.";
         const browseBtn = noOrdersView.querySelector('button');
         if(browseBtn) {
             browseBtn.textContent = "Log In / Sign Up";
             browseBtn.onclick = () => navigateTo('profile'); // Ensure navigateTo is imported if used here
         }
         noOrdersView.classList.remove('hidden');
        return;
    }
    console.log(`Fetching history for user: ${user.uid}`);

    try {
        let historyItems = [];

        // --- 1. Fetch Pickup Requests ---
        console.log("Fetching pickup requests...");
        const requestsQuery = query(
            collection(db, "pickup_requests"),
            where("customerId", "==", user.uid), // Use user.uid
            orderBy("createdAt", "desc")
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        requestsSnapshot.forEach((docRef) => {
            const data = docRef.data();
            // Filter out requests that already have a corresponding order created (optional, avoids duplicates if needed)
            // if (data.status !== 'ORDER_CREATED') { // Uncomment this line if you ONLY want to show pending requests
                historyItems.push({
                    id: docRef.id,
                    type: 'request', // Mark as request
                    status: data.status, // e.g., Pending, In-Process, Order_Created
                    createdAt: data.createdAt, // Timestamp
                    pickupSlot: data.pickupSlot,
                    storeId: data.storeId
                });
            // }
        });
        console.log(`Found ${requestsSnapshot.size} pickup requests.`);

        // --- 2. Fetch Orders ---
        console.log("Fetching orders...");
        const ordersQuery = query(
            collection(db, "orders"),
            where("customerId", "==", user.uid), // Use user.uid
            orderBy("createdAt", "desc")
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.forEach((docRef) => {
            const data = docRef.data();
            historyItems.push({
                id: docRef.id,
                type: 'order', // Mark as order
                status: data.status, // e.g., PICKUP_DONE, PROCESSING, DELIVERED
                createdAt: data.createdAt, // Timestamp
                total: data.total,
                items: data.items, // For modal
                ratingGiven: data.ratingGiven,
                rating: data.rating,
                storeId: data.storeId
            });
        });
        console.log(`Found ${ordersSnapshot.size} orders.`);

        // --- 3. Combine and Sort ---
        console.log("Sorting combined history items...");
        historyItems.sort((a, b) => {
            // Handle potential null or non-Timestamp values gracefully
            const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
             // Fallback for missing timestamps
             if(timeA === 0 && timeB === 0) return 0; // Keep original order if both missing
             if(timeA === 0) return 1; // Put items without date at the end
             if(timeB === 0) return -1; // Keep items with dates first
            return timeB - timeA; // Descending order (newest first)
        });

        loader.style.display = 'none'; // Hide loader after fetching both

        // --- 4. Render the Combined List ---
        if (historyItems.length === 0) {
            console.log("No history items found for this user.");
            // Reset empty state text to default before showing
            noOrdersView.querySelector('h2').textContent = "No Orders Yet";
            noOrdersView.querySelector('p').textContent = "Looks like your order history is empty. Time to get those clothes sparkling clean!";
            const browseBtn = noOrdersView.querySelector('button');
             if(browseBtn) {
                 browseBtn.textContent = "Browse Stores";
                 browseBtn.onclick = () => navigateTo('stores'); // Ensure navigateTo is imported
             }
            noOrdersView.classList.remove('hidden'); // Show the 'No History' view
            historyListContainer.classList.add('hidden'); // Keep list hidden
        } else {
            console.log(`Rendering ${historyItems.length} history items.`);
            historyListContainer.classList.remove('hidden'); // Show the list container
            noOrdersView.classList.add('hidden'); // Hide empty view

            historyItems.forEach((item) => {
                const itemCard = createHistoryCard(item); // Use helper function
                historyListContainer.appendChild(itemCard);
            });
        }

    } catch (error) {
        console.error("Error fetching order history: ", error);
        loader.style.display = 'none';
        // Display error message inside the list container
        historyListContainer.innerHTML = '<p class="text-red-500 font-bold text-center p-6">Error: Could not load order history.</p>';
        historyListContainer.classList.remove('hidden'); // Show error in list area
        noOrdersView.classList.add('hidden');
    }
} // End of _initOrderHistory

/**
 * Creates an HTML card element for a history item (request or order).
 */
function createHistoryCard(item) {
    const itemCard = document.createElement('div');
    itemCard.className = 'bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition'; // Base style

    // Safely format date
    const date = item.createdAt instanceof Timestamp
                 ? item.createdAt.toDate().toLocaleDateString()
                 : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown Date');

    const status = item.status || 'N/A';
    let statusColor = 'text-gray-600'; // Default

    // Determine Status Color (Covers both requests and orders)
    if (['DELIVERED', 'READY'].includes(status)) statusColor = 'text-green-600';
    else if (['CANCELLED'].includes(status)) statusColor = 'text-red-600';
    else if (['PICKUP_DONE', 'IN-PROCESS'].includes(status)) statusColor = 'text-blue-600'; // Combine processing states
    else if (['PROCESSING'].includes(status)) statusColor = 'text-purple-600';
    else if (['PENDING', 'ORDER_CREATED'].includes(status)) statusColor = 'text-yellow-600'; // Combine pending/waiting states

    let title = '';
    let detailsHtml = '';
    let ratingHtml = '';
    let isClickable = false; // Flag to add cursor pointer and click listener

    if (item.type === 'request') {
        title = `Request ID: #${item.id.substring(0, 6)}`;
        detailsHtml = `<p class="text-sm text-slate-500 mb-2">Slot: ${item.pickupSlot || 'N/A'}</p>`;
        // Requests are not clickable for details modal in this version
        isClickable = false;
        itemCard.style.opacity = '0.7'; // Make requests look slightly different (optional)
    } else { // item.type === 'order'
        title = `Order ID: #${item.id.substring(0, 6)}`;
        detailsHtml = `<p class="text-sm text-slate-600 mb-2">Total: <span class="font-semibold">₹${item.total?.toFixed(2) ?? '0.00'}</span></p>`;
        isClickable = true; // Orders are clickable

        // Rating logic for orders
        if (status === 'DELIVERED' && !item.ratingGiven) {
            // Show Rate Now text, but actual button is in modal triggered by card click
            ratingHtml = `<span class="text-xs font-semibold text-primary-blue mt-2 block">Rate Now</span>`;
        } else if (item.ratingGiven) {
            ratingHtml = `<p class="text-xs text-slate-500 mt-2">Rated <i class="fas fa-star text-yellow-400"></i> ${item.rating}</p>`;
        }
    }

    // Add clickable style if needed
    if(isClickable) {
        itemCard.classList.add('cursor-pointer');
    }

    // Populate the card HTML
    itemCard.innerHTML = `
        <div class="flex justify-between items-center mb-1">
            <span class="font-semibold text-slate-800">${title}</span>
            <span class="font-bold text-sm ${statusColor}">${status}</span>
        </div>
        ${detailsHtml}
        <p class="text-xs text-slate-400">Created on: ${date}</p>
        <div class="mt-1 rating-placeholder" id="rating-placeholder-${item.id}">
            ${ratingHtml}
        </div>
    `;

    // Add click listener ONLY for orders
    if (isClickable) {
        itemCard.addEventListener('click', () => {
            console.log(`Order card clicked: ${item.id}`);
            // Pass the specific item data (which includes 'items' array for orders)
            showOrderDetails(item, item.id);
        });
    }

    return itemCard;
}


// --- Modal Functions (Interact with elements in index.html) ---

function showOrderDetails(order, orderId) {
     // Check if modal elements are available before proceeding
     if (!modal || !modalOrderId || !modalOrderTotal || !modalOrderStatus || !modalOrderItems || !modalRatingBox || !starRatingInput || !submitRatingBtn) {
        console.error("Cannot show order details, modal elements missing from index.html!");
        alert("Error: Could not load order details view.");
        return;
    }
    console.log(`Showing details for order: ${orderId}`);

    // 1. Populate Basic Details
    modalOrderId.textContent = `#${orderId}`;
    modalOrderTotal.textContent = `₹${order.total?.toFixed(2) ?? '0.00'}`;
    modalOrderStatus.textContent = order.status || 'N/A';
    modalOrderDelivery.textContent = "Usually 2-3 Business Days"; // Static

    // Set Status Color
    const status = order.status;
    let statusColor = 'text-gray-600';
    if (status === 'DELIVERED' || status === 'READY') statusColor = 'text-green-600';
    else if (status === 'CANCELLED') statusColor = 'text-red-600';
    else if (status === 'PICKUP_DONE') statusColor = 'text-blue-600';
    else if (status === 'PROCESSING') statusColor = 'text-purple-600';
    else if (status === 'PENDING' || status === 'ORDER_CREATED') statusColor = 'text-yellow-600';
    modalOrderStatus.className = `font-semibold ${statusColor}`;

    // 2. Populate Items List
    modalOrderItems.innerHTML = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center border-b border-slate-100 pb-2 text-sm';
            const itemTotal = (typeof item.price === 'number' && typeof item.quantity === 'number')
                              ? (item.price * item.quantity).toFixed(2)
                              : 'N/A';
            li.innerHTML = `
                <span>
                    <span class="font-semibold text-slate-700">${item.name ?? 'Unknown Item'}</span>
                    <span class="text-slate-500"> (Qty: ${item.quantity ?? 'N/A'})</span>
                </span>
                <span class="font-medium text-slate-800">₹${itemTotal}</span>
            `;
            modalOrderItems.appendChild(li);
        });
    } else {
        modalOrderItems.innerHTML = '<li class="text-slate-500 text-sm">No items found for this order.</li>';
    }

    // --- 3. Update Status Timeline (Using Simplified 4 Steps) ---
    updateStatusTimeline(order.status); // Call the timeline update function

    // --- 4. Setup Rating Box ---
    if (order.status === 'DELIVERED' && !order.ratingGiven) {
        console.log("Order is delivered and not rated. Showing rating box.");
        currentOrderToRate = orderId;
        currentSelectedRating = 0;
        setupStarRating(0);
        submitRatingBtn.disabled = true;
        modalRatingBox.classList.remove('hidden');
    } else {
        console.log("Rating box not needed.");
        modalRatingBox.classList.add('hidden');
        currentOrderToRate = null;
    }

    // --- 5. Show Modal ---
    modal.classList.remove('hidden');
}

/** Hides the order details modal */
function hideOrderDetails() {
    if (modal) {
      console.log("Hiding order details modal.");
      modal.classList.add('hidden');
    }
}

// --- Status Timeline Function (Using Simplified 4 Steps) ---
function updateStatusTimeline(currentStatus) {
    const timeline = document.getElementById('order-status-timeline');
    if (!timeline) {
        console.error("Status timeline element not found!");
        return;
    }

    const steps = timeline.querySelectorAll('.status-step');
    const connectors = timeline.querySelectorAll('.status-connector');

    // Define the simplified order of statuses relevant for the timeline
    const statusOrder = ['PICKUP_DONE', 'PROCESSING', 'READY', 'DELIVERED'];

    // Map statuses to user-friendly time text
    const statusTimeText = {
        PICKUP_DONE: 'Picked Up',
        PROCESSING: 'In Progress',
        READY: 'Ready',
        DELIVERED: 'Completed'
    };

    let currentStatusFound = false;
    let currentStatusIndex = statusOrder.indexOf(currentStatus); // Find index of current status

    steps.forEach((step, index) => {
        const status = step.dataset.status; // Status this step represents
        const iconDiv = step.querySelector('.status-icon');
        const checkIcon = iconDiv?.querySelector('i.fa-check');
        const title = step.querySelector('.status-title');
        const time = step.querySelector('.status-time');
        const connector = connectors.length > index ? connectors[index] : null;

        if (!iconDiv || !checkIcon || !title || !time) {
             console.warn(`Missing elements within status step: ${status}`);
             return; // Skip this step if elements are missing
        }

        // --- Reset styles ---
        iconDiv.classList.remove('bg-primary-blue', 'border-primary-blue');
        iconDiv.classList.add('border-slate-300');
        // checkIcon.classList.add('hidden'); // Let's keep check always visible but control color via parent
        title.classList.remove('text-slate-800');
        title.classList.add('text-slate-500');
        time.textContent = 'Waiting...';
        if (connector) {
            connector.classList.add('hidden');
            connector.classList.remove('border-primary-blue');
            connector.classList.add('border-slate-300');
        }
        // --- End Reset ---

        const statusIndex = statusOrder.indexOf(status); // Find index of this step
        // A step is considered completed if its index is less than the current status's index
        let isCompleted = currentStatusIndex >= 0 && statusIndex < currentStatusIndex;
        const isCurrent = status === currentStatus;

        // Apply styles for completed or current steps
        if (isCompleted || isCurrent) {
            iconDiv.classList.add('bg-primary-blue', 'border-primary-blue');
            iconDiv.classList.remove('border-slate-300');
            // checkIcon.classList.remove('hidden'); // Show check
            title.classList.remove('text-slate-500');
            title.classList.add('text-slate-800');
            time.textContent = statusTimeText[status] || (isCurrent ? 'In Progress' : 'Completed');

            // Show and color the connector below this step if it's not the last step in the visual timeline
            if (connector && index < steps.length - 1) { // Check index against total steps shown
                 connector.classList.remove('hidden', 'border-slate-300');
                 connector.classList.add('border-primary-blue');
            }

            if (isCurrent) {
                currentStatusFound = true;
            }
        }
    });

    // If the currentStatus from DB wasn't in our defined statusOrder, log a warning
    // Also ignore statuses that are not part of the main order flow (like request statuses)
    const knownOrderStatuses = ['PICKUP_DONE', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED']; // Add other final statuses if needed
    if (currentStatus && !knownOrderStatuses.includes(currentStatus) && !['PENDING', 'IN-PROCESS', 'ORDER_CREATED'].includes(currentStatus)) {
        console.warn(`Unknown or non-timeline order status received: ${currentStatus}. Timeline might be incomplete.`);
    } else if (!currentStatusFound && currentStatus && knownOrderStatuses.includes(currentStatus)) {
         console.warn(`Current status ${currentStatus} was found but not matched in timeline logic?`);
    }
}


// --- Rating Functions ---

function setupStarRating(rating) {
     if (!starRatingInput || !submitRatingBtn) {
          console.error("Star rating elements not found during setup.");
          return;
     }
    currentSelectedRating = rating;
    const stars = starRatingInput.querySelectorAll('i.fa-star');
    stars.forEach(star => {
        const starValue = parseInt(star.dataset.value);
        star.classList.toggle('text-yellow-400', starValue <= rating);
        star.classList.toggle('text-slate-300', starValue > rating);
        if (!star.dataset.listenerAttached) {
             star.addEventListener('click', () => {
                console.log(`Star clicked: value ${starValue}`);
                setupStarRating(starValue);
                submitRatingBtn.disabled = false;
             });
             star.dataset.listenerAttached = 'true';
        }
    });
    console.log(`Star rating set to: ${rating}`);
}

async function submitRating() {
    if (currentSelectedRating === 0 || !currentOrderToRate) {
        alert("Please select a star rating (1-5).");
        return;
    }
     if (!submitRatingBtn) {
         console.error("Submit button element not found during submit.");
         return;
     }

    console.log(`Submitting rating ${currentSelectedRating} for order ${currentOrderToRate}`);
    submitRatingBtn.textContent = "Submitting...";
    submitRatingBtn.disabled = true;

    try {
        const orderRef = doc(db, "orders", currentOrderToRate);
        await updateDoc(orderRef, {
            rating: currentSelectedRating,
            ratingGiven: true
        });
        console.log("Rating submitted successfully.");
        alert("Thank you for your rating!");
        const placeholder = document.getElementById(`rating-placeholder-${currentOrderToRate}`);
        if(placeholder) {
            placeholder.innerHTML = `<p class="text-xs text-slate-500 mt-2">Rated <i class="fas fa-star text-yellow-400"></i> ${currentSelectedRating}</p>`;
        } else {
             console.warn("Could not find rating placeholder in list to update UI.");
             // Optional: Force reload the list if placeholder update fails
             // _initOrderHistory(currentUser); // Pass currentUser if reloading
        }
        hideOrderDetails();

    } catch (error) {
        console.error("Error submitting rating to Firestore: ", error);
        alert("Failed to submit rating. Please try again.");
         // Re-enable button ONLY on error
         submitRatingBtn.textContent = "Submit Rating";
         submitRatingBtn.disabled = false;
    }
    // Do not re-enable button on success here
}
