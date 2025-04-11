import { supabase } from "./modules/auth.js";

/**
 * Transcribes an audio file using OpenAI Whisper API via Edge Function
 * @param {string} recordingId - Related recording UUID
 * @param {string} storage_path - URL of the uploaded audio file
 * @param {string} userId - User ID of the authenticated user
 * @returns {Promise<string|null>} Transcribed text or null
 */
export async function transcribeAudio(recordingId, storage_path, userId) {
  try {
    // Get the session and access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('No active session');
    const accessToken = session.access_token;

    // Prepare the request body
    const body = {
      recording_id: recordingId,
      storage_path: storage_path,
      user_id: userId
    };

    console.log("📤 Calling Edge Function /transcribe-audio with payload:", body);
    
    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/transcribe-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    console.log("📥 Edge Function response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Edge Function error response:", errText);
      throw new Error(`Edge Function failed: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    console.log("✅ Transcription result:", result);
    return result;
  } catch (error) {
    console.error("❌ Transcription failed:", error);
    throw error;
  }
}