// mediaRecorder.js
import { TranscriptionManager } from './transcriptionManager.js';  // Import the transcription manager

export class MediaRecorderManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.transcriptionManager = new TranscriptionManager(); // Initialize transcription manager
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }

      console.log("Using mime type:", options.mimeType || "default");

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => this.audioChunks.push(event.data);
      this.mediaRecorder.start();
      this.isRecording = true;

      this.mediaRecorder.onstop = () => {
        const finalMime = options.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: finalMime });
        this.audioChunks = [];
        this.dispatchEvent('recordingStopped', audioBlob);
      };
    } catch (error) {
      console.error("Recording error: ", error);
      this.dispatchEvent('recordingError', error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  dispatchEvent(event, data) {
    const eventObj = new CustomEvent(event, { detail: data });
    window.dispatchEvent(eventObj);
  }
}