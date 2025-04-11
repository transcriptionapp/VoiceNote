import { supabase } from './js/modules/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = './index.html';
    return;
  }

  // Load user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error('Error loading user data:', userError);
    return;
  }

  // Update user info section
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userId').textContent = user.id;
  
  // Format dates
  const createdAt = new Date(user.created_at).toLocaleDateString();
  const lastLogin = new Date(user.last_sign_in_at).toLocaleDateString();
  document.getElementById('accountCreated').textContent = createdAt;
  document.getElementById('lastLogin').textContent = lastLogin;

  // Update preferences section
  document.getElementById('currentRole').textContent = userData.role || 'Not set';
  document.getElementById('currentUseCase').textContent = userData.use_case || 'Not set';
  document.getElementById('currentTools').textContent = userData.tools || 'Not set';
  document.getElementById('currentLanguage').textContent = userData.language || 'Not set';

  // Setup event listeners for preference buttons
  document.getElementById('editRole').addEventListener('click', () => {
    window.location.href = './onboarding/role.html';
  });

  document.getElementById('editUseCase').addEventListener('click', () => {
    window.location.href = './onboarding/use_case.html';
  });

  document.getElementById('editTools').addEventListener('click', () => {
    window.location.href = './onboarding/tools.html';
  });

  document.getElementById('editLanguage').addEventListener('click', () => {
    window.location.href = './onboarding/language.html';
  });

  // Setup data management buttons
  document.getElementById('deleteRecordings').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete all your recordings and transcripts? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete recordings from storage
      const { data: recordings } = await supabase
        .from('recordings')
        .select('storage_path')
        .eq('user_id', user.id);

      if (recordings) {
        for (const recording of recordings) {
          await supabase.storage
            .from('recordings')
            .remove([recording.storage_path]);
        }
      }

      // Delete recordings from database
      const { error: deleteError } = await supabase
        .from('recordings')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      alert('All recordings and transcripts have been deleted successfully.');
    } catch (error) {
      console.error('Error deleting recordings:', error);
      alert('Failed to delete recordings. Please try again.');
    }
  });

  document.getElementById('deleteAccount').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.')) {
      return;
    }

    try {
      // Delete user data from database
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      // Sign out the user
      await supabase.auth.signOut();
      
      // Redirect to home page
      window.location.href = './index.html';
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  });

  // Setup logout button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './index.html';
  });

  // Setup menu button
  document.getElementById('menuBtn').addEventListener('click', () => {
    window.location.href = './recorder.html';
  });
}); 