import { supabase } from '../js/config.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("Session:", session); // optional debug line
  if (!session || !session.user) {
    window.location.href = "../signup.html";
  } else {
    const { id, email } = session.user;
    const { error } = await supabase.from("users").upsert([{ id, email }], { onConflict: "id" });
    if (error) console.error("Failed to upsert user:", error);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-button');
  if (startBtn) {
    // Support both click and touchstart to cover iOS Safari & Chrome
    const handler = () => {
      window.location.href = './role.html';
    };
    startBtn.addEventListener('click', handler);
    startBtn.addEventListener('touchstart', handler);
  }
});