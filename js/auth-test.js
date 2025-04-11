/**
 * Authentication Test Tool
 * 
 * This script provides a comprehensive test for authentication and CORS issues.
 * It checks the authentication state, makes test requests, and logs detailed information.
 */

import { supabase } from './modules/auth.js';

// Make the test function available globally
window.authTest = async function() {
  try {
    console.log('🔍 Starting comprehensive authentication test...');
    
    // Step 1: Check environment
    console.log('1️⃣ Environment check:');
    console.log('Origin:', window.location.origin);
    console.log('Hostname:', window.location.hostname);
    console.log('Pathname:', window.location.pathname);
    
    // Step 2: Check local storage
    console.log('2️⃣ Local storage check:');
    const authToken = localStorage.getItem('sb-auth');
    console.log('Auth token in localStorage:', authToken ? 'Present' : 'Missing');
    if (authToken) {
      try {
        const parsedToken = JSON.parse(authToken);
        console.log('Token structure:', Object.keys(parsedToken));
        console.log('Token expiry:', new Date(parsedToken.expires_at * 1000).toLocaleString());
      } catch (e) {
        console.error('Failed to parse auth token:', e);
      }
    }
    
    // Step 3: Check session
    console.log('3️⃣ Session check:');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Session data:', sessionData);
    if (sessionError) console.error('Session error:', sessionError);
    
    // Step 4: Check user
    console.log('4️⃣ User check:');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log('User data:', userData);
    if (userError) console.error('User error:', userError);
    
    // Step 5: Test CORS with a simple request
    console.log('5️⃣ CORS test:');
    try {
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        console.log('No access token available for CORS test');
      } else {
        console.log('Making test request with token:', accessToken.substring(0, 10) + '...');
        
        const response = await fetch('https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/cors-test', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
          const data = await response.json();
          console.log('Response data:', data);
        } else {
          console.error('Response error:', response.statusText);
          const errorText = await response.text();
          console.error('Error details:', errorText);
        }
      }
    } catch (corsError) {
      console.error('CORS test error:', corsError);
    }
    
    // Step 6: Check Supabase client configuration
    console.log('6️⃣ Supabase client check:');
    console.log('Supabase URL:', supabase.supabaseUrl);
    console.log('Supabase headers:', supabase.headers);
    
    console.log('✅ Authentication test complete');
    return { success: true };
  } catch (error) {
    console.error('❌ Authentication test error:', error);
    return { error };
  }
};

// Log instructions for using the test tool
console.log(`
🔧 Authentication Test Tool Available

To run a comprehensive authentication test, run this command in the console:

await window.authTest()

This will:
1. Check your environment details
2. Verify local storage contents
3. Check session and user data
4. Test CORS with the Edge Function
5. Verify Supabase client configuration
6. Log detailed diagnostic information
`); 