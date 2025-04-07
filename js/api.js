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
    if (storagePath) {
      await supabase.storage.from("recordings")
        .remove([storagePath]);
    }
    return false;
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
    return null;
  }
}

// ✅ Save & edit transcription
async function saveTranscription(recordingId, text) { /* unchanged */ }
async function saveEditedTranscription(recordingId, editedText) {
  try {
    const { error: updateTranscriptionError } = await supabase
      .from('transcriptions')
      .update({
        edited_text: editedText,
      })
      .eq('recording_id', recordingId);

    if (updateTranscriptionError) {
      throw new Error(`Failed to update transcription: ${updateTranscriptionError.message}`);
    }

    const { error: updateRecordingError } = await supabase
      .from('recordings')
      .update({ is_edited: true })
      .eq('id', recordingId);

    if (updateRecordingError) {
      throw new Error(`Failed to update 'is_edited' flag: ${updateRecordingError.message}`);
    }

    return true;
  } catch (error) {
    return false;
  }
}
async function fetchTranscription(recordingId) { /* unchanged */ }

// ✅ Fetch and request follow-up email
async function generateFollowUpEmail(recordingId) {
  try {
    const userId = await getUserId();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("No Supabase session found");

    console.log("🔁 Calling generate-follow-up with:", {
      recordingId,
      userId,
      token: session.access_token
    });

    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        transcription_id: recordingId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Follow-up failed: ${response.status} ${errorText}`);
    }

    const { email_text } = await response.json();
    return email_text;
  } catch (error) {
    console.error("generateFollowUpEmail error:", error);
    return "";
  }
}

async function fetchFollowUpEmail(recordingId) { /* unchanged */ }


async function getLatestRecording(userId) {
  if (!userId) {
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
    return false;
  }
}

// ✅ NEW: Save recording metadata
async function saveRecordingMetadata({ recordingId, userId, publicUrl, filename, lastTimestamp, elapsedSeconds, blob }) {
  try {
    if (!recordingId || !userId || !publicUrl || !filename || !blob) {
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
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// ✅ NEW: Delete recording (metadata + storage)
async function deleteRecording(recordingId, storagePath) {
  try {
    const { error } = await supabase.from('recordings').delete().eq('id', recordingId);
    if (error) throw error;

    const removed = await deleteRecordingFromStorage(storagePath);
    return removed;
  } catch (e) {
    return false;
  }
}

export {
  uploadRecording,
  transcribeRecording,
  fetchTranscription,
  fetchFollowUpEmail,
  getLatestRecording,
  saveRecordingMetadata,
  saveTranscription,
  saveEditedTranscription,
  createSignedUrl,
  deleteRecordingFromStorage,
  generateUniqueId,
  generateFollowUpEmail,
  deleteRecording // ✅ newly added
};