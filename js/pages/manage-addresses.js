import { currentUser, navigateTo } from '../main.js';

// --- Main Init Function (Router calls this) ---
export function init(hash, params) {
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    _initManageAddress();
  });
}

// --- Internal Page Logic ---
function _initManageAddress() {
  console.log("Running _initManageAddress...");
  
  // Get references to the elements
  const addressCard = document.getElementById('current-address-card');
  const noAddressView = document.getElementById('no-address-view');
  const addressText = document.getElementById('current-address-text');
  const editBtn = document.getElementById('edit-address-btn');
  const addAddressBtn = document.getElementById('add-address-btn'); // Button in empty state
  
  // **CRITICAL**: Check if elements exist
  if (!addressCard || !noAddressView || !addressText || !editBtn || !addAddressBtn) {
    console.error("Manage Address page elements NOT FOUND! Check IDs in manage-addresses.html.");
    // Optionally show error to user
    const contentArea = document.getElementById('manage-address-content');
    if (contentArea) contentArea.innerHTML = '<p class="p-4 text-red-600 font-bold">Error: Page elements missing.</p>';
    return; // Stop if elements are missing
  }
  console.log("Manage Address elements found.");
  
  // Check if user is logged in
  if (!currentUser) {
    console.warn("User not logged in. Redirecting to profile.");
    // Show a message briefly or redirect immediately
    noAddressView.classList.remove('hidden'); // Show empty view
    addressCard.classList.add('hidden'); // Hide address card
    // Modify empty view for login prompt
    noAddressView.querySelector('h2').textContent = "Please Log In";
    noAddressView.querySelector('p').textContent = "Log in to manage your saved address.";
    addAddressBtn.textContent = "Log In / Sign Up";
    addAddressBtn.onclick = () => navigateTo('profile'); // Link button to profile
    return;
  }
  
  // Check if the user has a saved address
  if (currentUser.address && currentUser.address.trim() !== '') {
    console.log("User has a saved address.");
    // User has an address - Show the address card
    addressText.textContent = currentUser.address; // Display the address
    addressCard.classList.remove('hidden'); // Show the card
    noAddressView.classList.add('hidden'); // Hide the empty state view
    
    // Set up the "Edit" button to go to the profile page
    editBtn.onclick = () => {
      console.log("Edit address button clicked.");
      navigateTo('profile'); // Navigate to profile to edit details
    };
    
  } else {
    console.log("User does not have a saved address.");
    // User has no address - Show the empty state view
    addressCard.classList.add('hidden'); // Hide the address card
    noAddressView.classList.remove('hidden'); // Show the empty state view
    
    // Set up the "Add Address" button to go to the profile page
    addAddressBtn.onclick = () => {
      console.log("Add address button clicked.");
      navigateTo('profile'); // Navigate to profile to add details
    };
  }
}