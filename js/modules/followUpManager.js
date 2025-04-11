import { getUserId } from '../done.js';  // Import getUserId from done.js
import { supabase } from '../modules/auth.js';  // Import supabase from auth.js

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
  async generateFollowUp(transcriptionId) {
    try {
      const { userId, accessToken } = await this.checkAuthentication();
      
      // Prepare the request body
      const body = {
        recording_id: transcriptionId,
        user_id: userId
      };
      
      // Use direct fetch with proper authorization headers
      console.log("📤 Calling Edge Function /generate-follow-up with payload:", body);
      const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ Edge Function error response:", errText);
        throw new Error(`Edge Function failed: ${response.status} - ${errText}`);
      }
      
      const result = await response.json();
      console.log("📝 Follow-up generation result:", result);
      
      return result.email_draft;
    } catch (error) {
      console.error("Follow-up generation failed:", error.message);
      return null;
    }
  }
}