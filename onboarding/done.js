import { supabase } from '../js/modules/auth.js';
import { onboardingManager } from '../js/modules/onboardingManager.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  await onboardingManager.checkRedirect();
})();

async function buildSummary() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToLogin();

  const { data, error } = await supabase
    .from('users')
    .select('role, use_case, tools, language')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    const fallbackSummary = `
      Great. You want to record high-value conversations like <strong>client calls</strong> 
      as a <strong>professional</strong>, mostly using <strong>your phone</strong>, 
      in <strong>English</strong>. We've set everything up to make your experience fast, 
      relevant, and tailored to you.
    `;
    document.getElementById('summary').innerHTML = fallbackSummary;
    return;
  }

  const { role, use_case, tools, language } = data;

  const summary = `
    Great. You want to record high-value conversations like <strong>${use_case || 'client calls'}</strong> 
    as a <strong>${role || 'professional'}</strong>, mostly using <strong>${tools || 'your phone'}</strong>, 
    in <strong>${language || 'English'}</strong>. We've set everything up to make your experience fast, 
    relevant, and tailored to you.
  `;

  document.getElementById('summary').innerHTML = summary;
}

async function goToApp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToLogin();

  try {
    // Mark onboarding as complete
    const success = await onboardingManager.completeOnboarding();
    
    if (!success) {
      throw new Error('Failed to complete onboarding');
    }

    // Redirect to main app
    window.location.href = "../recorder.html";
  } catch (error) {
    console.error('Error completing onboarding:', error);
    alert("Failed to finish onboarding. Try again.");
  }
}

function redirectToLogin() {
  window.location.href = "../index.html";
}

// 🔥 Attach button listener + render summary
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "../signup.html");

  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("❌ Failed to fetch user data:", error);
    return;
  }

  // Update UI with user data
  const nameElement = document.getElementById("userName");
  if (nameElement) {
    nameElement.textContent = userData.name || "there";
  }

  // Add event listener for the start button
  const startButton = document.getElementById("start-btn");
  if (startButton) {
    startButton.addEventListener("click", goToApp);
  }

  // Build the summary
  buildSummary();
});