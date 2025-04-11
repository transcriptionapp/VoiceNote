import { supabase } from "./modules/auth.js";
import { getUserId } from "./done.js";
import { generateFollowUpEmail } from "./api.js";
import { SideNavManager } from './modules/sideNav.js';

// Check session first
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    window.location.href = 'signup.html';
  }
})();

const params = new URLSearchParams(window.location.search);
const recordingId = params.get("recording_id");

document.addEventListener("DOMContentLoaded", async () => {
  const sideNavManager = new SideNavManager();  // Initialize side navigation
  sideNavManager.setupEvents();

  const loader = document.getElementById("loadingAnimation");
  const emailBox = document.getElementById("emailDraft");
  const gmailBtn = document.getElementById("sendViaGmail");
  const statusElement = document.getElementById("status");
  const backButton = document.querySelector('button[onclick="window.history.back()"]');

  // Remove the inline onclick handler and add our own
  if (backButton) {
    backButton.removeAttribute('onclick');
    backButton.addEventListener('click', () => {
      // Store a flag in sessionStorage to indicate we're returning from follow-up
      sessionStorage.setItem('returnFromFollowUp', 'true');
      // Navigate back
      window.location.href = './recorder.html';
    });
  }

  if (!loader || !emailBox || !gmailBtn) return;

  // Load the transcription text and generate the email draft
  if (!recordingId) {
    emailBox.value = "❌ No recording ID found in the URL.";
    if (statusElement) statusElement.textContent = "Error: No recording ID provided";
    return;
  }

  // Show loading state
  loader.classList.remove("hidden");
  if (statusElement) statusElement.textContent = "Loading transcription...";

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      throw new Error('No active session or user');
    }
    
    // First, fetch the existing transcription
    if (statusElement) statusElement.textContent = "Fetching transcription...";
    const transcription = await fetchTranscript(recordingId);
    
    if (!transcription) {
      throw new Error('No transcription found for this recording');
    }
    
    // Check if a follow-up email already exists
    if (statusElement) statusElement.textContent = "Checking for existing follow-up...";
    const existingFollowUp = await checkExistingFollowUp(recordingId);
    
    if (existingFollowUp) {
      // Display the existing follow-up
      emailBox.value = existingFollowUp.email_draft;
      if (statusElement) statusElement.textContent = "Follow-up email loaded";
      gmailBtn.disabled = false;
      loader.classList.add("hidden");
      
      // Show the save button since we have an existing follow-up
      const saveFollowUpBtn = document.getElementById("saveFollowUpBtn");
      if (saveFollowUpBtn) {
        saveFollowUpBtn.classList.remove("hidden");
      }
    } else {
      // No follow-up exists yet, keep the placeholder text and generate a follow-up
      emailBox.value = "";
      if (statusElement) statusElement.textContent = "Generating follow-up email...";
      loader.classList.remove("hidden");
      
      // Generate the follow-up email
      try {
        const result = await generateFollowUpEmail(recordingId, session.user.id);
        if (result && result.email_draft) {
          emailBox.value = result.email_draft;
          if (statusElement) statusElement.textContent = "Follow-up email generated";
          gmailBtn.disabled = false;
          
          // Show the save button since we've generated a new follow-up
          const saveFollowUpBtn = document.getElementById("saveFollowUpBtn");
          if (saveFollowUpBtn) {
            saveFollowUpBtn.classList.remove("hidden");
          }
        } else {
          if (statusElement) statusElement.textContent = "Failed to generate follow-up email";
          emailBox.value = "❌ Failed to generate follow-up email. Please try again.";
        }
      } catch (error) {
        console.error("Error generating follow-up:", error);
        if (statusElement) statusElement.textContent = "Error generating follow-up email";
        emailBox.value = "❌ Error generating follow-up email: " + error.message;
      } finally {
        loader.classList.add("hidden");
      }
    }
    
    // Update the page title to indicate this is a follow-up
    document.title = "Follow-Up Email | VoiceNote";
    
    // Update the header text
    const headerText = document.querySelector('h2');
    if (headerText) {
      headerText.textContent = "Follow-Up Email Generator";
    }
    
    // Update the subtitle - using a more reliable selector
    const subtitle = document.querySelector('.px-4 p');
    if (subtitle) {
      subtitle.textContent = "AI-generated email based on your transcription";
    }
    
  } catch (err) {
    console.error("Error processing follow-up:", err);
    emailBox.value = "❌ Error: " + err.message;
    if (statusElement) statusElement.textContent = "Error: " + err.message;
  } finally {
    loader.classList.add("hidden");
  }

  // Gmail button logic
  gmailBtn.addEventListener("click", () => {
    alert("📤 Gmail integration coming soon!");
  });
  
  // Save button logic
  const saveFollowUpBtn = document.getElementById("saveFollowUpBtn");
  if (saveFollowUpBtn) {
    const saveButton = saveFollowUpBtn.querySelector("button");
    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        try {
          if (statusElement) statusElement.textContent = "Saving follow-up...";
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) {
            throw new Error('No active session or user');
          }

          // Get the transcription data
          const transcription = await fetchTranscript(recordingId);
          if (!transcription) {
            throw new Error('No transcription found for this recording');
          }

          // Save the follow-up with all required fields
          await saveFollowUp(
            recordingId,
            emailBox.value,
            transcription.id,
            transcription.text.substring(0, 200) // Use first 200 chars as summary
          );
          
          if (statusElement) statusElement.textContent = "Follow-up saved successfully";
        } catch (error) {
          console.error("Error saving follow-up:", error);
          if (statusElement) statusElement.textContent = "Error saving follow-up: " + error.message;
        }
      });
    }
  }
});

// Function to fetch transcription from Supabase
async function fetchTranscript(recordingId) {
  try {
    const { data, error } = await supabase
      .from("transcriptions")
      .select("id, text")
      .eq("recording_id", recordingId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching transcription:", error);
    throw error;
  }
}

// Function to check if a follow-up email already exists
async function checkExistingFollowUp(recordingId) {
  try {
    console.log(`🔍 Checking for existing follow-up for recording_id: ${recordingId}`);
    
    const { data, error } = await supabase
      .from("follow_ups")
      .select("email_draft, transcription_id, summary")
      .eq("recording_id", recordingId)
      .single();

    if (error) {
      // If the error is not a "not found" error, log it
      if (error.code !== 'PGRST116') {
        console.error("❌ Error checking for existing follow-up:", error);
      }
      return null;
    }
    
    // Check if we have data
    if (!data) {
      console.log("ℹ️ No follow-up data found for recording_id:", recordingId);
      return null;
    }
    
    // Log what we found
    console.log("📧 Follow-up data found:", {
      hasEmailDraft: !!data.email_draft,
      emailDraftLength: data.email_draft?.length || 0,
      hasTranscriptionId: !!data.transcription_id,
      hasSummary: !!data.summary
    });
    
    return data;
  } catch (error) {
    console.error("❌ Error in checkExistingFollowUp:", error);
    throw error;
  }
}

// Expose the function to the global scope
window.checkExistingFollowUp = checkExistingFollowUp;

// Function to save follow-up
async function saveFollowUp(recordingId, emailDraft, transcriptionId, summary) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('No active session or user');

    const { error } = await supabase
      .from("follow_ups")
      .upsert({
        recording_id: recordingId,
        email_draft: emailDraft,
        transcription_id: transcriptionId,
        summary: summary,
        user_id: session.user.id,
        is_edited: true,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error saving follow-up:", error);
    throw error;
  }
}