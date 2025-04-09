import { supabase } from '../js/config.js';

// Reload on iOS/Safari BFCache restore
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    window.location.href = '../signup.html';
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll("button").forEach(btn => btn.setAttribute("type", "button"));

  const roleItems = document.querySelectorAll('.role-item');

  roleItems.forEach((item) => {
    const role = item.getAttribute('data-role');

    const handler = async (event) => {
      event.preventDefault(); // prevent double-triggers
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return window.location.href = '../index.html';

      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update role:', error);
        alert('Something went wrong saving your role.');
      } else {
        window.location.href = './use_case.html';
      }
    };

    // Avoid duplicate handlers
    item.removeEventListener('click', handler);
    item.removeEventListener('touchstart', handler);
    item.addEventListener('click', handler);
    item.addEventListener('touchstart', handler);
  });
});
