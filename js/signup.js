import { supabase } from "config.js";

// Check if session exists and redirect immediately if logged in
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    redirectBasedOnOnboarding(session.user.id);
  }
});

let mode = "signin";

const authBtn = document.getElementById("authBtn");
const heading = document.getElementById("authHeading");
const togglePrompt = document.getElementById("togglePrompt");
const toast = document.getElementById("toast");
const backBtn = document.getElementById("backBtn");
const googleBtn = document.getElementById("googleBtn");

function showToast(message, type = "info") {
  toast.textContent = message;
  toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-xl text-white text-sm font-medium z-50 transition-opacity duration-300 ${
    type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500"
  }`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(isLoading) {
  authBtn.disabled = isLoading;
  authBtn.innerHTML = isLoading
    ? `<span class="loader"></span>`
    : mode === "signin" ? "Sign In" : "Sign Up";
}

function updateUI() {
  heading.textContent = mode === "signin" ? "Welcome back" : "Create an account";
  authBtn.textContent = mode === "signin" ? "Sign In" : "Sign Up";
  togglePrompt.innerHTML = mode === "signin"
    ? `<span id="switchMode" class="block w-full cursor-pointer">Don’t have an account? Sign up</span>`
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
    } else {
      window.history.back();
    }
  });
}

updateUI();

async function waitForSession(maxTries = 8) {
  for (let i = 0; i < maxTries; i++) {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (userId) return userId;
    await new Promise((res) => setTimeout(res, i < 3 ? 500 : 1000));
  }
  return null;
}

async function redirectBasedOnOnboarding(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("onboarded")
    .eq("id", userId)
    .single();

  if (error || data?.onboarded !== true) {
    window.location.href = "./onboarding/welcome.html";
  } else {
    window.location.href = "recorder.html";
  }
}

authBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showToast("⚠️ Email and password required.", "error");
    return;
  }
  if (!isValidEmail(email)) {
    showToast("⚠️ Please enter a valid email address.", "error");
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const alreadySignedIn = sessionData?.session?.user;

  if (mode === "signup" && alreadySignedIn) {
    showToast("⚠️ You're already signed in. Sign out before signing up.", "error");
    return;
  }

  try {
    setLoading(true);

    if (mode === "signin") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        showToast(`❌ ${signInError.message}`, "error");
        return;
      }
      showToast("✅ Logged in! Redirecting...", "success");
      setTimeout(() => redirectBasedOnOnboarding(data?.user?.id), 1000);
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        showToast(`❌ ${signUpError.message}`, "error");
        return;
      }

      const userId = await waitForSession();
      if (!userId) {
        showToast("❌ Auth succeeded, but session not ready.", "error");
        return;
      }

      const { error: insertError } = await supabase
        .from("users")
        .upsert([{ id: userId, email }], { onConflict: "id" });

      if (insertError) {
        showToast(`⚠️ Auth succeeded, DB insert failed: ${insertError.message}`, "error");
        return;
      }

      showToast("✅ Account created! Redirecting...", "success");
      setTimeout(() => redirectBasedOnOnboarding(userId), 1000);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    showToast("❌ Something went wrong.", "error");
  } finally {
    setLoading(false);
  }
});

googleBtn?.addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/VoiceNote/onboarding/welcome.html`,
      },
    });

    if (error) {
      showToast(`❌ Google sign-in failed: ${error.message}`, "error");
    } else {
      showToast("✅ Google login started, check popup or redirect.", "info");
    }
  } catch (err) {
    console.error("Google OAuth error", err);
    showToast("❌ Google sign-in failed.", "error");
  }
});