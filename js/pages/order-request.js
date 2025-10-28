import { db } from '../../Firebase-Configuration.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentUser, userLocation, navigateTo } from '../main.js';

// Store ID for the current request
let currentStoreId = null;

// --- Main Init Function (Router calls this) ---
export function init(hash, params) {
    // Get storeId from URL parameters (e.g., #order-request?storeId=XYZ)
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const storeId = urlParams.get('storeId');

    _initOrderRequest(storeId);
}

// --- Internal Page Logic ---
function _initOrderRequest(storeId) {
    // **Critical Checks**: User must be logged in and have profile details
    if (!currentUser) {
        alert("You must be logged in to place a request.");
        navigateTo('profile'); // Redirect to profile/login
        return;
    }
    if (!currentUser.name || !currentUser.mobile || !currentUser.address) {
        alert("Please update your Full Name, Mobile Number, and Address in your profile before placing a request.");
        navigateTo('profile'); // Redirect to profile to update details
        return;
    }

    // Check if storeId was passed correctly
    if (!storeId) {
        console.error("Store ID not found in URL parameters!");
        alert("Could not identify the store. Please go back and select a store again.");
        navigateTo('stores'); // Redirect back to stores list
        return;
    }

    currentStoreId = storeId; // Save the storeId for submission

    // Get DOM elements *after* HTML is loaded
    const form = document.getElementById('order-request-form');
    const addressInput = document.getElementById('pickup-address');
    const slotSelect = document.getElementById('pickup-slot');
    const notesInput = document.getElementById('pickup-notes');
    const submitBtn = document.getElementById('submit-request-btn');
    const noteAssistantBtn = document.getElementById('note-assistant-btn'); // AI button

    if (!form || !addressInput || !slotSelect || !submitBtn) {
        console.error("Order request form elements not found!");
        return;
    }

    // Pre-fill address from user profile
    addressInput.value = currentUser.address;

    // Populate available pickup time slots
    populateTimeSlots(slotSelect);

    // Setup form submission listener
    form.onsubmit = handleSubmitRequest;

    // Setup AI assistant button (disabled for now)
    if (noteAssistantBtn) {
        noteAssistantBtn.onclick = () => {
            alert("AI Note Suggestions Coming Soon!");
        };
    }
}

/**
 * Handles the form submission logic.
 * @param {Event} event - The form submission event.
 */
async function handleSubmitRequest(event) {
    event.preventDefault(); // Prevent default browser form submission

    const addressInput = document.getElementById('pickup-address');
    const slotSelect = document.getElementById('pickup-slot');
    const notesInput = document.getElementById('pickup-notes');
    const submitBtn = document.getElementById('submit-request-btn');

    // Double-check necessary data
    if (!currentStoreId || !currentUser || !userLocation || !addressInput || !slotSelect || !submitBtn) {
        alert("An error occurred. Missing required data or elements.");
        return;
    }

    // Get form values
    const pickupAddress = addressInput.value.trim();
    const selectedSlot = slotSelect.value;
    const notes = notesInput ? notesInput.value.trim() : ''; // Handle if notesInput is missing

    // Basic validation
    if (!pickupAddress || !selectedSlot) {
        alert("Please ensure Pickup Address and Pickup Slot are selected.");
        return;
    }

    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    try {
        const requestData = {
            storeId: currentStoreId,

            // Customer Info (Sent to Admin)
            customerId: currentUser.uid,
            customerName: currentUser.name,
            customerMobile: currentUser.mobile,
            customerAddress: pickupAddress, // Use the address from the form
            customerLocation: { // Send user's current GPS location
                latitude: userLocation.lat,
                longitude: userLocation.lng
            },

            // Request Details
            pickupSlot: selectedSlot,
            notes: notes,
            status: "Pending", // Initial status
            createdAt: serverTimestamp() // Record the time
        };

        // **Save to 'pickup_requests' collection**
        const docRef = await addDoc(collection(db, "pickup_requests"), requestData);

        alert("Pickup Request Submitted Successfully!");
        // Optional: Reset form fields if needed
        // event.target.reset();
        navigateTo('order-history'); // Go to order history page

    } catch (error) {
        console.error("Error submitting pickup request: ", error);
        alert("Failed to submit request. Please try again.");
    } finally {
        // Re-enable button
        if (submitBtn) { // Check if button still exists
           submitBtn.textContent = "Confirm Request";
           submitBtn.disabled = false;
        }
    }
}

/**
 * Populates the time slot dropdown.
 * @param {HTMLSelectElement} selectElement - The select dropdown element.
 */
function populateTimeSlots(selectElement) {
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">Select a time slot</option>'; // Clear existing options

    // Example time slots - you might fetch these from the store's profile later
    const slots = [
        "Today, 4:00 PM - 6:00 PM",
        "Today, 6:00 PM - 8:00 PM",
        "Tomorrow, 10:00 AM - 12:00 PM",
        "Tomorrow, 12:00 PM - 2:00 PM",
        "Tomorrow, 4:00 PM - 6:00 PM"
    ];

    slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        selectElement.appendChild(option);
    });
}