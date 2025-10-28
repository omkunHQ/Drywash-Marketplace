import { db } from '../../Firebase-Configuration.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentUser, userLocation, navigateTo } from '../main.js';

// Store ID for the current request
let currentStoreId = null;

// --- Main Init Function (Router calls this) ---
export function init(hash, params) {
    requestAnimationFrame(() => {
        let storeId = null; // Initialize storeId as null

        // --- Log received hash and params object ---
        console.log(`Order Request init received hash: ${hash}, received params object:`, JSON.stringify(params));

        // Attempt 1: Try getting from params object (less reliable on refresh)
        // if (params && params.storeId) {
        //     storeId = params.storeId;
        //     console.log("Extracted storeId from params object:", storeId);
        // }

        // Attempt 2: Reliably parse the hash string (works on refresh too)
        if (hash && hash.includes('?')) {
             try {
                 const urlParams = new URLSearchParams(hash.split('?')[1]);
                 storeId = urlParams.get('storeId');
                 console.log("Extracted storeId by parsing hash string:", storeId);
             } catch (e) {
                 console.error("Error parsing hash parameters:", e);
                 storeId = null; // Ensure storeId is null if parsing fails
             }
        } else {
             console.warn("Hash string does not contain '?'. Cannot extract parameters from hash.");
             // Maybe try params object as a last resort?
             if (params && params.storeId) {
                storeId = params.storeId;
                console.log("Falling back to params object, extracted storeId:", storeId);
             } else {
                console.warn("storeId not found in params object either.");
             }
        }

        // --- Log the final determined storeId ---
        console.log("Final storeId before calling _initOrderRequest:", storeId);

        _initOrderRequest(storeId); // Call with the extracted (or null) storeId
    });
}

// --- Internal Page Logic ---
function _initOrderRequest(storeId) {
    console.log("Running _initOrderRequest...");
    // **Critical Checks**: User must be logged in and have profile details
    if (!currentUser) {
        console.warn("User not logged in. Redirecting to profile.");
        alert("You must be logged in to place a request.");
        navigateTo('profile'); // Redirect to profile/login
        return;
    }
    if (!currentUser.name || !currentUser.mobile || !currentUser.address) {
        console.warn("User profile incomplete. Redirecting to profile.");
        alert("Please update your Full Name, Mobile Number, and Address in your profile before placing a request.");
        navigateTo('profile'); // Redirect to profile to update details
        return;
    }
    
    // Check if storeId was passed correctly
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
        console.error("Store ID not found or invalid in URL parameters!");
        alert("Could not identify the store. Please go back and select a store again.");
        navigateTo('stores'); // Redirect back to stores list
        return;
    }
    console.log(`Store ID verified: ${storeId}`);
    
    currentStoreId = storeId; // Save the storeId for submission
    
    // Get DOM elements *after* HTML is loaded and checked
    const form = document.getElementById('order-request-form');
    const addressInput = document.getElementById('pickup-address');
    const slotSelect = document.getElementById('pickup-slot');
    const notesInput = document.getElementById('pickup-notes');
    const submitBtn = document.getElementById('submit-request-btn');
    const noteAssistantBtn = document.getElementById('note-assistant-btn'); // AI button
    
    // Check if form elements exist
    if (!form || !addressInput || !slotSelect || !submitBtn || !notesInput || !noteAssistantBtn) {
        console.error("Order request form elements NOT FOUND in order-request.html! Check IDs.");
        // Optionally display error to user if possible
        if (form) form.innerHTML = '<p class="text-red-600 font-bold">Error: Page elements missing.</p>';
        return; // Stop if elements are missing
    }
    console.log("Order request form elements found.");
    
    // Pre-fill address from user profile
    addressInput.value = currentUser.address;
    console.log("Address pre-filled from profile.");
    
    // Populate available pickup time slots
    populateTimeSlots(slotSelect);
    console.log("Time slots populated.");
    
    // Setup form submission listener
    form.onsubmit = handleSubmitRequest;
    console.log("Form submit listener attached.");
    
    // Setup AI assistant button (currently disabled visually and functionally)
    noteAssistantBtn.onclick = () => {
        alert("AI Note Suggestions Coming Soon!");
    };
}

/**
 * Handles the form submission logic.
 * @param {Event} event - The form submission event.
 */
async function handleSubmitRequest(event) {
    event.preventDefault(); // Prevent default browser form submission
    console.log("handleSubmitRequest triggered.");
    
    // Get elements again inside the handler to be safe
    const addressInput = document.getElementById('pickup-address');
    const slotSelect = document.getElementById('pickup-slot');
    const notesInput = document.getElementById('pickup-notes');
    const submitBtn = document.getElementById('submit-request-btn');
    
    // Double-check necessary data and elements
    if (!currentStoreId || !currentUser || !userLocation || !addressInput || !slotSelect || !submitBtn) {
        console.error("Submit failed: Missing required data or elements.", { currentStoreId, currentUserExists: !!currentUser, userLocationExists: !!userLocation });
        alert("An error occurred. Missing required data. Please try again.");
        return;
    }
    
    // Get form values
    const pickupAddress = addressInput.value.trim();
    const selectedSlot = slotSelect.value;
    const notes = notesInput ? notesInput.value.trim() : '';
    
    // Basic validation
    if (!pickupAddress || !selectedSlot) {
        console.warn("Submit failed: Address or Slot missing.");
        alert("Please ensure Pickup Address and Pickup Slot are selected.");
        return;
    }
    
    console.log("Form data validated. Submitting...");
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;
    
    try {
        const requestData = {
            storeId: currentStoreId,
            
            // Customer Info (Sent to Admin)
            customerId: currentUser.uid,
            customerName: currentUser.name, // Added previously
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
            createdAt: serverTimestamp() // Record the time on the server
        };
        
        console.log("Saving request data to Firestore:", requestData);
        // **Save to 'pickup_requests' collection**
        const docRef = await addDoc(collection(db, "pickup_requests"), requestData);
        console.log("Pickup request submitted successfully. Document ID:", docRef.id);
        
        alert("Pickup Request Submitted Successfully!");
        // Optional: Reset form fields if needed
        // event.target.reset();
        navigateTo('order-history'); // Go to order history page
        
    } catch (error) {
        console.error("Error submitting pickup request to Firestore: ", error);
        alert("Failed to submit request. Please check your internet connection and try again.");
    } finally {
        // Re-enable button regardless of success or failure
        if (submitBtn) { // Check if button still exists
            submitBtn.textContent = "Confirm Request";
            submitBtn.disabled = false;
            console.log("Submit button re-enabled.");
        }
    }
}

/**
 * Populates the time slot dropdown.
 * @param {HTMLSelectElement} selectElement - The select dropdown element.
 */
function populateTimeSlots(selectElement) {
    if (!selectElement) {
        console.error("Cannot populate time slots: selectElement is missing.");
        return;
    }
    
    selectElement.innerHTML = '<option value="">Select a time slot</option>'; // Clear existing options
    
    // Example time slots - In a real app, fetch these based on store hours/availability
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
