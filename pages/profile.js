import { currentUser } from '../main.js';
// Auth functions ko alag se import karna padega
import { handleLogout, initAuth } from '../auth.js';
import { db } from '../../Firebase-Configuration.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Main init function (router calls this)
export function init(hash, params) {
    // DOM elements access karne se pehle thoda wait karein
    requestAnimationFrame(() => {
        _initProfile();
    });
}

// Internal function jo page ka kaam karta hai
function _initProfile() {

    // Sabhi elements ko function ke andar define karein
    const profilePic = document.getElementById('profile-pic');
    const profileName = document.getElementById('profile-name'); // Yeh <h2> tag hai
    const profileEmail = document.getElementById('profile-email');

    const authContainer = document.getElementById('auth-container');
    const authFormCard = document.getElementById('auth-form-card');
    const logoutBtn = document.getElementById('logout-btn');

    const profileDetailsContainer = document.getElementById('profile-details-container');
    const profileUpdateForm = document.getElementById('profile-update-form');

    const profileNameInput = document.getElementById('profile-name-input'); // Yeh <input> tag hai
    const profileMobileInput = document.getElementById('profile-mobile');
    const profileAddressInput = document.getElementById('profile-address');

    if (!profilePic || !authContainer || !profileDetailsContainer || !profileNameInput || !logoutBtn || !profileUpdateForm) {
        console.error("Profile page elements not found. Page may not render correctly.");
        return; // Agar elements nahi mile toh aage na badhein
    }

    if (currentUser) {
        // --- User is LOGGED IN ---

        // 1. User info dikhayein
        profileName.textContent = currentUser.name || 'User';
        profileEmail.textContent = currentUser.email || 'No email';
        if (currentUser.photoURL) {
            profilePic.src = currentUser.photoURL;
        } else {
            profilePic.src = `https://placehold.co/64x64/ea580c/white?text=${(currentUser.name || 'U').charAt(0).toUpperCase()}`;
        }

        // 2. Auth form chhipayein, profile form dikhayein
        authContainer.style.display = 'none'; // Poora auth container hide karein
        profileDetailsContainer.classList.remove('hidden');
        logoutBtn.classList.remove('hidden'); // Logout button dikhayein

        // 3. Profile update form mein data bharein
        profileNameInput.value = currentUser.name || '';
        profileMobileInput.value = currentUser.mobile || '';
        profileAddressInput.value = currentUser.address || '';

        // 4. Listeners set karein
        logoutBtn.onclick = handleLogout; // auth.js se import kiya gaya function
        profileUpdateForm.onsubmit = handleProfileUpdate;

    } else {
        // --- User is LOGGED OUT ---

        // 1. Guest info dikhayein
        profileName.textContent = 'Guest User';
        profileEmail.textContent = 'Please log in';
        profilePic.src = 'https://placehold.co/64x64/cccccc/333333?text=User';

        // 2. Profile form chhipayein, auth form dikhayein
        authContainer.style.display = 'block'; // Poora auth container dikhayein
        profileDetailsContainer.classList.add('hidden');
        logoutBtn.classList.add('hidden'); // Logout button chhipayein

        // 3. Login/signup form ke listeners chalu karein (auth.js se import kiya gaya function)
        initAuth();
    }
}

// Function to handle profile update
async function handleProfileUpdate(event) {
    event.preventDefault();
    if (!currentUser) return;

    // Elements ko dobara access karein
    const profileNameInput = document.getElementById('profile-name-input');
    const profileMobileInput = document.getElementById('profile-mobile');
    const profileAddressInput = document.getElementById('profile-address');
    const profileUpdateBtn = document.getElementById('profile-update-btn');

    // Check if elements exist before accessing value
    if (!profileNameInput || !profileMobileInput || !profileAddressInput || !profileUpdateBtn) {
        console.error("Profile update form elements missing during submit.");
        return;
    }


    const newName = profileNameInput.value;
    const newMobile = profileMobileInput.value;
    const newAddress = profileAddressInput.value;

    if (!newName || !newMobile || !newAddress) {
        alert("Please fill in all required fields (Name, Mobile, Address).");
        return;
    }

    profileUpdateBtn.textContent = "Saving...";
    profileUpdateBtn.disabled = true;

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            name: newName,
            mobile: newMobile,
            address: newAddress
        });

        // Local currentUser object ko bhi update karein (Bahut Zaroori)
        currentUser.name = newName;
        currentUser.mobile = newMobile;
        currentUser.address = newAddress;

        // UI (h2 tag) ko bhi update karein
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) profileNameEl.textContent = newName;


        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile: ", error);
        alert("Error updating profile. Please try again.");
    } finally {
        profileUpdateBtn.textContent = "Save Details";
        profileUpdateBtn.disabled = false;
    }
}