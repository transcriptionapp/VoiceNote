// 🔍 TEMPORARY DEBUG LOGGING — REMOVE BEFORE DEPLOYMENT
// api.js - Supabase API + Edge Function Handler
import { supabase, getUserId } from "./config.js";

function generateUniqueId() {
  return crypto.randomUUID();
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

async function verifyAuth() {
  const userId = await getUserId();
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    // console.error("Auth verification failed", {
    //   hasSession: !!session,
    //   storedUserId: localStorage.getItem('sb-auth')
    // });
    throw new Error("Not authenticated");
  }
  return userId;
}

async function uploadRecording(audioBlob, filename, recordingId) {
  let storagePath;
  try {
    const userId = await verifyAuth();
    if (!recordingId) throw new Error("Missing recording ID");
    if (audioBlob.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    const fileExt = filename.split('.').pop() || 'mp3';
    storagePath = `${userId}/${recordingId}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(storagePath, audioBlob, {
        contentType: `audio/${fileExt}`,
        upsert: false,
        cacheControl: "3600",
        metadata: { user_id: userId }
      });
    if (uploadError) throw uploadError;

    const fileUrl = uploadData.path;

    await saveRecordingMetadata({
      recordingId,
      userId,
      publicUrl: fileUrl,
      filename: storagePath,
      timestamp: new Date().toISOString(),
      duration: 0,
      fileSize: audioBlob.size,
      mimeType: audioBlob.type,
      blob: audioBlob
    });

    // console.log("✅ Upload succeeded:", {
    //   recordingId,
    //   file_url: fileUrl,
    //   storage_path: uploadData?.path,
    //   fileSize: audioBlob.size
    // });

    return {
      file_url: fileUrl,
      storage_path: uploadData?.path,
      recordingId,
      userId,
      fileSize: audioBlob.size,
      filename: storagePath,
      blob: audioBlob
    };

  } catch (error) {
    // console.error("❌ Upload recording failed:", error);
    // console.error("Upload failed:", error.message);
    if (storagePath) {
      await supabase.storage.from("recordings")
        .remove([storagePath])
        // .catch(e => console.warn("Cleanup failed:", e));
    }
    return false; // TODO: Remove debug logs after testing
  }
}

// ✅ NEW: Transcribe via Edge Function
async function transcribeRecording(recordingId) {
  try {
    const userId = await verifyAuth();
    const response = await fetch(`/functions/v1/transcribe-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recording_id: recordingId, user_id: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    // console.error("Transcription error:", error.message);
    return null;
  }
}

// ✅ Save & edit transcription
async function saveTranscription(recordingId, text) { /* unchanged */ }
async function saveEditedTranscription(recordingId, editedText) { /* unchanged */ }

async function fetchTranscription(recordingId) { /* unchanged */ }

// ✅ Fetch and request follow-up email
async function requestFollowUp(recordingId) {
  if (!recordingId) {
    // console.error("No recordingId provided");
    return false;
  }

  try {
    const emailText = await generateFollowUpEmail(recordingId);
    const { error } = await supabase.from("follow_ups").insert([{
      transcription_id: recordingId,
      email_text: emailText,
      created_at: new Date().toISOString()
    }]);

    return !error;
  } catch (error) {
    // console.error("Follow-up request failed:", error.message);
    return false;
  }
}

async function fetchFollowUpEmail(recordingId) { /* unchanged */ }

// ✅ NEW: Generate follow-up via Edge Function
async function generateFollowUpEmail(recordingId) {
  try {
    const userId = await verifyAuth();
    const response = await fetch(`/functions/v1/generate-followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcription_id: recordingId, user_id: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Follow-up failed: ${errorText}`);
    }

    const { email_text } = await response.json();
    return email_text;
  } catch (error) {
    // console.error("generateFollowUpEmail error:", error.message);
    return "";
  }
}

async function getLatestRecording(userId) {
  if (!userId) {
    // console.warn("getLatestRecording called without userId");
    return null;
  }

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // console.error("Failed to fetch latest recording:", error.message);
    return null;
  }

  return data;
}

// ✅ NEW: Generate a fresh signed URL on demand
async function createSignedUrl(storagePath) {
  try {
    const { data, error } = await supabase
      .storage
      .from("recordings")
      .createSignedUrl(storagePath, 3600); // 1 hour

    return { signedUrl: data?.signedUrl || null, error };
  } catch (error) {
    // console.error("createSignedUrl error:", error.message);
    return { signedUrl: null, error };
  }
}

// ✅ NEW: Delete recording from storage
async function deleteRecordingFromStorage(storagePath) {
  try {
    const { error } = await supabase.storage.from("recordings").remove([storagePath]);
    if (error) throw error;
    return true;
  } catch (error) {
    // console.error("Failed to delete from storage:", error.message);
    return false;
  }
}

// ✅ NEW: Save recording metadata
async function saveRecordingMetadata({ recordingId, userId, publicUrl, filename, lastTimestamp, elapsedSeconds, blob }) {
  try {
    if (!recordingId || !userId || !publicUrl || !filename || !blob) {
      // console.error("❌ Missing required metadata:", { recordingId, userId, publicUrl, filename, blob });
      return false;
    }

    const { error } = await supabase.from("recordings").insert({
      id: recordingId,
      user_id: userId,
      file_url: publicUrl,
      storage_path: filename,
      timestamp: lastTimestamp || new Date().toISOString(),
      duration: elapsedSeconds || 0,
      file_size: blob.size,
      mime_type: blob.type,
      is_processed: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // console.error("❌ Failed to insert recording metadata:", error);
      return false;
    }

    // console.log("✅ Metadata inserted for recording:", recordingId);
    return true;
  } catch (e) {
    // console.error("❌ Unexpected error in saveRecordingMetadata:", e);
    return false;
  }
}

export {
  uploadRecording,
  transcribeRecording,
  fetchTranscription,
  requestFollowUp,
  fetchFollowUpEmail,
  getLatestRecording,
  saveRecordingMetadata,
  saveTranscription,
  saveEditedTranscription,
  createSignedUrl,
  deleteRecordingFromStorage,
  generateUniqueId
};