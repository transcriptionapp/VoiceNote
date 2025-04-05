export class UIManager {
    constructor() {
      this.transcriptionBox = document.getElementById("transcriptionText");
      this.loadingAnimation = document.getElementById("loadingAnimation");
      this.errorBox = document.getElementById("errorBox"); // Assuming you want to show errors in a specific UI element
      this.recordingButton = document.getElementById("recordToggle");
      this.followUpButton = document.getElementById("gotoFollowup");
      this.recordingTime = document.getElementById("recordingTime");
      this.recordingsList = document.getElementById("recordingsList");
      this.saveButton = document.getElementById("saveTranscription"); // Fetching save button
    

      this.transcriptionBox.addEventListener('input', () => {
        this.toggleSaveButton();
      });
    }
  
    showLoading() {
      if (this.loadingAnimation) {
        this.loadingAnimation.classList.remove("hidden");
      }
    }
  
    hideLoading() {
      if (this.loadingAnimation) {
        this.loadingAnimation.classList.add("hidden");
      }
    }
  
    updateTranscription(transcription) {
      if (this.transcriptionBox) {
        this.transcriptionBox.value = transcription;
        this.transcriptionBox.setAttribute('data-original-text', transcription); // Store original transcription
      }
    }
  
    showError(message) {
      if (this.errorBox) {
        this.errorBox.textContent = message;
        this.errorBox.classList.remove('hidden');
      } else {
        console.error(message);
        alert(message);
      }
    }
  
    updateRecordingButton(isRecording) {
      if (this.recordingButton) {
        this.recordingButton.innerHTML = isRecording
          ? '<span class="icon">⏹️</span> Stop Recording'
          : '<span class="icon">🎙️</span> Start Recording';
      }
  
      if (this.recordingTime) {
        this.recordingTime.classList.toggle("hidden", !isRecording);
        if (isRecording) {
          this.recordingTime.textContent = "00:00"; // Start timer text
        }
      }
    }
  
    updateFollowUpButton(isEnabled) {
      if (this.followUpButton) {
        this.followUpButton.disabled = !isEnabled;
        if (isEnabled) {
          this.followUpButton.classList.remove("bg-[#e7edf3]", "text-[#0e141b]");
          this.followUpButton.classList.add("bg-[#1980e6]", "text-white");
        } else {
          this.followUpButton.classList.add("bg-[#e7edf3]", "text-[#0e141b]");
          this.followUpButton.classList.remove("bg-[#1980e6]", "text-white");
        }
      }
    }

    toggleSaveButton() {
      if (this.saveButton && this.transcriptionBox) {
        const originalText = this.transcriptionBox.getAttribute('data-original-text');
        const currentText = this.transcriptionBox.value;

        // Show save button only if transcription text has been edited
        this.saveButton.style.display = currentText !== originalText && currentText.trim() !== "" ? 'block' : 'none'; 
      }
    }
  
    async loadRecordingList(recordings) {
      if (!this.recordingsList) return;
  
      this.recordingsList.innerHTML = ""; // Clear previous recordings
  
      recordings.forEach((rec, index) => {
        const text = rec.transcriptions?.[0]?.edited_text || rec.transcriptions?.[0]?.text || "(No transcription)";
        const snippet = text.length > 60 ? text.slice(0, 60) + "..." : text;
        const timestamp = new Date(rec.created_at).toLocaleString();
  
        const bgUrl = index % 2 === 0
          ? "https://cdn.usegalileo.ai/sdxl10/43527474-00ae-45cd-aa87-ff88b35a7a4f.png"
          : "https://cdn.usegalileo.ai/sdxl10/f17b5a1c-54a2-4b35-bce0-4b7905501d4c.png";
  
        const card = document.createElement("div");
        card.className = "bg-cover bg-center rounded-xl pt-[132px] cursor-pointer";
        card.dataset.recordingId = rec.id;
        card.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,0.4), rgba(0,0,0,0)), url('${bgUrl}')`;
  
        card.innerHTML = `
          <div class="p-4 text-white">
            <p class="text-sm">${timestamp}</p>
            <p class="text-2xl font-bold leading-tight">${snippet}</p>
          </div>
        `;
  
        card.addEventListener("click", async () => {
          const audio = document.getElementById("audioPlayback");
          const audioPlayer = document.getElementById("audioPlayer");
  
          // Add functionality to only expand the transcription box if it's not already expanded
          const existingBox = document.querySelector(`.transcript-box[data-id="${rec.id}"]`);
          if (existingBox) {
            existingBox.style.display = existingBox.style.display === 'none' ? 'block' : 'none';
            return; // Prevent further actions if already expanded
          }
  
          // Playback controls for the audio
          if (audio && rec.storage_path) {
            const { signedUrl, error } = await createSignedUrl(rec.storage_path);
            if (error || !signedUrl) {
              console.error("Failed to get signed URL:", error);
              this.showError("❌ Playback failed");
              return;
            }
  
            audio.pause();
            audio.src = "";
            audio.load();
            audio.src = signedUrl;
            audio.autoplay = false; // Ensure it's loaded but not playing
  
            const playerContainer = document.getElementById("audioPlayer");
            if (playerContainer) {
              card.insertAdjacentElement("afterend", playerContainer);
              playerContainer.classList.remove("hidden");
            }
  
            const transcriptText = rec.transcriptions?.[0]?.edited_text || rec.transcriptions?.[0]?.text || "(No transcription)";
            const transcriptBox = document.createElement("div");
            transcriptBox.className = "transcript-box w-full bg-[#e7edf3] rounded-xl p-4 text-base text-[#0e141b] placeholder:text-[#4e7397] focus:outline-none resize-none mt-2";
            transcriptBox.dataset.id = rec.id;
            transcriptBox.innerText = transcriptText;
            card.insertAdjacentElement("afterend", transcriptBox);
          }
        });
  
        this.recordingsList.appendChild(card);
      });
    }

    updateUI(message) {
      const status = document.getElementById("status");
      if (status) {
        status.innerText = message;
      }
    }

    updatePlaybackProgress(progress) {
      const progressBar = document.getElementById('progressBar');
      if (progressBar) progressBar.value = progress;
    }
  }