// utils.js - Utility Functions

// Dependencies: Used by recorder.js, follow_up.js, and api.js

// Generate a unique ID with a given prefix
function generateUniqueId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

// Update UI text dynamically
function updateUI(elementId, message) {
    document.getElementById(elementId).innerText = message;
}

// Show or hide an HTML element
function toggleVisibility(elementId, isVisible) {
    document.getElementById(elementId).style.display = isVisible ? 'block' : 'none';
}

// Handle API request errors
function handleApiError(error, context) {
    console.error(`Error in ${context}:`, error);
    updateUI('status', `❌ Error: ${context}`);
}

// Return the correct base URL depending on environment (local or GitHub Pages)
export function getBaseUrl() {
    const host = window.location.hostname;
    const isLocal = host === "127.0.0.1" || host === "localhost";

    // Support for local file:// testing (e.g. file:///Users/...)
    const isFile = window.location.protocol === "file:";

    return isLocal || isFile
        ? "http://127.0.0.1:5500/"
        : "https://transcriptionapp.github.io/VoiceNote";
}
