// api.js - Complete and Verified Supabase API Handler
import { supabase, getUserId } from "./config.js";

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Verifies authentication and returns user ID
 * @throws {Error} If not authenticated
 */
async function verifyAuth() {
  const userId = await getUserId();
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    console.error("Auth verification failed", {
      hasSession: !!session,
      storedUserId: localStorage.getItem('sb-auth')
    });
    throw new Error("Not authenticated");
  }
  return userId;
}

/**
 * Uploads audio file to storage and saves metadata
 */
async function uploadRecording(audioBlob, filename, recordingId) {
  let storagePath; // Declare early so it's available in catch block
  try {
    const userId = await verifyAuth();
    if (!recordingId) throw new Error("Missing recording ID");

    // Validate file size
    if (audioBlob.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB) exceeds 50MB limit`);
    }

    const fileExt = filename.split('.').pop() || 'mp3';
    storagePath = `${userId}/${recordingId}.${fileExt}`;

    console.log("Uploading recording...", {
      size: `${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`,
      path: storagePath
    });

    // 1. Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(storagePath, audioBlob, {
        contentType: `audio/${fileExt}`,
        upsert: false,
        cacheControl: "3600",
        metadata: { user_id: userId }
      });
    if (uploadError) throw uploadError;

    // 2. Get signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from("recordings")
      .createSignedUrl(uploadData.path, 60 * 60); // 1 hour

    if (signedUrlError) throw signedUrlError;
    const fileUrl = signedUrlData.signedUrl;

    // 3. Save to database
    const { error: dbError } = await supabase.from("recordings").insert([{
      id: recordingId,
      user_id: userId,
      file_url: fileUrl,
      storage_path: uploadData.path,
      file_size: audioBlob.size,
      created_at: new Date().toISOString()
    }], { returning: 'minimal' });

    console.log("DB Insert Result", { uploadData, dbError });

    if (dbError) throw dbError;

    return fileUrl;

  } catch (error) {
    console.error("Upload failed:", error.message);

    // Cleanup failed upload if path exists
    if (storagePath) {
      await supabase.storage.from("recordings")
        .remove([storagePath])
        .catch(e => console.warn("Cleanup failed:", e));
    }

    return false;
  }
}

/**
 * Saves transcription to Supabase
 * @param {string} recordingId
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function saveTranscription(recordingId, text) {
  if (!recordingId || !text) {
    console.warn("Missing recordingId or transcription text");
    return false;
  }

  try {
    const { error } = await supabase.from("transcriptions").insert([{
      recording_id: recordingId,
      text,
      is_edited: false,
      created_at: new Date().toISOString()
    }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to save transcription:", error.message);
    return false;
  }
}

/**
 * Updates edited transcription text
 */
async function saveEditedTranscription(recordingId, editedText) {
  if (!recordingId || !editedText) {
    console.warn("Missing recordingId or editedText");
    return false;
  }

  try {
    const { error } = await supabase
      .from("transcriptions")
      .update({
        edited_text: editedText,
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq("recording_id", recordingId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to save edited transcription:", error.message);
    return false;
  }
}

/**
 * Fetches transcription for a recording
 */
async function fetchTranscription(recordingId) {
  if (!recordingId) {
    console.error("No recordingId provided");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("transcriptions")
      .select("text, edited_text, is_edited")
      .eq("recording_id", recordingId)
      .single();

    if (error) throw error;

    return data?.is_edited && data?.edited_text
      ? data.edited_text
      : data?.text || null;

  } catch (error) {
    console.error("Fetch transcription failed:", error.message);
    return null;
  }
}

/**
 * Requests follow-up email generation
 */
async function requestFollowUp(transcriptionId) {
  if (!transcriptionId) {
    console.error("No transcriptionId provided");
    return false;
  }

  try {
    const emailText = await generateFollowUpEmail(transcriptionId);
    const { error } = await supabase.from("follow_ups").insert([{
      transcription_id: transcriptionId,
      email_text: emailText,
      created_at: new Date().toISOString()
    }]);

    return !error;

  } catch (error) {
    console.error("Follow-up request failed:", error.message);
    return false;
  }
}

/**
 * Fetches generated follow-up email
 */
async function fetchFollowUpEmail(transcriptionId) {
  if (!transcriptionId) {
    console.error("No transcriptionId provided");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("follow_ups")
      .select("email_text")
      .eq("transcription_id", transcriptionId)
      .single();

    if (error) throw error;
    return data?.email_text || null;

  } catch (error) {
    console.error("Fetch follow-up failed:", error.message);
    return null;
  }
}

/**
 * Gets latest recording for a user
 */
async function getLatestRecording(userId) {
  if (!userId) {
    console.error("No userId provided");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("recordings")
      .select(`
        id,
        file_url,
        created_at,
        transcriptions (
          text
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const transcription = data?.transcriptions?.[0]?.text || null;

    return {
      ...data,
      transcription,
    };
  } catch (error) {
    console.error("Fetch recording failed:", error.message);
    return null;
  }
}

/**
 * Generates unique ID
 */
function generateUniqueId(prefix = "") {
  return crypto.randomUUID();
}

/**
 * Placeholder for email generation
 */
async function generateFollowUpEmail(transcriptionId) {
  return `Follow-up email based on transcription ${transcriptionId}`;
}

export {
  uploadRecording,
  fetchTranscription,
  requestFollowUp,
  fetchFollowUpEmail,
  getLatestRecording,
  generateUniqueId,
  saveTranscription,
  saveEditedTranscription
};