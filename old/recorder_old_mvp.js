// recorder.js - Updated Main Recorder Logic
import { getCurrentUser, supabase, getUserId } from "./config.js";
import {
  uploadRecording,
  fetchTranscription,
  getLatestRecording,
  generateUniqueId,
  saveTranscription,
  saveEditedTranscription,
} from "./api.js";
import { transcribeAudio } from "./transcribe.js";

let mediaRecorder,
  audioChunks = [],
  lastRecordedBlob = null,
  originalTranscript = "",
  isRecording = false,
  recordingTimer = null,
  elapsedSeconds = 0;

let userId = null,
  recordingId = "",
  lastTimestamp = "";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎬 Recorder loaded");
  const user = await getCurrentUser();
  userId = user?.id;

  const userInfo = document.getElementById("userEmail");
  if (userInfo) userInfo.textContent = user?.email || "(unknown user)";

  if (!userId) {
    updateUI("⚠️ Please log in to continue.");
    console.error("❌ User not authenticated");
    return;
  }

  setupEventListeners();
  loadRecordingList();
});

function setupEventListeners() {
  const toggleBtn = document.getElementById("recordToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isRecording ? stopRecording() : startRecording();
    });
  }

  const retryBtn = document.getElementById("retryUpload");
  if (retryBtn) retryBtn.addEventListener("click", retryUpload);

  const followUpBtn = document.getElementById("gotoFollowup");
  if (followUpBtn) followUpBtn.addEventListener("click", navigateToFollowup);

  const textBox = document.getElementById("transcriptionText");
  const saveBtn = document.getElementById("saveTranscription");

  if (textBox && saveBtn) {
    saveBtn.classList.add("hidden");

    textBox.addEventListener("input", () => {
      const current = textBox.value.trim();
      const original = originalTranscript.trim();
      saveBtn.classList.toggle("hidden", current === original);
    });

    saveBtn.addEventListener("click", async () => {
      const updatedText = textBox.value.trim();
      if (updatedText && updatedText !== originalTranscript) {
        await saveEditedTranscription(recordingId, updatedText);
        originalTranscript = updatedText;
        updateUI("💾 Transcript saved");
        saveBtn.classList.add("hidden");
      }
    });
  }
}

function toggleRecordingButton(recording) {
  const toggleBtn = document.getElementById("recordToggle");
  const timerDisplay = document.getElementById("recordingTime");
  if (!toggleBtn || !timerDisplay) return;

  toggleBtn.innerHTML = recording
    ? '<span class="icon">⏹️</span> Stop Recording'
    : '<span class="icon">🎙️</span> Start Recording';

  timerDisplay.classList.toggle("hidden", !recording);

  if (recording) {
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    recordingTimer = setInterval(() => {
      elapsedSeconds++;
      timerDisplay.textContent = formatTime(elapsedSeconds);
    }, 1000);
  } else {
    clearInterval(recordingTimer);
  }
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
      audioBitsPerSecond: 128000,
    });

    mediaRecorder.start();
    audioChunks = [];
    recordingId = generateUniqueId("rec");
    isRecording = true;
    updateUI("🎤 Recording...");
    toggleRecordingButton(true);

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  } catch (error) {
    console.error("Microphone error:", error);
    updateUI("❌ Microphone access denied");
  }
}

async function stopRecording() {
    if (!mediaRecorder) return;
  
    clearInterval(recordingTimer); // ⏹️ Stop timer immediately
    toggleRecordingButton(false);  // ⏹️ Reset button state
  
    mediaRecorder.stop();
  
    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
        lastRecordedBlob = audioBlob;
        lastTimestamp = new Date().toISOString();
  
        updateAudioPlayback(audioBlob);
        await handleUpload(audioBlob);
      } catch (error) {
        console.error("Stop recording failed:", error);
        updateUI("❌ Recording failed");
      } finally {
        isRecording = false;
      }
    };
  }

async function handleUpload(audioBlob) {
  userId = (await getUserId()) || userId;
  if (!userId) {
    updateUI("⚠️ Session expired");
    return;
  }

  const filename = `recording_${lastTimestamp}.mp3`;
  updateUI("⏳ Uploading...");

  const publicUrl = await uploadRecording(audioBlob, filename, recordingId);

  if (publicUrl) {
    updateUI("✅ Upload complete");

    const transcript = await transcribeAudio(audioBlob, recordingId);
    if (transcript) {
      await saveTranscription(recordingId, transcript);
      const transcriptBox = document.getElementById("transcriptionText");
      if (transcriptBox) {
        transcriptBox.value = transcript;
        originalTranscript = transcript;
      }
    }

    loadRecordingList();
  } else {
    updateUI("❌ Upload failed");
    document.getElementById("retryUpload").style.display = "block";
  }
}

async function loadRecordingList() {
  const tableBody = document.querySelector("#recordingItems tbody");
  if (!userId || !tableBody) return;

  const { data, error } = await supabase
    .from("recordings")
    .select("id, created_at, file_url, transcriptions(text, edited_text)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch recordings:", error);
    return;
  }

  tableBody.innerHTML = "";

  data.forEach((rec) => {
    const text = rec.transcriptions?.[0]?.edited_text || rec.transcriptions?.[0]?.text || "(No transcription)";
    const snippet = text.length > 100 ? text.slice(0, 100) + "..." : text;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${new Date(rec.created_at).toLocaleString()}</td>
      <td>${snippet}</td>
      <td><a href="${rec.file_url}" target="_blank">🎧 Listen</a></td>
    `;
    tableBody.appendChild(row);
  });
}

async function retryUpload() {
  if (!lastRecordedBlob) {
    updateUI("⚠️ No recording to retry");
    return;
  }

  updateUI("🔄 Retrying upload...");
  document.getElementById("retryUpload").style.display = "none";

  await handleUpload(lastRecordedBlob);
}

function navigateToFollowup() {
  getLatestRecording(userId).then((recording) => {
    if (recording?.id) {
      window.location.href = `follow_up.html?recording_id=${recording.id}`;
    } else {
      updateUI("⚠️ No recording to follow up");
    }
  });
}

function updateUI(message) {
  const status = document.getElementById("status");
  if (status) status.innerText = message;
}

function updateAudioPlayback(audioBlob) {
  const audio = document.getElementById("audioPlayback");
  if (!audio) return;
  audio.src = URL.createObjectURL(audioBlob);
  audio.style.display = "block";
}
