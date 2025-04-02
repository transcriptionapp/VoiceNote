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
