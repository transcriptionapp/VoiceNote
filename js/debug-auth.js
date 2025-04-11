/**
 * Authentication Debugging Tools
 * 
 * This file provides functions to help diagnose authentication issues.
 * Run these functions in the browser console to check authentication state.
 */

import { supabase } from "./modules/auth.js";

// Make debugging functions available globally
window.debugAuth = {
  /**
   * Check the current session and user
   */
  async checkSession() {
    try {
      console.log("🔍 Checking authentication state...");
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log("📦 Session:", sessionData);
      if (sessionError) console.error("❌ Session error:", sessionError);
      
      // Check user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log("👤 User:", userData);
      if (userError) console.error("❌ User error:", userError);
      
      // Check local storage
      const authToken = localStorage.getItem('sb-auth');
      console.log("🔑 Auth token in localStorage:", authToken ? "Present" : "Missing");
      
      // Check if we have a valid token
      if (sessionData?.session?.access_token) {
        console.log("✅ Valid access token present");
      } else {
        console.log("❌ No valid access token");
      }
      
      return { session: sessionData, user: userData };
    } catch (error) {
      console.error("❌ Debug error:", error);
      return { error };
    }
  },
  
  /**
   * Force sign out to reset authentication state
   */
  async signOut() {
    try {
      console.log("🚪 Signing out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("❌ Sign out error:", error);
        return { error };
      }
      console.log("✅ Signed out successfully");
      return { success: true };
    } catch (error) {
      console.error("❌ Sign out error:", error);
      return { error };
    }
  },
  
  /**
   * Clear local storage to reset authentication state
   */
  clearStorage() {
    try {
      console.log("🧹 Clearing local storage...");
      localStorage.removeItem('sb-auth');
      console.log("✅ Local storage cleared");
      return { success: true };
    } catch (error) {
      console.error("❌ Clear storage error:", error);
      return { error };
    }
  },
  
  /**
   * Test CORS with a simple request to the Edge Function
   */
  async testCors() {
    try {
      console.log("🌐 Testing CORS with Edge Function...");
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("❌ No access token available");
        return { error: "No access token" };
      }
      
      // Make a test request
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
            test: true,
            message: "CORS test request"
          })
        }
      );
      
      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log("📡 Response body:", responseText);
      
      return { 
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      };
    } catch (error) {
      console.error("❌ CORS test error:", error);
      return { error };
    }
  }
};

// Log instructions for using the debug tools
console.log(`
🔧 Authentication Debugging Tools Available

Run these commands in the console:

1. Check authentication state:
   await window.debugAuth.checkSession()

2. Sign out to reset state:
   await window.debugAuth.signOut()

3. Clear local storage:
   window.debugAuth.clearStorage()

4. Test CORS with Edge Function:
   await window.debugAuth.testCors()
`); 