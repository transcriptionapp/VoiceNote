import { getCurrentUser, supabase, getUserId } from "./config.js";
import {
  uploadRecording,
  fetchTranscription,
  getLatestRecording,
  saveTranscription,
  saveEditedTranscription,
  createSignedUrl,
  deleteRecordingFromStorage
} from "./api.js";
import { transcribeAudio } from "./transcribe.js";

// Redirect to login if no active session
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session?.user) {
    window.location.href = 'index.html';
  }
});

let mediaRecorder,
  audioChunks = [],
  lastRecordedBlob = null,
  originalTranscript = "",
  isRecording = false,
  recordingTimer = null,
  elapsedSeconds = 0;

let userId = null,
  recordingId = "",
  lastTimestamp = "",
  currentAudio = null;

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
  const avatar = document.getElementById("avatarClick");
  if (avatar) {
    avatar.addEventListener("click", () => {
      const fullBox = document.getElementById("transcriptionFullBox");
      const fullText = document.getElementById("transcriptionFullText");
      const currentText = document.getElementById("transcriptionText")?.value || "";
      if (fullBox && fullText && currentText) {
        fullText.value = currentText;
        fullBox.classList.toggle("hidden");
      }
    });
  }

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
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
      audioBitsPerSecond: 128000,
    });

    mediaRecorder.start();
    audioChunks = [];
    recordingId = crypto.randomUUID();
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

  clearInterval(recordingTimer);
  toggleRecordingButton(false);
  const stream = mediaRecorder.stream;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
 
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
  console.log("⬆️ Starting upload with:", { audioBlob, recordingId });
  userId = (await getUserId()) || userId;
  if (!userId) {
    updateUI("⚠️ Session expired");
    return;
  }

  const filename = `recording_${lastTimestamp}.mp3`;
  updateUI("⏳ Uploading...");

  const { file_url: publicUrl, storage_path } = await uploadRecording(audioBlob, filename, recordingId);
  console.log("📦 uploadRecording returned:", { publicUrl, storage_path });

  if (publicUrl) {
    console.log("📦 Upload metadata saved. Calling transcription with:", { recordingId, storage_path, userId });

    updateUI("🤖 Transcribing...");

    console.log("📞 Sending transcription request to Edge Function");

    const transcript = await transcribeAudio({
      recordingId,
      storage_path,
      userId
    });
    console.log("🧠 transcribeAudio() finished. Returned transcript:", transcript);

    if (!transcript) {
      console.warn("🚨 No transcription received or an error occurred in Edge Function");
      updateUI("❌ Transcription failed");
    } else {
      const transcriptBox = document.getElementById("transcriptionText");
      if (transcriptBox) {
        transcriptBox.value = transcript;
        
        const gotoFollowup = document.getElementById("gotoFollowup");
        if (gotoFollowup) {
          gotoFollowup.disabled = false;
          gotoFollowup.classList.remove("bg-[#e7edf3]", "text-[#0e141b]");
          gotoFollowup.classList.add("bg-[#1980e6]", "text-white");
        }
        
        originalTranscript = transcript;
      }

      await supabase
        .from("recordings")
        .update({ is_processed: true })
        .eq("id", recordingId);

      loadRecordingList();
      updateUI("✅ Transcription complete");
    }
  } else {
    console.warn("⚠️ uploadRecording() succeeded, but publicUrl was missing — aborting transcription.");
    updateUI("❌ Upload metadata missing, transcription skipped.");
  }
}

async function loadRecordingList() {
  const listContainer = document.querySelector(".flex.flex-col.gap-4");
  if (!userId || !listContainer) return;

  const { data, error } = await supabase
    .from("recordings")
    .select("id, created_at, storage_path, transcriptions(text, edited_text)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch recordings:", error);
    return;
  }

  listContainer.innerHTML = "";

  data.forEach((rec, index) => {
    const text = rec.transcriptions?.[0]?.edited_text || rec.transcriptions?.[0]?.text || "(No transcription)";
    const snippet = text.length > 60 ? text.slice(0, 60) + "..." : text;
    const timestamp = new Date(rec.created_at).toLocaleString();

    const bgUrl = index % 2 === 0
      ? "https://cdn.usegalileo.ai/sdxl10/43527474-00ae-45cd-aa87-ff88b35a7a4f.png"
      : "https://cdn.usegalileo.ai/sdxl10/f17b5a1c-54a2-4b35-bce0-4b7905501d4c.png";

    const card = document.createElement("div");
    card.className = "bg-cover bg-center rounded-xl pt-[132px] cursor-pointer";
    card.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,0.4), rgba(0,0,0,0)), url('${bgUrl}')`;

    card.innerHTML = `
      <div class="p-4 text-white">
        <p class="text-sm">${timestamp}</p>
        <p class="text-2xl font-bold leading-tight">${snippet}</p>
      </div>
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded";
    deleteBtn.innerText = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteRecording(rec.id);
    });
    card.appendChild(deleteBtn);

    card.addEventListener("click", async () => {
      const audio = document.getElementById("audioPlayback");
      const audioPlayer = document.getElementById("audioPlayer");

      if (audio && rec.storage_path) {
        const { signedUrl, error } = await createSignedUrl(rec.storage_path);
        if (error || !signedUrl) {
          console.error("Failed to get signed URL:", error);
          updateUI("❌ Playback failed");
          return;
        }

        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.src = signedUrl;
        audio.play();
        audioPlayer.classList.remove("hidden");
      }
    });

    listContainer.appendChild(card);
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
  console.log("🧭 Follow-up button clicked. Checking latest recording for user:", userId);

  if (!userId) {
    updateUI("⚠️ User ID missing — cannot fetch latest recording.");
    return;
  }

  console.log("📣 Fetching latest recording via getLatestRecording()");
  getLatestRecording(userId).then((recording) => {
    console.log("📦 getLatestRecording raw return:", JSON.stringify(recording, null, 2));

    if (!recording) {
      console.warn("⚠️ getLatestRecording returned null or undefined.");
      updateUI("⚠️ No recent recording found.");
      return;
    }

    if (typeof recording !== "object") {
      console.warn("⚠️ getLatestRecording did not return an object:", recording);
      updateUI("⚠️ Unexpected response for latest recording.");
      return;
    }

    if (!recording.id) {
      console.warn("⚠️ Latest recording object is missing 'id':", recording);
      updateUI("⚠️ Recording ID not found");
      return;
    }

    const url = `./follow_up.html?recording_id=${recording.id}`;
    console.log("➡️ Navigating to:", url);
    window.location.href = url;
  }).catch((error) => {
    console.error("❌ Error fetching latest recording:", error);
    updateUI("❌ Failed to load latest recording");
  });
}

async function deleteRecording(recordingId) {
  if (!userId || !recordingId) return;

  const confirmDelete = confirm("Are you sure you want to delete this recording?");
  if (!confirmDelete) return;

  updateUI("🗑️ Deleting recording...");

  // 1. Get the recording to find storage path
  const { data: recData, error: fetchError } = await supabase
    .from("recordings")
    .select("storage_path")
    .eq("id", recordingId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !recData) {
    console.error("Failed to find recording:", fetchError);
    updateUI("❌ Could not find recording");
    return;
  }

  const { storage_path } = recData;

  // 2. Delete from related tables
  const { error: delFollowUps } = await supabase
    .from("follow_ups")
    .delete()
    .eq("recording_id", recordingId);

  const { error: delTranscriptions } = await supabase
    .from("transcriptions")
    .delete()
    .eq("recording_id", recordingId);

  const { error: delRecording } = await supabase
    .from("recordings")
    .delete()
    .eq("id", recordingId)
    .eq("user_id", userId);

  if (delRecording || delTranscriptions || delFollowUps) {
    console.error("Error deleting from DB:", delRecording || delTranscriptions || delFollowUps);
    updateUI("❌ Deletion failed");
    return;
  }

  // 3. Delete from storage
  const storageDeleted = await deleteRecordingFromStorage(storage_path);
  if (!storageDeleted) {
    updateUI("⚠️ Deleted from DB, but failed to remove file");
    return;
  }

  updateUI("✅ Recording deleted");
  loadRecordingList();
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
