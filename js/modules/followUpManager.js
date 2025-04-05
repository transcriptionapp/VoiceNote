import { getUserId, supabase } from '../config.js';  // Import getUserId and supabase

export class FollowUpManager {
  constructor() {
    this.followUpUrl = 'https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up';
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

  // Generate follow-up email based on transcription using the Edge Function
  async generateFollowUp(recordingId) {
    try {
      const { userId, accessToken } = await this.checkAuthentication();

      const response = await fetch(this.followUpUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          transcription_id: recordingId,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Follow-up request failed:', errorText);
        throw new Error(`Follow-up failed: ${errorText}`);
      }

      const { email_text } = await response.json();
      return email_text; // Return the generated email text

    } catch (error) {
      console.error("Follow-up generation failed:", error.message);
      return "";
    }
  }
}