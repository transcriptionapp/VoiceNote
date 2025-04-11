import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  if (await onboardingManager.checkRedirect()) {
    return;
  }
  
  // Highlight previously selected language if it exists
  highlightSelectedLanguage();
})();

// Function to highlight the previously selected language
function highlightSelectedLanguage() {
  const userData = onboardingManager.getUserData();
  if (!userData || !userData.language) return;
  
  const selectedLanguage = userData.language;
  const buttons = document.querySelectorAll('button[onclick^="selectLanguage"]');
  
  buttons.forEach(button => {
    // Extract the language from the onclick attribute
    const onclickAttr = button.getAttribute('onclick');
    const languageMatch = onclickAttr.match(/selectLanguage\('(.+?)'\)/);
    
    if (languageMatch && languageMatch[1] === selectedLanguage) {
      // Add a visual indicator that this option was previously selected
      button.classList.add('selected-option');
      button.classList.add('bg-blue-100');
      button.classList.add('border-blue-500');
    }
  });
}

window.selectLanguage = async function(language) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "../signup.html");

  // Show loading state
  const buttons = document.querySelectorAll('button[onclick^="selectLanguage"]');
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
    // Update the language in Supabase
    const { error } = await supabase
      .from("users")
      .update({ language: language })
      .eq("id", user.id);

    if (error) {
      console.error("❌ Failed to update language:", error);
      alert("Something went wrong saving your input.");
      return;
    }
    
    // Move to the next step
    await onboardingManager.nextStep();
  } catch (error) {
    console.error("Error updating language:", error);
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