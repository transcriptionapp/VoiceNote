import { supabase } from "./modules/auth.js";
import { getBaseUrl } from "./utils.js";
import { authConfig, getPagePath } from "./config.js";

// Initialize UI elements
const authBtn = document.getElementById("authBtn");
const heading = document.getElementById("authHeading");
const togglePrompt = document.getElementById("togglePrompt");
const toast = document.getElementById("toast");
const backBtn = document.getElementById("backBtn");
const googleBtn = document.getElementById("googleBtn");

let mode = "signin";
let isRedirecting = false;
let isInitialLoad = true;

/**
 * Comprehensive session check and redirect handler
 * Ensures users can't access auth pages when already logged in
 */
async function checkExistingSession() {
  try {
    // First check if we're already redirecting
    if (isRedirecting) return true;

    // On initial load, only check local storage first
    if (isInitialLoad) {
      const storedSession = localStorage.getItem('sb-auth');
      if (!storedSession) {
        isInitialLoad = false;
        return false;
      }

      try {
        // Parse the stored session to check if it's valid
        const parsedSession = JSON.parse(storedSession);
        if (!parsedSession?.access_token) {
          localStorage.removeItem('sb-auth');
          isInitialLoad = false;
          return false;
        }
      } catch (e) {
        // If we can't parse the session, remove it
        localStorage.removeItem('sb-auth');
        isInitialLoad = false;
        return false;
      }
    }

    // Only make API calls if we have a stored session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      isInitialLoad = false;
      return false;
    }

    // If we have a valid session, proceed with redirect
    isRedirecting = true;
    
    // Disable all interactive elements while redirecting
    const interactiveElements = [authBtn, googleBtn, document.getElementById("email"), document.getElementById("password")];
    interactiveElements.forEach(el => {
      if (el) el.disabled = true;
    });

    // Show feedback to user
    showToast("✅ You're already signed in — redirecting...", "success");
    
    // Small delay for toast to be visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Redirect based on onboarding status
    await redirectBasedOnOnboarding(session.user.id);
    return true;
    
  } catch (error) {
    console.error("Session check error:", error);
    isInitialLoad = false;
    return false;
  }
}

// Check session immediately when script loads
checkExistingSession();

// Also check when the page becomes visible again (handles back button)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkExistingSession();
  }
});

// Handle history changes (back/forward navigation)
window.addEventListener('popstate', () => {
  checkExistingSession();
});

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("🔄 Auth state changed:", event, { user: session?.user?.id });
  
  if (event === "SIGNED_IN" && session?.user) {
    const { id, email } = session.user;

    try {
      // First check if the user already exists and their onboarding status
      const { data: existingUser, error: fetchError } = await supabase
        .from("users")
        .select("onboarded, role, use_case, tools, language")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) {
        console.error("❌ Failed to fetch user data:", fetchError);
        throw fetchError;
      }

      // For new users or users without complete data
      if (!existingUser || !existingUser.onboarded) {
        console.log("📝 Creating/updating user record for new or incomplete user");
        
        // Create/update user record with onboarded=false for new users
        const { error: upsertError } = await supabase
          .from("users")
          .upsert([{
            id,
            email,
            subscription_status: 'active',
            subscription_expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            credits_available: 3,
            onboarded: false, // Explicitly set to false for new users
            created_at: new Date().toISOString(),
            // Preserve existing fields if they exist
            role: existingUser?.role,
            use_case: existingUser?.use_case,
            tools: existingUser?.tools,
            language: existingUser?.language
          }], { onConflict: "id" });

        if (upsertError) {
          console.error("❌ Failed to create/update user:", upsertError);
          throw upsertError;
        }

        // Create/update user profile
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert([{ 
            user_id: id, 
            tier: "user", 
            admin: false 
          }], { onConflict: "user_id" });

        if (profileError) {
          console.error("❌ Failed to create/update user profile:", profileError);
          throw profileError;
        }

        console.log("✅ New user created, redirecting to onboarding");
        window.location.href = getPagePath('onboarding/welcome.html');
        return;
      }

      // For existing users who have completed onboarding
      if (existingUser.onboarded) {
        // Check if all required fields are filled
        const hasAllFields = existingUser.role && 
                           existingUser.use_case && 
                           existingUser.tools && 
                           existingUser.language;

        if (hasAllFields) {
          console.log("✅ Existing user with complete onboarding, redirecting to recorder");
          window.location.href = getPagePath('recorder.html');
          return;
        } else {
          console.log("⚠️ User marked as onboarded but missing fields, redirecting to onboarding");
          window.location.href = getPagePath('onboarding/welcome.html');
          return;
        }
      }

    } catch (error) {
      console.error("❌ Error during sign in processing:", error);
      showToast("❌ Something went wrong. Please try again.", "error");
      // On error, default to onboarding
      window.location.href = getPagePath('onboarding/welcome.html');
    }
  }
});

function showToast(message, type = "info") {
  toast.textContent = message;
  toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-xl text-white text-sm font-medium z-50 transition-opacity duration-300 ${
    type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500"
  }`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

/**
 * Handle authentication errors and display appropriate messages
 */
function handleAuthError(error, email) {
  console.error("Auth error:", error);
  
  const errorMessage = error.message?.toLowerCase() || "";
  
  if (errorMessage.includes("invalid login credentials")) {
    showToast("❌ Invalid email or password", "error");
  } else if (errorMessage.includes("email not confirmed")) {
    showToast(`📧 Please check your email (${email}) to confirm your account`, "info");
  } else if (errorMessage.includes("user already registered")) {
    showToast("❌ An account with this email already exists", "error");
    // Switch to sign in mode
    mode = "signin";
    updateUI();
  } else {
    showToast(`❌ ${error.message || "Authentication failed"}`, "error");
  }
}

/**
 * Clear any displayed form errors
 */
function clearFormErrors() {
  const errorElements = document.querySelectorAll('.error-message');
  errorElements.forEach(el => el.remove());
}

/**
 * Show an error message below an input field
 */
function showInputError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Remove any existing error for this input
  const existingError = input.parentElement.querySelector('.error-message');
  if (existingError) existingError.remove();

  // Create and insert error message
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message text-red-500 text-sm mt-1';
  errorDiv.textContent = message;
  input.parentElement.appendChild(errorDiv);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(isLoading) {
  authBtn.disabled = isLoading;
  authBtn.innerHTML = isLoading
    ? `<span class="loader"></span>`
    : mode === "signin" ? "Sign In" : "Sign Up";
}

function showFormError(field, message) {
  const errorElement = document.getElementById(`${field}Error`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    // Add red border to input
    const input = document.getElementById(field);
    if (input) {
      input.classList.add('border', 'border-red-500');
    }
  }
}

function updateUI() {
  clearFormErrors();
  heading.textContent = mode === "signin" ? "Welcome back" : "Create an account";
  authBtn.textContent = mode === "signin" ? "Sign In" : "Sign Up";
  togglePrompt.innerHTML = mode === "signin"
    ? `<span id="switchMode" class="block w-full cursor-pointer">Don't have an account? Sign up</span>`
    : `<span id="switchMode" class="block w-full cursor-pointer">Already have an account? Sign in</span>`;

  backBtn?.classList.toggle("hidden", mode === "signin");

  heading.classList.add("opacity-0");
  authBtn.classList.add("opacity-0");
  setTimeout(() => {
    heading.classList.remove("opacity-0");
    authBtn.classList.remove("opacity-0");
  }, 200);

  document.getElementById("switchMode").addEventListener("click", (e) => {
    e.preventDefault();
    mode = mode === "signin" ? "signup" : "signin";
    updateUI();
  });

  backBtn && (backBtn.onclick = () => {
    if (mode === "signup") {
      mode = "signin";
      updateUI();
    }
  });
}

// Initialize UI
updateUI();

// Handle authentication button clicks
authBtn.addEventListener("click", async () => {
  // First check if we already have a session
  if (await checkExistingSession()) {
    return;
  }

  clearFormErrors();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  let hasError = false;

  // Validate inputs
  if (!email) {
    showInputError("email", "Email is required");
    hasError = true;
  } else if (!isValidEmail(email)) {
    showInputError("email", "Please enter a valid email address");
    hasError = true;
  }

  if (!password) {
    showInputError("password", "Password is required");
    hasError = true;
  }

  if (hasError) return;

  // Disable button and show loading state
  authBtn.disabled = true;
  const originalText = authBtn.textContent;
  authBtn.textContent = "Loading...";

  try {
    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      showToast("✅ Successfully signed in", "success");
      console.log("Sign in successful:", data);
      
    } else { // Sign up mode
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getBaseUrl()}/auth/callback`
        }
      });

      if (error) throw error;

      showToast("✅ Check your email to confirm your account", "success");
      console.log("Sign up successful:", data);
    }
  } catch (error) {
    handleAuthError(error, email);
  } finally {
    // Restore button state
    authBtn.disabled = false;
    authBtn.textContent = originalText;
  }
});

// Handle Google OAuth
googleBtn?.addEventListener("click", async () => {
  if (await checkExistingSession()) {
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authConfig.signInRedirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;
    console.log("Google OAuth initiated:", data);
  } catch (error) {
    console.error("Google OAuth error:", error);
    showToast("❌ Failed to initialize Google sign in", "error");
  }
});

/**
 * Redirect user based on their onboarding status
 * @param {string} userId - The user's ID
 */
async function redirectBasedOnOnboarding(userId) {
  try {
    // Check if user has completed onboarding and has all required fields
    const { data, error } = await supabase
      .from("users")
      .select("onboarded, role, use_case, tools, language")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ Failed to check onboarding status:", error);
      // Default to onboarding if we can't determine status
      window.location.href = "./onboarding/welcome.html";
      return;
    }

    // Check if all required fields are filled and onboarding is marked as complete
    const allFieldsFilled = data?.role && data?.use_case && data?.tools && data?.language;
    
    // Redirect based on onboarding status and fields
    if (data?.onboarded && allFieldsFilled) {
      window.location.href = "./recorder.html";
    } else {
      window.location.href = "./onboarding/welcome.html";
    }
  } catch (error) {
    console.error("❌ Redirect error:", error);
    // Default to onboarding on error
    window.location.href = "./onboarding/welcome.html";
  }
}

// Rest of your existing code...