import { supabase } from './config.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    window.location.href = 'signup.html';
  }
})();

import { MediaRecorderManager } from './modules/mediaRecorder.js';
import { TranscriptionManager } from './modules/transcriptionManager.js';
import { UIManager } from './modules/uiManager.js'; // Combine import from same module
import { getUserId } from './config.js';
import { SideNavManager } from './modules/sideNav.js';
import { uploadRecording, saveEditedTranscription } from './api.js';

// Initialize classes
const mediaRecorderManager = new MediaRecorderManager();
const transcriptionManager = new TranscriptionManager();
const uiManager = new UIManager();
let originalTranscript = "";
let currentRecordingId = "";

// Handle the navigation
document.addEventListener("DOMContentLoaded", () => {
  const sideNavManager = new SideNavManager();
  sideNavManager.setupEvents();

  // Handle start/stop recording
  document.getElementById("recordToggle").addEventListener("click", () => {
    if (mediaRecorderManager.isRecording) {
      mediaRecorderManager.stopRecording();
      uiManager.updateRecordingButton(false);
    } else {
      mediaRecorderManager.startRecording();
      uiManager.updateRecordingButton(true);
    }
  });

  // Listen for recording stop
  window.addEventListener("recordingStopped", async (event) => {
    const audioBlob = event.detail;
    currentRecordingId = crypto.randomUUID();
    if (!currentRecordingId) {
      uiManager.showError("Unable to generate recording ID.");
      uiManager.hideLoading();
      return;
    }
    uiManager.showLoading();

    const { file_url } = await uploadRecording(audioBlob, `recording_${currentRecordingId}.mp3`, currentRecordingId);

    if (file_url) {
      const transcription = await transcriptionManager.sendForTranscription(currentRecordingId, audioBlob);
      if (transcription) {
        originalTranscript = transcription;
        uiManager.updateTranscription(transcription);
        uiManager.updateFollowUpButton(true);
        uiManager.hideLoading();
      } else {
        uiManager.showError("Transcription failed");
      }
    } else {
      uiManager.showError("Upload failed");
    }
  });

  // Save edited transcription
  document.getElementById("saveTranscription").addEventListener("click", async () => {
    const transcriptionText = document.getElementById("transcriptionText").value.trim();

    if (transcriptionText && transcriptionText !== originalTranscript) {
      if (!currentRecordingId) {
        uiManager.showError("Failed to get recording ID.");
        return;
      }

      const success = await saveEditedTranscription(currentRecordingId, transcriptionText);
      if (!success) {
        uiManager.showError("Failed to save transcription.");
      } else {
        uiManager.updateUI("💾 Transcript saved");
        originalTranscript = transcriptionText;
        document.getElementById("saveTranscription").classList.add("hidden");
      }
    }
  });

  // Show/hide save button based on changes
  document.getElementById("transcriptionText").addEventListener("input", () => {
    const current = document.getElementById("transcriptionText").value.trim();
    const saveBtn = document.getElementById("saveTranscription");
    saveBtn.classList.toggle("hidden", current === originalTranscript.trim());
  });

  // Load past recordings
  loadPastRecordings();

  // Follow-up generation
  document.getElementById("gotoFollowup").addEventListener("click", async () => {
    const currentTranscript = document.getElementById("transcriptionText")?.value?.trim();
    const userId = await getUserId();

    if (!currentTranscript || currentTranscript.length === 0) {
      alert("⚠️ No transcription available to generate follow-up.");
      return;
    }

    uiManager.showLoading();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No session found, unable to proceed.");
      }

      const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transcription_id: currentRecordingId,
          user_id: userId,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate follow-up email");

      const result = await response.json();
      console.log("Follow-up generated:", result);

      uiManager.updateUI("💌 Follow-up generated successfully");
      if (currentRecordingId) {
        window.location.href = `./follow_up.html?recording_id=${currentRecordingId}`;
      } else {
        uiManager.showError("Missing recording ID for follow-up generation.");
      }
    } catch (error) {
      console.error("Error generating follow-up:", error);
      uiManager.showError("Failed to generate follow-up email");
    } finally {
      uiManager.hideLoading();
    }
  });
});

// Load past recordings from Supabase
async function loadPastRecordings() {
  const userId = await getUserId();

  if (!userId) {
    uiManager.showError("⚠️ User ID missing.");
    return;
  }

  const { data: recordings, error } = await supabase
    .from("recordings")
    .select("id, created_at, storage_path, transcriptions(text, edited_text)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    uiManager.showError("Failed to load past recordings.");
    return;
  }

  uiManager.loadRecordingList(recordings);
}