import { supabase } from '/js/config.js';

const selectedTools = new Set();

window.toggleTool = (button) => {
  const value = button.innerText;
  if (selectedTools.has(value)) {
    selectedTools.delete(value);
    button.classList.remove('selected');
  } else {
    selectedTools.add(value);
    button.classList.add('selected');
  }
};

window.submitTools = async () => {
  if (selectedTools.size === 0) {
    return alert("Please select at least one option.");
  }

  const tools = Array.from(selectedTools).join(', ');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = "/login.html";

  const { error } = await supabase
    .from("users")
    .update({ tools })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update tools:", error);
    alert("Something went wrong saving your input.");
  } else {
    window.location.href = "language.html";
  }
};