import { getUserId, supabase } from '../config.js';  // Import getUserId and supabase

export class TranscriptionManager {
  constructor() {
    this.transcribeUrl = 'https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/transcribe-audio';
  }

  // Ensure user is authenticated before proceeding
  async checkAuthentication() {
    const userId = await getUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Ensure Supabase session is valid
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("No access token found for authorization");
    }

    return { userId, accessToken: session.access_token };
  }

  // Upload the recording to Supabase Storage
  async uploadRecording(audioBlob, recordingId) {
    const { userId } = await this.checkAuthentication();

    const filename = `recording_${recordingId}.mp3`;
    const { data, error } = await supabase.storage
      .from('recordings')
      .upload(`${userId}/${filename}`, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (error) {
      console.error('Failed to upload recording:', error.message);
      throw new Error('File upload failed');
    }

    // Generate a signed URL for the uploaded file
    const { data: signedData, error: signedError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(data.path, 3600); // URL valid for 1 hour

    if (signedError) {
      console.error('Failed to generate signed URL:', signedError.message);
      throw new Error('Signed URL generation failed');
    }

    return signedData?.signedUrl;  // Returning the signed URL for further processing
  }

  // Send the audio for transcription to the Supabase edge function
  async sendForTranscription(recordingId, audioFile) {
    try {
      const { userId, accessToken } = await this.checkAuthentication();

      // Step 1: Upload the recording to Supabase storage and get the signed URL
      const fileUrl = await this.uploadRecording(audioFile, recordingId);
      if (!fileUrl) {
        throw new Error('Missing file URL for uploaded file');
      }

      // Step 2: Prepare the request body for transcription
      const body = JSON.stringify({
        recording_id: recordingId,
        file_url: fileUrl, // Pass the valid signed URL
        user_id: userId,
      });

      // Step 3: Make the request to the edge function for transcription
      const response = await fetch(this.transcribeUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription request failed:', errorText);
        throw new Error(`Transcription failed: ${errorText}`);
      }

      const data = await response.json();
      return data.text;  // Return the transcription text

    } catch (error) {
      console.error("Transcription failed:", error.message);
      return null;
    }
  }
}