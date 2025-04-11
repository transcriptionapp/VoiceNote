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
      
      // If it's already an MP3 or we're on Safari with a compatible format, return as is
      if (audioBlob.type === 'audio/mpeg' || 
          (isSafari && (audioBlob.type === 'audio/mp4' || audioBlob.type === 'audio/aac'))) {
        console.log("✅ Audio format already compatible:", audioBlob.type);
        return audioBlob;
      }

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

  _audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
    const view = new DataView(wav);
    
    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * blockAlign, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * blockAlign, true);
    
    // Write audio data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
      channelData[i] = buffer.getChannelData(i);
    }
    
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), value, true);
      }
    }
    
    return new Blob([wav], { type: 'audio/wav' });
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