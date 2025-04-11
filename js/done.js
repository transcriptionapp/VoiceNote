/**
 * Done Module
 * 
 * This module handles the completion of the recording process and user authentication.
 * It imports the authentication module and uses it for user-related operations.
 */

import { supabase, auth } from './modules/auth.js';

// Re-export auth functions for backward compatibility
export { supabase, auth };

// User helper functions that use the auth module
export async function getUserId() {
  return auth.getUserId();
}

export async function getCurrentUser() {
  return auth.getCurrentUser();
}

export async function debugAuthStatus() {
  const session = auth.getCurrentSession();
  const user = auth.getCurrentUser();

  return {
    session: session ? {
      expiresAt: new Date(session.expires_at * 1000),
      accessToken: session.access_token ? "****" + session.access_token.slice(-4) : null
    } : null,
    user: user ? {
      id: user.id,
      email: user.email,
      lastSignIn: new Date(user.last_sign_in_at)
    } : null
  };
}

// Initialize auth on module load
(async () => {
  try {
    // Test database connection
    await supabase.from("recordings").select("*").limit(1);
    
    // Log auth status
    const isAuthenticated = auth.isAuthenticated();
    console.log("Supabase initialized | Auth:", isAuthenticated ? "✅ Authenticated" : "⚠️ Not authenticated");
    
    // Expose debug functions in development
    if (import.meta.env?.MODE === "development") {
      window.supabase = supabase;
      window.getUserId = getUserId;
      window.debugAuthStatus = debugAuthStatus;
    }
  } catch (error) {
    console.error("Initialization error:", error);
    throw new Error("Supabase failed to initialize");
  }
})(); 