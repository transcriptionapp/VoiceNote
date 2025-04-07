// Updated follow_up.js - Handling the Follow-Up Logic

import { supabase, getUserId } from "./config.js";
import { generateFollowUpEmail } from "./api.js";  // Assuming you already have this in api.js
import { SideNavManager } from './modules/sideNav.js'; // Adjust the path based on where your sideNav.js is located

const params = new URLSearchParams(window.location.search);
const recordingId = params.get("recording_id");

document.addEventListener("DOMContentLoaded", async () => {
  const sideNavManager = new SideNavManager();  // Initialize side navigation
  const loader = document.getElementById("loadingAnimation");
  const emailBox = document.getElementById("emailDraft");
  const gmailBtn = document.getElementById("sendViaGmail");

  if (!loader || !emailBox || !gmailBtn) return;

  // Load the transcription text and generate the email draft
  if (!recordingId) {
    emailBox.value = "❌ No recording ID found in the URL.";
    return;
  }

  loader.style.display = "block";

  // Generate the email draft using the recording ID
  try {
    const draft = await generateFollowUpEmail(recordingId);
    emailBox.value = draft;  // Set the generated follow-up email
    gmailBtn.disabled = false;
  } catch (err) {
    console.error("Error generating follow-up email:", err);
    emailBox.value = "❌ Error generating follow-up email.";
  } finally {
    loader.style.display = "none";
  }

  // Gmail button logic
  gmailBtn.addEventListener("click", () => {
    alert("📤 Gmail integration coming soon!");
  });
});

// Function to fetch transcription from Supabase
async function fetchTranscript(recordingId) {
  const { data, error } = await supabase
    .from("transcriptions")
    .select("text, edited_text")
    .eq("recording_id", recordingId)
    .single();

  if (error) return "";
  return data?.edited_text || data?.text || "";
}