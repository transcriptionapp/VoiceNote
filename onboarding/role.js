import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';
import { getPagePath } from '../js/config.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  if (await onboardingManager.checkRedirect()) {
    return;
  }
  
  // Highlight previously selected role if it exists
  highlightSelectedRole();
})();

// Function to highlight the previously selected role
function highlightSelectedRole() {
  const userData = onboardingManager.getUserData();
  if (!userData || !userData.role) return;
  
  const selectedRole = userData.role;
  const buttons = document.querySelectorAll('button[onclick^="selectRole"]');
  
  buttons.forEach(button => {
    // Extract the role from the onclick attribute
    const onclickAttr = button.getAttribute('onclick');
    const roleMatch = onclickAttr.match(/selectRole\('(.+?)'\)/);
    
    if (roleMatch && roleMatch[1] === selectedRole) {
      // Add a visual indicator that this option was previously selected
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

window.selectRole = async function(role) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = getPagePath('index.html');
      return;
    }

    // Show loading state
    const buttons = document.querySelectorAll('button[onclick^="selectRole"]');
    buttons.forEach(btn => btn.disabled = true);
    
    // Add a loading indicator if it doesn't exist
    let loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'loadingIndicator';
      loadingIndicator.className = 'mt-4 text-center';
      loadingIndicator.innerHTML = '<div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>';
      document.querySelector('.max-w-xl').appendChild(loadingIndicator);
    } else {
      loadingIndicator.style.display = 'block';
    }

    // Update the role in Supabase
    const { error } = await supabase
      .from("users")
      .update({ role: role })
      .eq("id", user.id);

    if (error) {
      console.error("❌ Failed to update role:", error);
      throw error;
    }
    
    // Reload user data in onboarding manager
    await onboardingManager.loadUserData();
    
    // Move to the next step
    await onboardingManager.nextStep();
  } catch (error) {
    console.error("Error updating role:", error);
    alert("Something went wrong. Please try again.");
  } finally {
    // Reset UI state
    const buttons = document.querySelectorAll('button[onclick^="selectRole"]');
    buttons.forEach(btn => btn.disabled = false);
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Force type="button" on all buttons to prevent form submit issues on iOS Safari
  document.querySelectorAll("button").forEach(btn => {
    btn.setAttribute("type", "button");
  });

  const roleItems = document.querySelectorAll('.role-item');

  roleItems.forEach((item) => {
    const role = item.getAttribute('data-role');

    const handler = async (event) => {
      event.preventDefault(); // prevent double-triggers
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return window.location.href = '../index.html';

      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update role:', error);
        alert('Something went wrong saving your role.');
      } else {
        window.location.href = './use_case.html';
      }
    };

    // Avoid duplicate handlers
    item.removeEventListener('click', handler);
    item.removeEventListener('touchstart', handler);
    item.addEventListener('click', handler);
    item.addEventListener('touchstart', handler);
  });
});
