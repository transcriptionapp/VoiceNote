import { supabase } from '/js/config.js';

async function buildSummary() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToLogin();

  const { data, error } = await supabase
    .from('users')
    .select('role, use_case, tools, language')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    document.getElementById('summary').textContent = "Something went wrong loading your info.";
    return;
  }

  const { role, use_case, tools, language } = data;

  const summary = `
    Great. You want to record high-value conversations like <strong>${use_case || 'client calls'}</strong> 
    as a <strong>${role || 'professional'}</strong>, mostly using <strong>${tools || 'your phone'}</strong>, 
    in <strong>${language || 'English'}</strong>. We've set everything up to make your experience fast, 
    relevant, and tailored to you.
  `;

  document.getElementById('summary').innerHTML = summary;
}

async function goToApp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToLogin();

  const { error } = await supabase
    .from('users')
    .update({
      onboarded: true,
      onboarded_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    alert("Failed to finish onboarding. Try again.");
  } else {
    window.location.href = "/html/recorder.html"; // Adjust path if needed
  }
}

function redirectToLogin() {
  window.location.href = "/html/index.html";
}

// 🔥 Attach button listener + render summary
document.getElementById("start-btn").addEventListener("click", goToApp);
buildSummary();