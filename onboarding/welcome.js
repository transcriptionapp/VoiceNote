import { supabase } from '../config.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("Session:", session); // optional debug line
  if (!session || !session.user) {
    window.location.href = "signup.html";
  }
})();