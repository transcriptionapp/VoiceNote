/**
 * Save the recording to the server
 * @param {Blob} audioBlob - The recorded audio blob
 * @returns {Promise<Object>} The saved recording data
 */
async saveRecording(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    const response = await fetch('/api/recordings', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to save recording');
    }
    
    const recordingData = await response.json();
    
    // Refresh recordings list with the new recording highlighted
    const recordings = await this.loadRecordings();
    this.uiManager.loadRecordingList(recordings, recordingData.id);
    
    return recordingData;
  } catch (error) {
    console.error('Error saving recording:', error);
    this.uiManager.showError('Failed to save recording');
    throw error;
  }
}

async generateFollowUp(currentRecordingId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No session found");

  const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      recording_id: currentRecordingId,
      user_id: user.id
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to generate follow-up:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      recordingId: currentRecordingId,
      userId: user.id
    });
    throw new Error(errorText || "Failed to generate follow-up");
  }

  const data = await response.json();
  return data.email_draft;
} 