import { supabase } from '../js/config.js';

const selectedTools = new Set();
let isSubmitting = false;

// Enhance toggleTool to support both click and touch
function toggleTool(button) {
  const value = button.innerText;
  if (selectedTools.has(value)) {
    selectedTools.delete(value);
    button.classList.remove('selected');
  } else {
    selectedTools.add(value);
    button.classList.add('selected');
  }
}

// Ensure all buttons behave consistently across devices
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach(btn => {
    btn.setAttribute("type", "button");

    // Add support for both click and touchstart (especially for iOS Safari)
    if (btn.matches(".btn-secondary")) {
      btn.addEventListener("click", () => toggleTool(btn));
      btn.addEventListener("touchstart", () => toggleTool(btn));
    }

    if (btn.id === "submit-tools") {
      btn.addEventListener("click", submitTools);
      btn.addEventListener("touchstart", submitTools);
    }
  });
});

// Safe & robust submit function
async function submitTools() {
  if (isSubmitting) return; // prevent double submit
  isSubmitting = true;

  if (selectedTools.size === 0) {
    alert("Please select at least one option.");
    isSubmitting = false;
    return;
  }

  try {
    const tools = Array.from(selectedTools).join(', ');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("User not found:", authError);
      window.location.href = "../signup.html";
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ tools })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to update tools:", error);
      alert("Something went wrong saving your input.");
    } else {
      window.location.href = "./language.html";
    }
  } catch (err) {
    console.error("Unexpected error in submitTools:", err);
    alert("Unexpected error occurred.");
  } finally {
    isSubmitting = false;
  }
}