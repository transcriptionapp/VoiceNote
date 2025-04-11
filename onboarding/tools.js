import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  if (await onboardingManager.checkRedirect()) {
    return;
  }
  
  // Highlight previously selected tools if they exist
  highlightSelectedTools();
})();

// Function to highlight the previously selected tools
function highlightSelectedTools() {
  const userData = onboardingManager.getUserData();
  if (!userData || !userData.tools) return;
  
  const selectedTools = userData.tools.split(',').map(tool => tool.trim());
  const buttons = document.querySelectorAll('button[data-tool]');
  
  buttons.forEach(button => {
    const tool = button.getAttribute('data-tool');
    if (selectedTools.includes(tool)) {
      button.classList.add('selected');
      button.classList.add('bg-blue-100');
      button.classList.add('border-blue-500');
    }
  });
}

// Function to toggle tool selection - exposed to global scope
window.toggleTool = function(button) {
  button.classList.toggle('selected');
  button.classList.toggle('bg-blue-100');
  button.classList.toggle('border-blue-500');
};

// Function to get selected tools
function getSelectedTools() {
  const selectedTools = [];
  document.querySelectorAll('button[data-tool].selected').forEach(button => {
    selectedTools.push(button.getAttribute('data-tool'));
  });
  return selectedTools;
}

// Function to handle form submission - exposed to global scope
window.submitTools = async function() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "../signup.html");

  // Show loading state
  const nextButton = document.getElementById('nextButton');
  if (nextButton) {
    nextButton.disabled = true;
    nextButton.innerHTML = '<span class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span> Saving...';
  }
  
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
    const selectedTools = getSelectedTools();
    
    // If no tools selected, show error
    if (selectedTools.length === 0) {
      alert("Please select at least one option.");
      return;
    }
    
    // Update the tools in Supabase
    const { error } = await supabase
      .from("users")
      .update({ tools: selectedTools.join(',') })
      .eq("id", user.id);

    if (error) {
      console.error("❌ Failed to update tools:", error);
      alert("Something went wrong saving your input.");
      return;
    }
    
    // Move to the next step
    await onboardingManager.nextStep();
  } catch (error) {
    console.error("Error updating tools:", error);
    alert("Something went wrong. Please try again.");
  } finally {
    // Reset UI state
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.innerHTML = 'Next →';
    }
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
};

// Set up event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Force type="button" on all buttons to prevent form submit issues on iOS Safari
  document.querySelectorAll("button").forEach(btn => {
    btn.setAttribute("type", "button");
  });
});