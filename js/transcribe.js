import { supabase, getUserId } from "./config.js";

/**
 * Transcribes an audio file using OpenAI Whisper API
 * @param {Object} params - Parameters for transcription
 * @param {string} params.recordingId - Related recording UUID
 * @param {string} params.storage_path - URL of the uploaded audio file
 * @param {string} params.userId - User ID of the authenticated user
 * @returns {Promise<string|null>} Transcribed text or null
 */
export async function transcribeAudio(params) {
  const { recordingId, storage_path, userId } = params;
  console.log("📞 transcribeAudio function called with:", { recordingId, storage_path });

  try {
    console.log("🙋‍♂️ Using provided userId:", userId);
    if (!userId) throw new Error("User not authenticated");

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    console.log("🔐 Access token retrieved:", accessToken ? "✅ Present" : "❌ Missing");
    if (!accessToken) throw new Error("No access token available");

    const requestBody = {
      recording_id: recordingId,
      storage_path,
      user_id: userId
    };

    console.log("🚀 Preparing transcription request with:", requestBody);
    console.log("📤 Calling Edge Function /transcribe-audio with payload:", requestBody);

    console.log("📡 Sending transcription request to:", "https://fxuafoiuwzsjezuqzjgn.functions.supabase.co/transcribe-audio");
    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.functions.supabase.co/transcribe-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log("📥 Edge Function response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Edge Function error response:", errText);
      throw new Error(`Edge Function failed: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    console.log("📝 Full transcription response JSON:", result);
    console.log("📄 Transcription result text:", result.text);
    console.log("✅ Transcription result:", result);

    return result.text || null;

  } catch (error) {
    console.error("❌ Transcription error:", error);
    return null;
  }
}