import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  if (await onboardingManager.checkRedirect()) {
    return;
  }
  
  // Highlight previously selected use case if it exists
  highlightSelectedUseCase();
})();

// Function to highlight the previously selected use case
function highlightSelectedUseCase() {
  const userData = onboardingManager.getUserData();
  if (!userData || !userData.use_case) return;
  
  const selectedUseCase = userData.use_case;
  const buttons = document.querySelectorAll('button[onclick^="selectUseCase"]');
  
  buttons.forEach(button => {
    // Extract the use case from the onclick attribute
    const onclickAttr = button.getAttribute('onclick');
    const useCaseMatch = onclickAttr.match(/selectUseCase\('(.+?)'\)/);
    
    if (useCaseMatch && useCaseMatch[1] === selectedUseCase) {
      // Add a visual indicator that this option was previously selected
      button.classList.add('selected-option');
      button.classList.add('bg-blue-100');
      button.classList.add('border-blue-500');
    }
  });
}

window.selectUseCase = async function(useCase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "../signup.html");

  // Show loading state
  const buttons = document.querySelectorAll('button[onclick^="selectUseCase"]');
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

  try {
    // Update the use case in Supabase
    const { error } = await supabase
      .from("users")
      .update({ use_case: useCase })
      .eq("id", user.id);

    if (error) {
      console.error("❌ Failed to update use case:", error);
      alert("Something went wrong saving your input.");
      return;
    }
    
    // Move to the next step
    await onboardingManager.nextStep();
  } catch (error) {
    console.error("Error updating use case:", error);
    alert("Something went wrong. Please try again.");
  } finally {
    // Reset UI state
    buttons.forEach(btn => btn.disabled = false);
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
});