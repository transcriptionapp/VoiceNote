/**
 * Authentication Module
 * 
 * This module handles all authentication-related functionality including:
 * - User registration and login
 * - Session management
 * - Authentication state
 * - User profile management
 * 
 * It provides a clean API for other modules to interact with authentication.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { siteUrl, getPagePath, authConfig } from '../config.js';

// Constants
const STORAGE_KEY = 'sb-auth';
const SESSION_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Creates a Supabase client with proper configuration
 * @returns {Object} Supabase client instance
 */
function createSupabaseClient() {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://fxuafoiuwzsjezuqzjgn.supabase.co';
  const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4dWFmb2l1d3pzamV6dXF6amduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1NjQyNzEsImV4cCI6MjA1ODE0MDI3MX0.JhlxbWxMLp2ke05Em__gPbGAPcA24Rwbg9eOaWwMZ04';
  
  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: window.localStorage,
        storageKey: STORAGE_KEY,
        debug: true,
        autoRecoverSession: false,
        skipInitialQuery: true
      },
      global: {
        headers: {
          'X-Client-Info': 'voice-note-app',
          'X-Origin': window.location.origin
        }
      }
    });
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    throw new Error("Failed to initialize Supabase client");
  }
}

// Create and export the Supabase client
export const supabase = createSupabaseClient();

/**
 * Authentication error types
 */
export class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Authentication service class
 */
class AuthService {
  constructor() {
    this.supabase = supabase;
    this._session = null;
    this._user = null;
    this._listeners = new Set();
    this._initialized = false;
    this._initializing = false;
    
    // Initialize auth state
    this._init();
  }
  
  /**
   * Initialize authentication state
   * @private
   */
  async _init() {
    if (this._initializing) return;
    this._initializing = true;
    
    try {
      // Check if we have a stored session first
      const storedSession = localStorage.getItem(STORAGE_KEY);
      const hasStoredSession = !!storedSession;
      
      this._log('Initializing auth', { hasStoredSession });
      
      // Only try to get the session if we have one stored
      if (hasStoredSession) {
        // Get current session
        const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
        
        if (sessionError) {
          this._log('Session retrieval error', { error: sessionError.message });
          // Clear invalid session
          localStorage.removeItem(STORAGE_KEY);
        } else if (session) {
          this._session = session;
          this._user = session.user;
          this._log('Session retrieved', { 
            userId: this._maskUserId(this._user?.id)
          });
        }
      }
      
      // Set up auth state change listener
      this.supabase.auth.onAuthStateChange((event, session) => {
        this._log('Auth state changed', { event });
        this._session = session;
        this._user = session?.user || null;
        this._notifyListeners();
      });
      
      this._initialized = true;
      this._log('Auth initialized', { 
        authenticated: !!this._user,
        userId: this._user ? this._maskUserId(this._user.id) : null
      });
    } catch (error) {
      this._log('Auth initialization error', { error: error.message });
      // Don't throw, just log the error and continue with unauthenticated state
      this._initialized = true;
    } finally {
      this._initializing = false;
    }
  }
  
  /**
   * Register a listener for auth state changes
   * @param {Function} listener - Function to call when auth state changes
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(listener) {
    this._listeners.add(listener);
    
    // Call immediately with current state
    if (this._initialized) {
      listener(this._user, this._session);
    }
    
    // Return unsubscribe function
    return () => this._listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of auth state change
   * @private
   */
  _notifyListeners() {
    this._listeners.forEach(listener => {
      try {
        listener(this._user, this._session);
      } catch (error) {
        this._log('Listener error', { error: error.message });
      }
    });
  }
  
  /**
   * Get the appropriate redirect URL based on the current environment
   * @private
   * @returns {string} The redirect URL
   */
  _getRedirectUrl() {
    return authConfig.redirectUrl;
  }
  
  /**
   * Get the sign in redirect URL
   * @private
   * @returns {string} The sign in redirect URL
   */
  _getSignInRedirectUrl() {
    return authConfig.signInRedirectUrl;
  }
  
  /**
   * Sign up a new user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data
   */
  async signUp(email, password) {
    try {
      this._log('Signing up user', { email: this._maskEmail(email) });
      
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: this._getRedirectUrl()
        }
      });
      
      if (error) {
        this._log('Sign up error', { error: error.message });
        throw new AuthError(error.message, 'SIGNUP_ERROR');
      }
      
      this._log('Sign up successful', { 
        userId: this._maskUserId(data.user?.id),
        email: this._maskEmail(data.user?.email)
      });
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to sign up', 'SIGNUP_ERROR');
    }
  }
  
  /**
   * Sign in a user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data
   */
  async signIn(email, password) {
    try {
      this._log('Signing in user', { email: this._maskEmail(email) });
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        this._log('Sign in error', { error: error.message, status: error.status });
        
        // Supabase returns status 400 with "Invalid login credentials" for both
        // non-existent users and wrong passwords
        if (error.status === 400) {
          // We'll do an additional check to see if the user exists
          const { data: userData, error: userError } = await this.supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          
          if (!userData || userError) {
            throw new AuthError('No account found with this email. Please sign up first.', 'USER_NOT_FOUND');
          } else {
            throw new AuthError('Incorrect password. Please try again.', 'INVALID_PASSWORD');
          }
        } else if (error.message.includes('Email not confirmed')) {
          throw new AuthError('Please check your email to confirm your account before signing in.', 'EMAIL_NOT_CONFIRMED');
        } else {
          throw new AuthError(error.message, 'SIGNIN_ERROR');
        }
      }
      
      this._log('Sign in successful', { 
        userId: this._maskUserId(data.user?.id),
        email: this._maskEmail(data.user?.email)
      });
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to sign in', 'SIGNIN_ERROR');
    }
  }
  
  /**
   * Sign in with Google OAuth
   * @returns {Promise<Object>} User data
   */
  async signInWithGoogle() {
    try {
      this._log('Signing in with Google');
      
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: this._getSignInRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (error) {
        this._log('Google sign in error', { error: error.message });
        throw new AuthError(error.message, 'GOOGLE_SIGNIN_ERROR');
      }
      
      this._log('Google sign in initiated');
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to sign in with Google', 'GOOGLE_SIGNIN_ERROR');
    }
  }
  
  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      this._log('Signing out user', { 
        userId: this._maskUserId(this._user?.id),
        email: this._maskEmail(this._user?.email)
      });
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        this._log('Sign out error', { error: error.message });
        throw new AuthError(error.message, 'SIGNOUT_ERROR');
      }
      
      this._log('Sign out successful');
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to sign out', 'SIGNOUT_ERROR');
    }
  }
  
  /**
   * Get the current user
   * @returns {Object|null} Current user or null if not authenticated
   */
  getCurrentUser() {
    return this._user;
  }
  
  /**
   * Get the current session
   * @returns {Object|null} Current session or null if not authenticated
   */
  getCurrentSession() {
    return this._session;
  }
  
  /**
   * Check if the user is authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    return !!this._user && !!this._session;
  }
  
  /**
   * Check if the session is about to expire
   * @returns {boolean} True if session is about to expire, false otherwise
   */
  isSessionExpiring() {
    if (!this._session?.expires_at) return false;
    
    const expiryTime = this._session.expires_at * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    
    return expiryTime - currentTime < SESSION_EXPIRY_BUFFER;
  }
  
  /**
   * Get the user ID
   * @returns {string|null} User ID or null if not authenticated
   */
  getUserId() {
    return this._user?.id || null;
  }
  
  /**
   * Get the user email
   * @returns {string|null} User email or null if not authenticated
   */
  getUserEmail() {
    return this._user?.email || null;
  }
  
  /**
   * Update user profile data
   * @param {Object} data - User profile data to update
   * @returns {Promise<Object>} Updated user data
   */
  async updateUserProfile(data) {
    try {
      const userId = this.getUserId();
      if (!userId) {
        throw new AuthError('User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      this._log('Updating user profile', { 
        userId: this._maskUserId(userId),
        fields: Object.keys(data)
      });
      
      const { error } = await this.supabase
        .from('users')
        .update(data)
        .eq('id', userId);
      
      if (error) {
        this._log('Update profile error', { error: error.message });
        throw new AuthError(error.message, 'UPDATE_PROFILE_ERROR');
      }
      
      this._log('Profile updated successfully');
      
      return { success: true };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to update profile', 'UPDATE_PROFILE_ERROR');
    }
  }
  
  /**
   * Get user profile data
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile() {
    try {
      const userId = this.getUserId();
      if (!userId) {
        throw new AuthError('User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      this._log('Getting user profile', { userId: this._maskUserId(userId) });
      
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        this._log('Get profile error', { error: error.message });
        throw new AuthError(error.message, 'GET_PROFILE_ERROR');
      }
      
      this._log('Profile retrieved successfully');
      
      return data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to get profile', 'GET_PROFILE_ERROR');
    }
  }
  
  /**
   * Check if user has completed onboarding
   * @returns {Promise<boolean>} True if onboarding is complete, false otherwise
   */
  async hasCompletedOnboarding() {
    try {
      const profile = await this.getUserProfile();
      return !!profile?.onboarded;
    } catch (error) {
      this._log('Check onboarding error', { error: error.message });
      return false;
    }
  }
  
  /**
   * Mark onboarding as complete
   * @returns {Promise<Object>} Result of the operation
   */
  async completeOnboarding() {
    try {
      const userId = this.getUserId();
      if (!userId) {
        throw new AuthError('User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      this._log('Completing onboarding', { userId: this._maskUserId(userId) });
      
      const { error } = await this.supabase
        .from('users')
        .update({
          onboarded: true,
          onboarded_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        this._log('Complete onboarding error', { error: error.message });
        throw new AuthError(error.message, 'COMPLETE_ONBOARDING_ERROR');
      }
      
      this._log('Onboarding completed successfully');
      
      return { success: true };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to complete onboarding', 'COMPLETE_ONBOARDING_ERROR');
    }
  }
  
  /**
   * Delete all user data
   * @returns {Promise<Object>} Result of the operation
   */
  async deleteUserData() {
    try {
      const userId = this.getUserId();
      if (!userId) {
        throw new AuthError('User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      this._log('Deleting user data', { userId: this._maskUserId(userId) });
      
      // Delete user data from tables
      const tables = ['users', 'recordings', 'transcriptions', 'follow_ups'];
      
      for (const table of tables) {
        const { error } = await this.supabase
          .from(table)
          .delete()
          .eq('user_id', userId);
        
        if (error) {
          this._log(`Delete ${table} error`, { error: error.message });
          throw new AuthError(error.message, 'DELETE_DATA_ERROR');
        }
      }
      
      // Delete user storage
      const { error: storageError } = await this.supabase.storage
        .from('recordings')
        .remove([`${userId}/`]);
      
      if (storageError) {
        this._log('Delete storage error', { error: storageError.message });
        throw new AuthError(storageError.message, 'DELETE_STORAGE_ERROR');
      }
      
      this._log('User data deleted successfully');
      
      return { success: true };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Failed to delete user data', 'DELETE_DATA_ERROR');
    }
  }
  
  /**
   * Log a message with optional data
   * @param {string} message - Log message
   * @param {Object} [data] - Optional data to log
   * @private
   */
  _log(message, data = {}) {
    console.log(`[Auth] ${message}`, data);
  }
  
  /**
   * Mask a user ID for logging
   * @param {string} userId - User ID to mask
   * @returns {string} Masked user ID
   * @private
   */
  _maskUserId(userId) {
    if (!userId) return null;
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  }
  
  /**
   * Mask an email for logging
   * @param {string} email - Email to mask
   * @returns {string} Masked email
   * @private
   */
  _maskEmail(email) {
    if (!email) return null;
    const [username, domain] = email.split('@');
    if (!domain) return email;
    
    const maskedUsername = username.length > 2 
      ? `${username.substring(0, 2)}...${username.substring(username.length - 1)}`
      : username;
    
    return `${maskedUsername}@${domain}`;
  }
}

// Create and export a singleton instance
export const auth = new AuthService(); 

// Make supabase and auth available globally
window.supabase = supabase;
window.auth = auth;