/**
 * Onboarding Manager Module
 * 
 * Handles the complete onboarding flow for new users, including:
 * - Checking onboarding status
 * - Managing onboarding steps
 * - Updating user profile
 * - Redirecting to appropriate pages
 */

import { supabase } from './auth.js';
import { getPagePath } from '../config.js';

// Onboarding steps in order
const ONBOARDING_STEPS = {
  WELCOME: {
    path: '/onboarding/welcome.html',
    required: [],
    next: 'USE_CASE'
  },
  USE_CASE: {
    path: '/onboarding/use_case.html',
    required: ['use_case'],
    next: 'ROLE'
  },
  ROLE: {
    path: '/onboarding/role.html',
    required: ['role'],
    next: 'TOOLS'
  },
  TOOLS: {
    path: '/onboarding/tools.html',
    required: ['tools'],
    next: 'LANGUAGE'
  },
  LANGUAGE: {
    path: '/onboarding/language.html',
    required: ['language'],
    next: 'DONE'
  },
  DONE: {
    path: '/onboarding/done.html',
    required: ['role', 'use_case', 'tools', 'language'],
    next: null
  }
};

class OnboardingManager {
  constructor() {
    this.currentStep = null;
    this.userData = null;
  }

  /**
   * Initialize the onboarding manager
   */
  async init() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      if (!session?.user) {
        console.log("No active session, redirecting to signup");
        window.location.href = getPagePath('index.html');
        return;
      }

      // Load user data and determine current step
      const userData = await this.loadUserData();
      if (!userData) {
        console.log("No user data found, redirecting to signup");
        window.location.href = getPagePath('index.html');
        return;
      }

      this.determineCurrentStep();
      return this;
    } catch (error) {
      console.error("Error in onboarding init:", error);
      window.location.href = getPagePath('index.html');
      return;
    }
  }

  /**
   * Load user data from Supabase
   */
  async loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to load user data:', error);
      return null;
    }

    this.userData = data;
    return data;
  }

  /**
   * Determine which onboarding step the user should be on
   */
  determineCurrentStep() {
    if (!this.userData) return 'WELCOME';

    // Check if all required fields are filled
    const allFieldsFilled = ['role', 'use_case', 'tools', 'language'].every(
      field => this.userData[field] && this.userData[field] !== 'NULL'
    );

    // If user is fully onboarded and all fields are filled, they should be redirected to the app
    if (this.userData.onboarded && allFieldsFilled) {
      return 'APP';
    }

    // If all fields are filled but not marked as onboarded, go to DONE
    if (allFieldsFilled) {
      return 'DONE';
    }

    // Check each step in order to find the first missing field
    for (const [step, config] of Object.entries(ONBOARDING_STEPS)) {
      const missingFields = config.required.filter(field => 
        !this.userData[field] || this.userData[field] === 'NULL'
      );

      if (missingFields.length > 0) {
        return step;
      }
    }

    return 'WELCOME';
  }

  /**
   * Check if the user should be redirected to a different onboarding step
   */
  async checkRedirect() {
    const currentPath = window.location.pathname;
    const requiredStep = this.determineCurrentStep();
    
    // If user is fully onboarded, redirect to app
    if (requiredStep === 'APP') {
      window.location.href = getPagePath('recorder.html');
      return true;
    }
    
    const requiredPath = ONBOARDING_STEPS[requiredStep].path;
    const fullRequiredPath = getPagePath(requiredPath.substring(1)); // Remove leading slash

    // If user is on the wrong step, redirect them
    if (!currentPath.endsWith(requiredPath)) {
      window.location.href = fullRequiredPath;
      return true;
    }

    return false;
  }

  /**
   * Update user data for the current step
   */
  async updateStep(field, value) {
    if (!this.userData?.id) {
      console.error('No user ID available');
      return false;
    }

    const update = { [field]: value };

    const { error } = await supabase
      .from('users')
      .update(update)
      .eq('id', this.userData.id);

    if (error) {
      console.error('Failed to update user data:', error);
      return false;
    }

    // Reload user data
    await this.loadUserData();
    return true;
  }

  /**
   * Move to the next step in the onboarding flow
   */
  async nextStep() {
    const currentStep = this.determineCurrentStep();
    
    // If user is fully onboarded, redirect to app
    if (currentStep === 'APP') {
      window.location.href = getPagePath('recorder.html');
      return;
    }
    
    const nextStep = ONBOARDING_STEPS[currentStep].next;

    if (!nextStep) {
      // Onboarding complete, redirect to main app
      window.location.href = getPagePath('recorder.html');
      return;
    }

    const nextPath = ONBOARDING_STEPS[nextStep].path;
    window.location.href = getPagePath(nextPath.substring(1)); // Remove leading slash
  }

  /**
   * Check if all required fields are filled
   */
  isStepComplete(step) {
    const config = ONBOARDING_STEPS[step];
    return config.required.every(field => 
      this.userData && this.userData[field] && this.userData[field] !== 'NULL'
    );
  }

  /**
   * Get missing fields for the current step
   */
  getMissingFields() {
    const currentStep = this.determineCurrentStep();
    const config = ONBOARDING_STEPS[currentStep];
    
    return config.required.filter(field => 
      !this.userData || !this.userData[field] || this.userData[field] === 'NULL'
    );
  }
  
  /**
   * Mark onboarding as complete
   */
  async completeOnboarding() {
    if (!this.userData?.id) {
      console.error('No user ID available');
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({
        onboarded: true,
        onboarded_at: new Date().toISOString()
      })
      .eq('id', this.userData.id);

    if (error) {
      console.error('Failed to complete onboarding:', error);
      return false;
    }

    // Reload user data
    await this.loadUserData();
    return true;
  }

  /**
   * Get the current user's data
   */
  getUserData() {
    return this.userData;
  }

  /**
   * Get the value of a specific field
   */
  getFieldValue(field) {
    return this.userData ? this.userData[field] : null;
  }
}

// Export a singleton instance
export const onboardingManager = new OnboardingManager(); 