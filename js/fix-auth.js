/**
 * Authentication Fix Tool
 * 
 * This file provides a function to fix common authentication issues.
 * It can be run from the browser console to reset authentication state.
 */

import { supabase } from "./modules/auth.js";

// Make the fix function available globally
window.fixAuth = async function() {
  console.log("🔧 Starting authentication fix process...");
  
  try {
    // Step 1: Check current authentication state
    console.log("1️⃣ Checking current authentication state...");
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    
    console.log("Current state:", {
      hasSession: !!session,
      hasUser: !!user,
      hasAccessToken: !!session?.access_token
    });
    
    // Step 2: Clear local storage
    console.log("2️⃣ Clearing local storage...");
    localStorage.removeItem('sb-auth');
    
    // Step 3: Sign out
    console.log("3️⃣ Signing out...");
    await supabase.auth.signOut();
    
    // Step 4: Reload the page
    console.log("4️⃣ Reloading page...");
    console.log("✅ Authentication fix complete. The page will now reload.");
    
    // Small delay to allow console messages to be seen
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    return { success: true, message: "Authentication reset complete. Page will reload." };
  } catch (error) {
    console.error("❌ Authentication fix error:", error);
    return { error, message: "Failed to fix authentication" };
  }
};

// Log instructions for using the fix tool
console.log(`
🔧 Authentication Fix Tool Available

To reset authentication state and fix issues, run this command in the console:

await window.fixAuth()

This will:
1. Check your current authentication state
2. Clear local storage
3. Sign you out
4. Reload the page

After the page reloads, sign in again to establish a fresh session.
`); 