/**
 * Configuration Module
 * 
 * This module provides configuration and utility functions for the application.
 * It handles environment-specific settings and paths.
 */

// Determine if we're running on GitHub Pages
const isGitHubPages = window.location.hostname.includes('github.io');

// Base path configuration
export const basePath = isGitHubPages ? '/VoiceNote' : '';

// Site URL configuration
export const siteUrl = isGitHubPages 
  ? 'https://transcriptionapp.github.io'
  : window.location.origin;

// API endpoint configuration
export const apiEndpoints = {
  transcribe: isGitHubPages
    ? 'https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/transcribe-audio'
    : 'http://localhost:54321/functions/v1/transcribe-audio',
  generateFollowUp: isGitHubPages
    ? 'https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up'
    : 'http://localhost:54321/functions/v1/generate-follow-up'
};

// Asset paths configuration
export const assetPaths = {
  icons: `${basePath}/icons`,
  css: `${basePath}/css`,
  js: `${basePath}/js`
};

// Fallback configuration
export const fallbacks = {
  audioFormat: ['audio/webm', 'audio/mp4', 'audio/wav'],
  storageEndpoint: 'https://fxuafoiuwzsjezuqzjgn.supabase.co/storage/v1',
  defaultLanguage: 'English',
  defaultRole: 'other'
};

// Initialize configuration on module load
(async () => {
  try {
    console.log("Configuration initialized:", {
      environment: isGitHubPages ? 'github-pages' : 'development',
      basePath,
      siteUrl,
      apiEndpoints
    });
  } catch (error) {
    console.error("Configuration initialization error:", error);
  }
})();

// Helper function to get the full path for an asset
export function getAssetPath(type, filename) {
  return `${assetPaths[type]}/${filename}`;
}

// Helper function to get the full path for a page
export function getPagePath(page) {
  return `${basePath}/${page}`;
}