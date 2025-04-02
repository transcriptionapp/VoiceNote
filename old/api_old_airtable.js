// api.js - Handles API Requests

// Dependencies: Used by recorder.js for uploading, used by follow_up.js for fetching follow-up email

const AIRTABLE_API_KEY = 'Bearer pat8waL0o0Bzsz9u5.92fd5d6afa56f123e309c2c6a5c6e5bbbc8d722ee25fccd5918e274f7d8aa540';
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/appcQRU8kU0f9xO9l/Recordings';

// Upload audio file
async function uploadRecording(audioBlob, filename, recordingId, transcriptionId, userId) {
    if (!recordingId) {
        console.error("uploadRecording error: recordingId not set.");
        return;
    }

    let formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("recording_id", recordingId);
    formData.append("transcription_id", transcriptionId);
    formData.append("timestamp", new Date().toISOString());
    formData.append("user_id", userId);

    try {
        let response = await fetch(webhookURL, { method: "POST", body: formData });
        if (response.ok) {
            updateUI("Uploaded. Awaiting transcription...");
        } else {
            throw new Error("Upload failed");
        }
    } catch (error) {
        updateUI("Upload Failed!");
        document.getElementById("retryUpload").style.display = "inline";
        console.error("Upload error:", error);
    }
}

// Fetch transcription from Airtable
async function fetchTranscription(recordingId, retries = 10) {
    if (!recordingId) {
        console.error("fetchTranscription error: recordingId not set.");
        return;
    }
    try {
        const query = encodeURIComponent(`{recording_id}='${recordingId}'`);
        const response = await fetch(`${AIRTABLE_BASE_URL}?filterByFormula=${query}`, {
            headers: {"Authorization": AIRTABLE_API_KEY}
        });
        const data = await response.json();

        if (data.records.length > 0) {
            let transcriptionText = data.records[0].fields.transcription || "";
            
            // ✅ Update UI with the transcription
            document.getElementById("transcriptionText").value = transcriptionText;
            document.getElementById("transcriptionText").style.display = "block";
            document.getElementById("copyBtn").style.display = "inline";
            document.getElementById("gotoFollowup").style.display = "inline";
            document.getElementById("status").innerText = "Transcription Loaded!";
            
            console.log("✅ Transcription received:", transcriptionText);
        } else if (retries > 0) {
            console.warn(`No transcription found, retrying... (${retries} attempts left)`);
            
            // ✅ Corrected setTimeout() retry logic
            setTimeout(() => fetchTranscription(recordingId, retries - 1), 5000);
        } else {
            document.getElementById("status").innerText = "❌ Transcription not found.";
        }
    } catch (error) {
        console.error("Error fetching transcription:", error);
    }
}

// Request AI follow-up email generation
async function requestFollowUp(recordingId) {
    if (!recordingId) {
        console.error("requestFollowUp error: recordingId not set.");
        return;
    }
    
    const url = `${AIRTABLE_BASE_URL}?filterByFormula=` + encodeURIComponent(`{recording_id}='${recordingId}'`);
    const res = await fetch(url, { headers: {'Authorization': AIRTABLE_API_KEY} });
    const data = await res.json();

    if (data.records.length > 0) {
        const airtableRecordId = data.records[0].id;

        await fetch(`${AIRTABLE_BASE_URL}/${airtableRecordId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': AIRTABLE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    email_follow_up_requested: true,
                    follow_up_status: 'requested'
                }
            })
        });
    } else {
        throw new Error('No matching record found.');
    }
}

// Fetch AI-generated follow-up email
async function fetchFollowUpEmail(recordingId) {
    if (!recordingId) {
        console.error("fetchFollowUpEmail error: recordingId not set.");
        return;
    }
    
    const url = `${AIRTABLE_BASE_URL}?filterByFormula=` + encodeURIComponent(`{recording_id}='${recordingId}'`);
    const res = await fetch(url, { headers: {'Authorization': AIRTABLE_API_KEY} });
    const data = await res.json();

    if (data.records.length > 0 && data.records[0].fields.email_follow_up_text) {
        return data.records[0].fields.email_follow_up_text;
    }
    return null;
}

// Utility function to generate unique IDs
function generateUniqueId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

// Fetch latest recording for the given user
async function getLatestRecording(userId) {
    try {
        const query = encodeURIComponent(`{user_id}='${userId}'`);
        const response = await fetch(`${AIRTABLE_BASE_URL}?filterByFormula=${query}&sort[0][field]=timestamp&sort[0][direction]=desc&maxRecords=1`, {
            headers: { "Authorization": AIRTABLE_API_KEY }
        });

        const data = await response.json();
        if (data.records.length > 0) {
            let record = data.records[0].fields;

            // Ensure we only return a recording that has a valid file_url
            if (!record.file_url) {
                console.warn("⚠️ File URL is still missing, will retry...");
                return null; // Indicate that the file is not yet available
            }

            return record;
        }
        return null;
    } catch (error) {
        console.error("Error fetching latest recording:", error);
        return null;
    }
}