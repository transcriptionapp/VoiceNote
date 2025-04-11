// mediaRecorder.js
import { TranscriptionManager } from './transcriptionManager.js';  // Import the transcription manager

/**
 * MediaRecorderManager
 * 
 * Handles audio recording functionality using the MediaRecorder API.
 * Provides methods for starting, stopping, and managing recording sessions.
 * Includes error handling and browser compatibility checks.
 */

export class MediaRecorderManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.recordingStartTime = null;
    this.recordingTimer = null;
    this.transcriptionManager = new TranscriptionManager(); // Initialize transcription manager
  }

  /**
   * Start a new recording session
   * @returns {Promise<boolean>} Success status
   */
  async startRecording() {
    try {
      // Request microphone access with Safari-specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // Safari-specific MIME type handling
      const mimeType = this._getSupportedMimeType();
      console.log("📝 Using MIME type:", mimeType);

      // Configure MediaRecorder with optimal settings for mobile
      const options = {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this._setupEventHandlers();
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this._startRecordingTimer();
      this.dispatchEvent('recordingStarted');
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      this.dispatchEvent('recordingError', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the current recording session
   * @returns {boolean} Success status
   */
  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) {
      console.log("⚠️ No active recording to stop");
      return false;
    }

    try {
      // Stop the MediaRecorder
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Stop the recording timer
      this._stopRecordingTimer();
      
      // Stop all tracks in the stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      console.log("🔊 Recording stopped");
      return true;
    } catch (error) {
      console.error("❌ Error stopping recording:", error.message);
      this._handleRecordingError(error);
      return false;
    }
  }

  /**
   * Get the current recording duration in seconds
   * @returns {number} Duration in seconds
   */
  getRecordingDuration() {
    if (!this.recordingStartTime) return 0;
    return Math.floor((Date.now() - this.recordingStartTime) / 1000);
  }

  /**
   * Format the recording duration as MM:SS
   * @returns {string} Formatted duration
   */
  getFormattedDuration() {
    const duration = this.getRecordingDuration();
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Dispatch a custom event with data
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  dispatchEvent(event, data) {
    const eventObj = new CustomEvent(event, { detail: data });
    window.dispatchEvent(eventObj);
  }

  /**
   * Set up event handlers for the MediaRecorder
   * @private
   */
  _setupEventHandlers() {
    // Handle data available event
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Handle recording stop event
    this.mediaRecorder.onstop = () => {
      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });
      this.audioChunks = [];
      
      // Dispatch recording stopped event with the audio blob in the correct format
      this.dispatchEvent('recordingStopped', { audioBlob });
    };

    // Handle recording error event
    this.mediaRecorder.onerror = (error) => {
      console.error("❌ MediaRecorder error:", error);
      this._handleRecordingError(error);
    };
  }

  /**
   * Start the recording timer
   * @private
   */
  _startRecordingTimer() {
    this.recordingTimer = setInterval(() => {
      const duration = this.getFormattedDuration();
      this.dispatchEvent('recordingTimeUpdate', duration);
    }, 1000);
  }

  /**
   * Stop the recording timer
   * @private
   */
  _stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  /**
   * Get the supported MIME type for the current browser
   * @returns {string|null} Supported MIME type or null
   * @private
   */
  _getSupportedMimeType() {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
      'audio/mpeg'
    ];

    // Check if we're on Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isSafari) {
      // Safari prefers these formats
      const safariTypes = ['audio/mp4', 'audio/aac', 'audio/mpeg'];
      for (const type of safariTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          console.log("✅ Using Safari-optimized format:", type);
          return type;
        }
      }
    }

    // For other browsers, try the standard formats
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return '';
  }

  /**
   * Handle recording errors
   * @param {Error} error - Error object
   * @private
   */
  _handleRecordingError(error) {
    // Clean up resources
    this.isRecording = false;
    this._stopRecordingTimer();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Dispatch error event
    this.dispatchEvent('recordingError', error);
  }
}