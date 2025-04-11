/**
 * CORS Test Tool
 * 
 * This script provides a function to test CORS configuration with the Edge Function.
 * It checks authentication state, makes a test request, and logs the response details.
 */

import { supabase } from './modules/auth.js';

// Make the test function available globally
window.testCors = async function() {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    console.log('Current session:', session)

    // Get the access token
    const accessToken = session?.access_token
    if (!accessToken) {
      console.error('No access token found')
      return
    }

    // Make a test request to the CORS testing function
    const response = await fetch('https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/cors-test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })

    // Log response details
    console.log('Response status:', response.status)
    console.log('Response status text:', response.statusText)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    // Parse and log the response body
    const data = await response.json()
    console.log('Response data:', data)

    return data
  } catch (error) {
    console.error('Error testing CORS:', error)
    throw error
  }
}

console.log(`
🌐 CORS Test Tool Available

To test CORS with the Edge Function, run this command in the console:

await window.testCors()

This will:
1. Check your authentication state
2. Make a test request to the Edge Function
3. Log the response details
4. Help diagnose any CORS issues
`); 