import { supabase } from '../js/config.js';

window.selectUseCase = async function(use_case) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "../signup.html");

  const { error } = await supabase
    .from("users")
    .update({ use_case })
    .eq("id", user.id);

  if (error) {
    console.error("❌ Failed to update use case:", error);
    alert("Something went wrong saving your input.");
  } else {
    // Ensure navigation works on all browsers including iOS
    window.location.assign("./tools.html");
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Force type="button" on all buttons to prevent form submit issues on iOS Safari
  document.querySelectorAll("button").forEach(btn => {
    btn.setAttribute("type", "button");
  });
});