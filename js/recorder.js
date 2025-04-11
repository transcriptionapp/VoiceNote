import { supabase } from "./modules/auth.js";
import { MediaRecorderManager } from './modules/mediaRecorder.js';
import { TranscriptionManager } from './modules/transcriptionManager.js';
import { UIManager } from './modules/uiManager.js';
import { SideNavManager } from './modules/sideNav.js';
import { uploadRecording, saveEditedTranscription } from './api.js';

// Initialize classes
const mediaRecorderManager = new MediaRecorderManager();
const transcriptionManager = new TranscriptionManager();
const uiManager = new UIManager();
let originalTranscript = "";
let currentRecordingId = "";

// Function to enable the follow-up button
function enableFollowUpButton() {
  const followupBtn = document.getElementById("gotoFollowup");
  if (followupBtn) {
    followupBtn.disabled = false;
    followupBtn.removeAttribute("title");
  }
}

// Function to disable the follow-up button
function disableFollowUpButton() {
  const followupBtn = document.getElementById("gotoFollowup");
  if (followupBtn) {
    followupBtn.disabled = true;
    followupBtn.title = "Create a recording first and wait until transcribed to generate follow up";
  }
}

// Handle the navigation
document.addEventListener("DOMContentLoaded", async () => {
  // Check authentication first
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    window.location.href = 'signup.html';
    return;
  }

  const sideNavManager = new SideNavManager();
  sideNavManager.setupEvents();

  // Check if returning from follow-up page
  if (sessionStorage.getItem('returnFromFollowUp') === 'true') {
    // Clear the flag
    sessionStorage.removeItem('returnFromFollowUp');
    // Reset the UI
    resetUI();
  }

  // Initial setup of the Follow-up generation button (disable and add tooltip)
  disableFollowUpButton();

  // Load past recordings immediately when the page loads
  loadPastRecordings();

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
    const { audioBlob } = event.detail;
    
    try {
      // Show transcription loading spinner
      document.getElementById("transcriptionLoadingSpinner").classList.remove("hidden");
      
      // Upload the recording
      const uploadResult = await transcriptionManager.uploadRecording(audioBlob, crypto.randomUUID());
      if (!uploadResult) {
        throw new Error("Failed to upload recording");
      }
      
      currentRecordingId = uploadResult.recording_id;
      
      // Send for transcription
      const transcriptionResult = await transcriptionManager.sendForTranscription(
        uploadResult.recording_id,
        uploadResult.file_url,
        uploadResult.storage_path
      );
      
      // Hide transcription loading spinner
      document.getElementById("transcriptionLoadingSpinner").classList.add("hidden");
      
      // Update UI with transcription
      if (transcriptionResult && transcriptionResult.text) {
        uiManager.updateTranscription(transcriptionResult.text);
        originalTranscript = transcriptionResult.text;
        
        // Enable follow-up button
        enableFollowUpButton();
        
        // Load past recordings with the new recording highlighted
        loadPastRecordings(currentRecordingId);
      }
    } catch (error) {
      // Hide transcription loading spinner
      document.getElementById("transcriptionLoadingSpinner").classList.add("hidden");
      
      console.error('Error processing recording:', error);
      uiManager.displayError('Failed to process recording: ' + error.message);
    }
  });

  // Follow-up generation
  document.getElementById("gotoFollowup").addEventListener("click", async () => {
    const currentTranscript = document.getElementById("transcriptionText")?.value?.trim();
    const { data: { user } } = await supabase.auth.getUser();

    if (!currentTranscript || currentTranscript.length === 0) {
      alert("⚠️ No transcription available to generate follow-up.");
      return;
    }

    if (!user?.id) {
      alert("⚠️ Not authenticated. Please sign in again.");
      return;
    }

    // Redirect immediately to follow-up page
    window.location.href = `/follow_up.html?recording_id=${currentRecordingId}`;
    
    // Generate follow-up in the background (this will continue after redirect)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session found, unable to generate follow-up in background");
        return;
      }

      const accessToken = session.access_token;
      
      // Use direct fetch with proper authorization headers
      console.log("📡 Sending follow-up generation request to Edge Function in background");
      
      fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          recording_id: currentRecordingId,
          user_id: user.id,
        })
      })
      .then(response => {
        if (!response.ok) {
          console.error("❌ Background follow-up generation failed:", response.status);
          return;
        }
        return response.json();
      })
      .then(result => {
        if (result?.email_draft) {
          console.log("✅ Background follow-up generation successful");
        } else {
          console.error("❌ Background follow-up generation failed: No email draft returned");
        }
      })
      .catch(error => {
        console.error("❌ Background follow-up generation error:", error);
      });
    } catch (error) {
      console.error("❌ Error initiating background follow-up generation:", error);
    }
  });
});

// Load past recordings from Supabase
async function loadPastRecordings(highlightRecordingId = null) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    uiManager.displayError("⚠️ Not authenticated. Please sign in again.");
    return;
  }

  try {
    // Show loading state
    const recordingsList = document.getElementById("recordingsList");
    if (recordingsList) {
      recordingsList.innerHTML = '<div class="text-center py-4 text-gray-500">Loading recordings...</div>';
    }

    const { data: recordings, error } = await supabase
      .from("recordings")
      .select(`
        id,
        created_at,
        storage_path,
        file_url,
        transcriptions (
          text,
          edited_text
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Failed to load recordings:", error);
      uiManager.displayError("Failed to load past recordings.");
      return;
    }

    // Process recordings to include transcription text
    const processedRecordings = recordings.map(recording => ({
      ...recording,
      transcription: recording.transcriptions?.[0]?.edited_text || recording.transcriptions?.[0]?.text || 'No transcription available'
    }));

    // Load the recordings list with optional highlighting
    uiManager.loadRecordingList(processedRecordings, highlightRecordingId);
  } catch (error) {
    console.error("Error loading recordings:", error);
    uiManager.displayError("Failed to load past recordings.");
  }
}

// Function to reset UI state
function resetUI() {
  // Reset transcription text
  const transcriptionText = document.getElementById("transcriptionText");
  if (transcriptionText) {
    transcriptionText.value = "";
  }

  // Reset recording button
  const recordBtn = document.getElementById("recordToggle");
  if (recordBtn) {
    uiManager.updateRecordingButton(false);
  }

  // Disable follow-up button
  disableFollowUpButton();

  // Hide transcription loading spinner
  const transcriptionSpinner = document.getElementById("transcriptionLoadingSpinner");
  if (transcriptionSpinner) {
    transcriptionSpinner.classList.add("hidden");
  }

  // Reset status
  uiManager.updateUI("Not Recording");

  // Reset variables
  originalTranscript = "";
  currentRecordingId = "";
}

function createRecordingItem(recording) {
  const item = document.createElement('div');
  item.className = 'recording-item';
  item.dataset.id = recording.id;

  const header = document.createElement('div');
  header.className = 'recording-item-header';

  const title = document.createElement('h3');
  title.className = 'recording-item-title';
  title.textContent = recording.title || 'Untitled Recording';

  const date = document.createElement('span');
  date.className = 'recording-item-date';
  date.textContent = new Date(recording.created_at).toLocaleDateString();

  const actions = document.createElement('div');
  actions.className = 'recording-item-actions';

  const playButton = document.createElement('button');
  playButton.className = 'recording-item-button play';
  playButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
  playButton.onclick = () => togglePlayback(recording);

  const followUpButton = document.createElement('button');
  followUpButton.className = 'recording-item-button follow-up';
  followUpButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
  followUpButton.onclick = () => toggleFollowUp(recording);

  actions.appendChild(playButton);
  actions.appendChild(followUpButton);

  header.appendChild(title);
  header.appendChild(date);
  header.appendChild(actions);

  const audioSection = document.createElement('div');
  audioSection.className = 'collapsible-section hidden';
  audioSection.innerHTML = `
    <div class="collapsible-content">
      <audio controls class="w-full" preload="metadata">
        <source src="${recording.url}" type="audio/wav">
        Your browser does not support the audio element.
      </audio>
    </div>
  `;

  // Add event listeners to the audio element for Safari compatibility
  const audioElement = audioSection.querySelector('audio');
  audioElement.addEventListener('play', () => {
    // Ensure audio context is initialized on user interaction (required for Safari)
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!window.audioContext) {
        window.audioContext = new AudioContext();
      }
    }
  });
  
  // Add error handling for audio playback
  audioElement.addEventListener('error', (e) => {
    console.error('Audio playback error:', e);
    // Try to reload the audio source
    const currentSrc = audioElement.src;
    audioElement.src = '';
    setTimeout(() => {
      audioElement.src = currentSrc;
    }, 100);
  });

  const followUpSection = document.createElement('div');
  followUpSection.className = 'collapsible-section hidden';
  followUpSection.innerHTML = `
    <div class="collapsible-content">
      <div class="follow-up-section">
        <textarea class="follow-up-textarea" placeholder="Enter your follow-up question..."></textarea>
        <div class="follow-up-actions">
          <button class="follow-up-button cancel">Cancel</button>
          <button class="follow-up-button generate">Generate Response</button>
        </div>
      </div>
    </div>
  `;

  item.appendChild(header);
  item.appendChild(audioSection);
  item.appendChild(followUpSection);

  return item;
}

function togglePlayback(recording) {
  const item = document.querySelector(`[data-id="${recording.id}"]`);
  const audioSection = item.querySelector('.collapsible-section');
  const followUpSection = item.querySelectorAll('.collapsible-section')[1];

  if (audioSection.classList.contains('hidden')) {
    audioSection.classList.remove('hidden');
    audioSection.classList.add('visible');
    followUpSection.classList.remove('visible');
    followUpSection.classList.add('hidden');
  } else {
    audioSection.classList.remove('visible');
    audioSection.classList.add('hidden');
  }
}

function toggleFollowUp(recording) {
  const item = document.querySelector(`[data-id="${recording.id}"]`);
  const audioSection = item.querySelector('.collapsible-section');
  const followUpSection = item.querySelectorAll('.collapsible-section')[1];

  if (followUpSection.classList.contains('hidden')) {
    followUpSection.classList.remove('hidden');
    followUpSection.classList.add('visible');
    audioSection.classList.remove('visible');
    audioSection.classList.add('hidden');
  } else {
    followUpSection.classList.remove('visible');
    followUpSection.classList.add('hidden');
  }
}