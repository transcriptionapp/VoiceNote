import { supabase } from '../js/config.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("Session:", session); // optional debug line
  if (!session || !session.user) {
    window.location.href = "../signup.html";
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-button');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      window.location.href = './role.html';
    });
  }
});