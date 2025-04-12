import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';
import { getPagePath } from '../js/config.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  try {
    await onboardingManager.init();
    if (await onboardingManager.checkRedirect()) {
      return;
    }
    
    // Highlight previously selected role if it exists
    highlightSelectedRole();
  } catch (error) {
    console.error("Error initializing role page:", error);
  }
})();

// Function to highlight the previously selected role
function highlightSelectedRole() {
  const userData = onboardingManager.getUserData();
  if (!userData || !userData.role) return;
  
  const selectedRole = userData.role;
  const buttons = document.querySelectorAll('button[onclick^="selectRole"], .role-item');
  
  buttons.forEach(button => {
    const role = button.getAttribute('data-role') || 
                (button.getAttribute('onclick') || '').match(/selectRole\('(.+?)'\)/)?.[1];
    
    if (role === selectedRole) {
      button.classList.add('selected-option');
      button.classList.add('bg-blue-100');
      button.classList.add('border-blue-500');
    }
  });
}

// Reload on iOS/Safari BFCache restore
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

async function handleRoleSelection(role) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = getPagePath('index.html');
      return;
    }

    // Show loading state
    const buttons = document.querySelectorAll('button[onclick^="selectRole"], .role-item');
    buttons.forEach(btn => btn.disabled = true);
    
    // Add a loading indicator if it doesn't exist
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'loadingIndicator';
      loadingIndicator.className = 'mt-4 text-center';
      loadingIndicator.innerHTML = '<div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>';
      document.querySelector('.max-w-xl').appendChild(loadingIndicator);
    }
    loadingIndicator.style.display = 'block';

    // Update the role in Supabase
    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", user.id);

    if (error) {
      console.error("❌ Failed to update role:", error);
      throw error;
    }
    
    // Reload user data in onboarding manager
    await onboardingManager.loadUserData();
    
    // Move to the next step using onboarding manager
    await onboardingManager.nextStep();
  } catch (error) {
    console.error("Error updating role:", error);
    alert("Something went wrong. Please try again.");
  } finally {
    // Reset UI state
    const buttons = document.querySelectorAll('button[onclick^="selectRole"], .role-item');
    buttons.forEach(btn => btn.disabled = false);
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
}

// Global handler for onclick attributes
window.selectRole = (role) => handleRoleSelection(role);

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Force type="button" on all buttons to prevent form submit issues on iOS Safari
  document.querySelectorAll("button").forEach(btn => {
    btn.setAttribute("type", "button");
  });

  // Setup click handlers for role-item elements
  document.querySelectorAll('.role-item').forEach((item) => {
    const role = item.getAttribute('data-role');
    if (!role) return;

    // Remove any existing listeners
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    
    // Add new click handler
    newItem.addEventListener('click', (e) => {
      e.preventDefault();
      handleRoleSelection(role);
    });
  });
});
