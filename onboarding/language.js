import { supabase } from '../js/config.js';

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button").forEach(btn => btn.setAttribute("type", "button"));
});

window.selectLanguage = async function (language) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = '/index.html';

  const { error } = await supabase
    .from('users')
    .update({ language })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to update language:', error);
    alert('Something went wrong saving your language.');
  } else {
    window.location.href = './done.html';
  }
};