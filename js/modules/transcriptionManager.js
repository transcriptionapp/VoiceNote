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

  async _ensureMp3Format(blob) {
    if (blob.type === 'audio/mpeg' || blob.type === 'audio/mp3') return blob;
    return new Blob([blob], { type: 'audio/mpeg' });
  }

  async uploadRecording(audioBlob, recordingId) {
    let storagePath;
    try {
      const { userId } = await this.checkAuthentication();
      if (!recordingId) throw new Error("Missing recording ID");
      if (audioBlob.size > this.MAX_FILE_SIZE) {
        throw new Error(`File too large (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      storagePath = `${userId}/${recordingId}.mp3`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(storagePath, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: false,
          cacheControl: "3600",
          metadata: { user_id: userId }
        });
      if (uploadError) throw uploadError;

      // Generate the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from("recordings")
        .getPublicUrl(storagePath);

      // Save recording metadata
      await this.saveRecordingMetadata({
        recordingId,
        userId,
        publicUrl,
        filename: storagePath,
        timestamp: new Date().toISOString(),
        duration: 0,
        fileSize: audioBlob.size,
        mimeType: audioBlob.type
      });

      return {
        recording_id: recordingId,
        file_url: publicUrl,
        storage_path: uploadData?.path,
        user_id: userId
      };

    } catch (error) {
      console.error("❌ Upload error:", error);
      if (storagePath) {
        await supabase.storage.from("recordings").remove([storagePath]);
      }
      return false;
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