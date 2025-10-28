import { db } from '../../Firebase-Configuration.js';
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentUser } from '../main.js';

// --- Global variables for this page ---
let modal = null;
let modalCloseBtn = null;
let modalBackdrop = null;
let modalOrderId = null;
let modalOrderTotal = null;
let modalOrderStatus = null;
let modalOrderDelivery = null;
let modalOrderItems = null;
let modalRatingBox = null;
let starRatingInput = null;
let submitRatingBtn = null;

let currentSelectedRating = 0;
let currentOrderToRate = null;

// Main init function (router calls this)
export function init(hash, params) {
    // Delay slightly to ensure modal elements in index.html are ready
     requestAnimationFrame(() => {
        // Find modal elements once when the page loads
        modal = document.getElementById('order-details-modal');
        modalCloseBtn = document.getElementById('modal-close-btn');
        modalBackdrop = document.getElementById('modal-backdrop');
        modalOrderId = document.getElementById('modal-order-id');
        modalOrderTotal = document.getElementById('modal-order-total');
        modalOrderStatus = document.getElementById('modal-order-status');
        modalOrderDelivery = document.getElementById('modal-order-delivery');
        modalOrderItems = document.getElementById('modal-order-items');
        modalRatingBox = document.getElementById('modal-rating-box');
        starRatingInput = document.getElementById('star-rating-input');
        submitRatingBtn = document.getElementById('submit-rating-btn');

        // Check if modal elements were found
        if (!modal || !modalCloseBtn || !modalBackdrop || !modalRatingBox) {
            console.error("Order details modal elements not found in index.html!");
            // Optionally disable rating functionality or show an error
        } else {
             // Setup modal close listeners only once
             modalCloseBtn.onclick = hideOrderDetails;
             modalBackdrop.onclick = hideOrderDetails;
             submitRatingBtn.onclick = submitRating; // Rating submit listener
        }


        // Now load the order history list
        _initOrderHistory();
     });
}


async function _initOrderHistory() {
    const historyListContainer = document.getElementById('order-history-list');
    const loader = document.getElementById('order-history-loader');
    const noOrdersMessage = document.getElementById('no-orders-message');

    // Check if list elements are found
    if (!historyListContainer || !loader || !noOrdersMessage) {
        console.error("Order history list elements not found in order-history.html!");
        return;
    }


    loader.style.display = 'block';
    noOrdersMessage.classList.add('hidden');
    historyListContainer.innerHTML = '';
    historyListContainer.appendChild(loader);

    if (!currentUser) {
        loader.style.display = 'none';
        noOrdersMessage.textContent = 'Please log in to see your orders.';
        noOrdersMessage.classList.remove('hidden');
        return;
    }


    try {
        const q = query(
            collection(db, "orders"),
            where("customerId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        loader.style.display = 'none';

        if (querySnapshot.empty) {
            noOrdersMessage.textContent = "You haven't placed any final orders yet.";
            noOrdersMessage.classList.remove('hidden');
            return;
        }

        querySnapshot.forEach((docRef) => { // Use different name like docRef
            const order = docRef.data();
            const orderId = docRef.id; // Get the document ID
            const orderCard = document.createElement('div');
            orderCard.className = 'bg-white p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition'; // Make card clickable

            const date = order.createdAt ? order.createdAt.toDate().toLocaleDateString() : 'Pending Date';

            let statusColor = 'text-yellow-600';
            const status = order.status;
            if (status === 'DELIVERED' || status === 'READY') statusColor = 'text-green-600';
            if (status === 'CANCELLED') statusColor = 'text-red-600';
            if (status === 'PICKUP_DONE') statusColor = 'text-blue-600';
            if (status === 'PROCESSING') statusColor = 'text-purple-600';

            // --- RATING BUTTON LOGIC ---
            let ratingButtonHtml = '';
            if (order.status === 'DELIVERED' && !order.ratingGiven) {
                ratingButtonHtml = `<button class="text-xs font-semibold text-white bg-primary-blue px-2 py-1 rounded-md mt-2 rate-button" data-order-id="${orderId}">Rate Now</button>`;
            } else if (order.ratingGiven) {
                ratingButtonHtml = `<p class="text-xs text-slate-500 mt-2">Rated <i class="fas fa-star text-yellow-400"></i> ${order.rating}</p>`;
            }
            // --- END ---

            orderCard.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-semibold text-slate-800">Order ID: #${orderId.substring(0, 6)}</span>
                    <span class="font-bold text-sm ${statusColor}">${status || 'N/A'}</span>
                </div>
                <p class="text-sm text-slate-600 mb-2">Total: <span class="font-semibold">₹${order.total || 0}</span></p>
                <p class="text-xs text-slate-400">Placed on: ${date}</p>

                <div class="mt-2 rating-placeholder" id="rating-placeholder-${orderId}">
                    ${ratingButtonHtml}
                </div>
            `;

            // IMPORTANT: Add click listener to the CARD, not just the button
            orderCard.addEventListener('click', () => {
                showOrderDetails(order, orderId); // Pass order data and ID
            });


            historyListContainer.appendChild(orderCard);
        });

    } catch (error) {
        console.error("Error fetching order history: ", error);
        loader.style.display = 'none';
        historyListContainer.innerHTML = '<p class="text-red-500">Could not load order history.</p>';
    }
}

// --- Modal Functions ---

function showOrderDetails(order, orderId) {
     // Check if modal elements are available
     if (!modal || !modalOrderId || !modalOrderTotal || !modalOrderStatus || !modalOrderItems || !modalRatingBox) {
        console.error("Cannot show order details, modal elements missing.");
        alert("Error: Could not load order details view.");
        return;
    }


    // 1. Basic details
    modalOrderId.textContent = `#${orderId}`;
    modalOrderTotal.textContent = `₹${order.total || 0}`;
    modalOrderStatus.textContent = order.status || 'N/A';

    const status = order.status;
    let statusColor = 'text-yellow-600';
    if (status === 'DELIVERED' || status === 'READY') statusColor = 'text-green-600';
    if (status === 'CANCELLED') statusColor = 'text-red-600';
    if (status === 'PICKUP_DONE') statusColor = 'text-blue-600';
    if (status === 'PROCESSING') statusColor = 'text-purple-600';
    modalOrderStatus.className = `font-semibold ${statusColor}`;

    // 2. Items list
    modalOrderItems.innerHTML = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center border-b border-slate-100 pb-2';
            li.innerHTML = `
                <span>
                    <span class="font-semibold text-slate-700">${item.name}</span>
                    <span class="text-slate-500"> (Qty: ${item.quantity})</span>
                </span>
                <span class="font-medium text-slate-800">₹${(item.price * item.quantity).toFixed(2)}</span>
            `;
            modalOrderItems.appendChild(li);
        });
    } else {
        modalOrderItems.innerHTML = '<li class="text-slate-500">No items found for this order.</li>';
    }

    // 3. RATING BOX LOGIC
    if (order.status === 'DELIVERED' && !order.ratingGiven) {
        currentOrderToRate = orderId; // Save which order to rate
        currentSelectedRating = 0;
        setupStarRating(0);
        submitRatingBtn.disabled = true;
        modalRatingBox.classList.remove('hidden');
    } else {
        modalRatingBox.classList.add('hidden');
        currentOrderToRate = null;
    }

    // 4. Show modal
    modal.classList.remove('hidden');
}

function hideOrderDetails() {
    if (modal) {
      modal.classList.add('hidden');
    }
}

// --- Rating Functions ---

function setupStarRating(rating) {
     if (!starRatingInput || !submitRatingBtn) return; // Check if elements exist

    currentSelectedRating = rating;
    const stars = starRatingInput.querySelectorAll('i');

    stars.forEach(star => {
        const starValue = parseInt(star.dataset.value);
        star.classList.toggle('text-yellow-400', starValue <= rating);
        star.classList.toggle('text-slate-300', starValue > rating);

        // Add listener only once
        if (!star.dataset.listenerAttached) {
             star.addEventListener('click', () => {
                setupStarRating(starValue); // Update rating state
                submitRatingBtn.disabled = false; // Enable button
             });
             star.dataset.listenerAttached = 'true'; // Mark as attached
        }
    });
}

async function submitRating() {
    if (currentSelectedRating === 0 || !currentOrderToRate) {
        alert("Please select a star rating (1-5).");
        return;
    }
     if (!submitRatingBtn) return;


    submitRatingBtn.textContent = "Submitting...";
    submitRatingBtn.disabled = true;

    try {
        const orderRef = doc(db, "orders", currentOrderToRate);
        await updateDoc(orderRef, {
            rating: currentSelectedRating,
            ratingGiven: true
        });

        alert("Thank you for your rating!");

        // Update the UI in the order list immediately
        const placeholder = document.getElementById(`rating-placeholder-${currentOrderToRate}`);
        if(placeholder) {
            placeholder.innerHTML = `<p class="text-xs text-slate-500 mt-2">Rated <i class="fas fa-star text-yellow-400"></i> ${currentSelectedRating}</p>`;
        }

        hideOrderDetails(); // Close modal

    } catch (error) {
        console.error("Error submitting rating: ", error);
        alert("Failed to submit rating. Please try again.");
         // Re-enable button on error
         submitRatingBtn.textContent = "Submit Rating";
         submitRatingBtn.disabled = false; // Re-enable only if rating failed
    }
    // Note: Don't re-enable button on success, keep it disabled until next rating needed
}