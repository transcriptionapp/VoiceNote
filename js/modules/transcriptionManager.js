/**
 * TranscriptionManager
 * 
 * Handles the transcription of audio recordings.
 * Manages the upload of audio files to Supabase storage and
 * sends them for transcription via an edge function.
 * Includes error handling and progress tracking.
 */

import { supabase } from './auth.js';

export class TranscriptionManager {
  constructor() {
    this.isTranscribing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    this.supabase = supabase; // Initialize Supabase client
  }

  async checkAuthentication() {
    const { data: { user } } = await this.supabase.auth.getUser();
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!user?.id) throw new Error("User not authenticated");
    if (!session?.access_token) throw new Error("No access token");
    return { userId: user.id, accessToken: session.access_token };
  }

  async transcribeAudio(audioBlob) {
    if (this.isTranscribing) return { error: "Transcription already in progress" };
    this.isTranscribing = true;

    try {
      const recordingId = crypto.randomUUID();
      const mp3Blob = await this._ensureMp3Format(audioBlob);
      const uploadResult = await this.uploadRecording(mp3Blob, recordingId);
      if (!uploadResult) throw new Error("Upload failed");
      return await this.sendForTranscription(uploadResult);
    } catch (err) {
      console.error("❌ Transcription error:", err);
      return { error: err.message };
    } finally {
      this.isTranscribing = false;
    }
  }

  async _ensureMp3Format(audioBlob) {
    try {
      // Check if we're on Safari
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      console.log("📱 Device info:", { isSafari, isMobile, mimeType: audioBlob.type });
      
      // If it's already an MP3 or we're on Safari with a compatible format, return as is
      if (audioBlob.type === 'audio/mpeg' || 
          (isSafari && (audioBlob.type === 'audio/mp4' || audioBlob.type === 'audio/aac'))) {
        console.log("✅ Audio format already compatible:", audioBlob.type);
        return audioBlob;
      }

      // For mobile Safari, we need to be more careful with audio processing
      if (isSafari && isMobile) {
        console.log("📱 Mobile Safari detected, using simplified audio processing");
        
        // Create an audio context with mobile-friendly settings
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
          latencyHint: 'interactive'
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create a simpler offline context for mobile
        const offlineContext = new OfflineAudioContext(
          1, // Mono audio for better compatibility
          audioBuffer.length,
          44100 // Standard sample rate
        );
        
        // Create a source node
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        
        // Start processing
        source.start(0);
        const renderedBuffer = await offlineContext.startRendering();
        
        // Convert to WAV format (more widely supported)
        const wavBlob = await this._audioBufferToWav(renderedBuffer);
        
        console.log("✅ Converted audio to WAV format for mobile Safari");
        return wavBlob;
      }

      // Standard processing for other browsers
      // Create an audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create an offline context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // Create a source node
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      
      // Start processing
      source.start(0);
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert to WAV format first (more widely supported)
      const wavBlob = await this._audioBufferToWav(renderedBuffer);
      
      console.log("✅ Converted audio to WAV format");
      return wavBlob;
    } catch (error) {
      console.error("❌ Error converting audio format:", error);
      // If conversion fails, return the original blob
      return audioBlob;
    }
  }

  async _audioBufferToWav(audioBuffer) {
    try {
      // Create a WAV file with mobile-friendly settings
      const numOfChannels = 1; // Mono audio for better compatibility
      const sampleRate = 44100; // Standard sample rate
      const bitsPerSample = 16; // 16-bit audio
      const bytesPerSample = bitsPerSample / 8;
      const blockAlign = numOfChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      
      // Get the audio data
      const channelData = audioBuffer.getChannelData(0); // Get first channel for mono
      const buffer = new ArrayBuffer(44 + channelData.length * bytesPerSample);
      const view = new DataView(buffer);
      
      // Write WAV header
      // "RIFF" chunk descriptor
      this._writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + channelData.length * bytesPerSample, true);
      this._writeString(view, 8, 'WAVE');
      
      // "fmt " sub-chunk
      this._writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, numOfChannels, true); // NumChannels
      view.setUint32(24, sampleRate, true); // SampleRate
      view.setUint32(28, byteRate, true); // ByteRate
      view.setUint16(32, blockAlign, true); // BlockAlign
      view.setUint16(34, bitsPerSample, true); // BitsPerSample
      
      // "data" sub-chunk
      this._writeString(view, 36, 'data');
      view.setUint32(40, channelData.length * bytesPerSample, true);
      
      // Write the audio data
      const offset = 44;
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset + i * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      }
      
      // Create blob with explicit MIME type
      const blob = new Blob([buffer], { type: 'audio/wav' });
      console.log("✅ Created WAV file:", { 
        size: blob.size, 
        type: blob.type,
        sampleRate,
        numOfChannels,
        bitsPerSample
      });
      
      return blob;
    } catch (error) {
      console.error("❌ Error creating WAV file:", error);
      throw error;
    }
  }
  
  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  async uploadRecording(audioBlob, metadata) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Ensure we have a valid session
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('No active session');

      // Generate a unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording_${timestamp}.wav`;
      
      // Ensure the audio is in WAV format
      const wavBlob = await this._ensureMp3Format(audioBlob);
      
      // Upload to Supabase Storage with proper content type
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('recordings')
        .upload(`${session.user.id}/${filename}`, wavBlob, {
          contentType: 'audio/wav',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('recordings')
        .getPublicUrl(`${session.user.id}/${filename}`);

      // Save metadata to database with the correct schema
      const { data: recordingData, error: dbError } = await this.supabase
        .from('recordings')
        .insert([{
          id: metadata.recordingId || crypto.randomUUID(),
          user_id: session.user.id,
          storage_path: `${session.user.id}/${filename}`,
          file_url: publicUrl,
          created_at: new Date().toISOString(),
          duration: metadata.duration || 0,
          file_size: wavBlob.size,
          mime_type: 'audio/wav',
          is_processed: false
        }])
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      return {
        recording_id: recordingData.id,
        storage_path: `${session.user.id}/${filename}`,
        file_url: publicUrl
      };
    } catch (error) {
      console.error('Error in uploadRecording:', error);
      throw error;
    }
  }

  async saveRecordingMetadata(metadata) {
    const { error } = await this.supabase.from("recordings").insert({
      id: metadata.recordingId,
      user_id: metadata.userId,
      storage_path: metadata.filename,
      file_url: metadata.publicUrl,
      created_at: metadata.timestamp
    });

    if (error) throw error;
  }

  async sendForTranscription(recordingId, fileUrl, storagePath) {
    try {
      // Get the current session and user
      const { data: { session } } = await this.supabase.auth.getSession();
      const { data: { user } } = await this.supabase.auth.getUser();
      
      // Log authentication state for debugging
      console.log("🔐 Auth state for transcription:", {
        hasSession: !!session,
        hasUser: !!user,
        hasAccessToken: !!session?.access_token,
        userId: user?.id
      });
      
      if (!user) throw new Error("User not authenticated");
      if (!session?.access_token) throw new Error("No access token available");

      // Log the request details
      console.log("📤 Sending transcription request with:", {
        recordingId,
        fileUrl: fileUrl ? `${fileUrl.substring(0, 50)}...` : null,
        storagePath,
        userId: user.id
      });

      // Add retry logic for transient errors
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 Sending transcription request (attempt ${retryCount + 1}/${maxRetries})`);
          
          const response = await fetch(
            "https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/transcribe-audio",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
                "Origin": window.location.origin
              },
              mode: "cors",
              credentials: "include",
              body: JSON.stringify({
                recording_id: recordingId,
                file_url: fileUrl,
                storage_path: storagePath,
                user_id: user.id
              })
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Transcription failed (attempt ${retryCount + 1}/${maxRetries}):`, {
              status: response.status,
              statusText: response.statusText,
              error: errText
            });
            
            // If it's a 401/403 error, we need to refresh the session
            if (response.status === 401 || response.status === 403) {
              console.log("🔄 Session expired, refreshing...");
              const { data: { session: newSession } } = await this.supabase.auth.refreshSession();
              if (newSession) {
                session = newSession;
                console.log("✅ Session refreshed successfully");
              } else {
                throw new Error("Failed to refresh session");
              }
            }
            
            // If we've reached max retries, throw the error
            if (retryCount >= maxRetries - 1) {
              throw new Error(`Transcription failed: ${response.status} - ${errText}`);
            }
            
            // Otherwise, wait and retry
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            continue;
          }

          const result = await response.json();
          console.log("✅ Transcription successful:", result);
          return result;
        } catch (err) {
          console.error(`❌ Request error (attempt ${retryCount + 1}/${maxRetries}):`, err);
          
          if (retryCount >= maxRetries - 1) {
            throw err;
          }
          
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
      }
    } catch (err) {
      console.error("❌ Transcription error:", err);
      return { error: err.message };
    }
  }

  async checkTranscription(recordingId) {
    const { accessToken } = await this.checkAuthentication();

    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/check-transcription", {
      method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
      body: JSON.stringify({ recording_id: recordingId }),
      mode: "cors",
      credentials: "omit"
      });

      if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Check transcription failed: ${response.status} - ${errText}`);
    }

    return await response.json();
  }
}