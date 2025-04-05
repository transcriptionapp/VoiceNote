// playbackManager.js
export class PlaybackManager {
    constructor() {
      this.audioElement = document.getElementById("audioPlayback");

      // Event listeners for progress tracking
      this.audioElement.addEventListener('timeupdate', this.updateProgress.bind(this));
      this.audioElement.addEventListener('ended', this.onEnd.bind(this));
    }
  
    // Play audio from a blob
    playAudio(blob) {
      this.audioElement.src = URL.createObjectURL(blob);
      this.audioElement.play();
    }
  
    // Pause audio playback
    pauseAudio() {
      this.audioElement.pause();
    }
  
    // Set volume (0-1)
    setVolume(volume) {
      this.audioElement.volume = volume;
    }
  
    // Update progress bar based on current playback time
    updateProgress() {
      const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
      uiManager.updatePlaybackProgress(progress);
    }
  
    // Trigger when the audio ends (e.g., reset progress bar)
    onEnd() {
      const progressBar = document.getElementById('progressBar');
      if (progressBar) {
        progressBar.value = 0; // Reset progress bar
      }
    }
  
    // Toggle play/pause functionality
    togglePlayPause() {
      if (this.audioElement.paused) {
        this.audioElement.play();
      } else {
        this.audioElement.pause();
      }
    }
  
    // Seek to a specific time
    seekTo(time) {
      this.audioElement.currentTime = time;
    }
  }