import { supabase } from '/js/config.js';

window.selectRole = async function (role) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = '/login.html';

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to update role:', error);
    alert('Something went wrong saving your role.');
  } else {
    window.location.href = 'use_case.html';
  }
};