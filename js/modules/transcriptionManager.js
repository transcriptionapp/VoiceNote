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
  }

  async checkAuthentication() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
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
    // If already MP3, return as is
    if (audioBlob.type === 'audio/mpeg' || audioBlob.type === 'audio/mp3') {
      return audioBlob;
    }

    // For Safari, we might get audio/mp4 or audio/aac
    if (audioBlob.type === 'audio/mp4' || audioBlob.type === 'audio/aac') {
      // Create a new blob with the correct MIME type
      return new Blob([audioBlob], { type: 'audio/mpeg' });
    }

    // For other formats, we'll need to convert
    // For now, we'll just ensure it's marked as MP3
    return new Blob([audioBlob], { type: 'audio/mpeg' });
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
      const filename = `recording_${timestamp}.mp3`;
      
      // Ensure the audio is in MP3 format
      const mp3Blob = await this._ensureMp3Format(audioBlob);
      
      // Upload to Supabase Storage with proper content type
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('recordings')
        .upload(`${session.user.id}/${filename}`, mp3Blob, {
          contentType: 'audio/mpeg',
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

      // Save metadata to database
      const { data: recordingData, error: dbError } = await this.supabase
        .from('recordings')
        .insert([{
          user_id: session.user.id,
          filename: filename,
          storage_path: `${session.user.id}/${filename}`,
          duration: metadata.duration || 0,
          size: mp3Blob.size,
          status: 'uploaded'
        }])
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      return {
        recording_id: recordingData.id,
        filename: filename,
        storage_path: `${session.user.id}/${filename}`,
        public_url: publicUrl
      };
    } catch (error) {
      console.error('Error in uploadRecording:', error);
      throw error;
    }
  }

  async saveRecordingMetadata(metadata) {
    const { error } = await supabase.from("recordings").insert({
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
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      
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
              const { data: { session: newSession } } = await supabase.auth.refreshSession();
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