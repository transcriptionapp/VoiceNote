/**
 * UIManager
 * 
 * Manages the user interface elements for the recorder application.
 * Handles loading states, error messages, and the display of past recordings.
 * Includes accessibility improvements and responsive design considerations.
 */

export class UIManager {
    constructor() {
    // UI Elements
    this.recordButton = document.getElementById('recordButton');
    this.stopButton = document.getElementById('stopButton');
    this.audioPlayer = document.getElementById('audioPlayer');
    this.recordingStatus = document.getElementById('recordingStatus');
    this.recordingTime = document.getElementById('recordingTime');
    this.transcriptionContainer = document.getElementById('transcriptionContainer');
    this.loadingIndicator = document.getElementById('loadingIndicator');
    this.errorMessage = document.getElementById('errorMessage');
    this.pastRecordingsContainer = document.getElementById('pastRecordingsContainer');
    
    // State
    this.isLoading = false;
    this.hasError = false;
    
    // Initialize UI
    this._initializeUI();
  }

  /**
   * Initialize the UI elements
   * @private
   */
  _initializeUI() {
    // Set initial states
    this._updateButtonStates(false);
    this._hideLoadingIndicator();
    this._hideErrorMessage();
    
    // Add accessibility attributes
    this._addAccessibilityAttributes();
    
    // Add event listeners for responsive design
    this._addResponsiveEventListeners();
  }

  /**
   * Add accessibility attributes to UI elements
   * @private
   */
  _addAccessibilityAttributes() {
    // Record button
    if (this.recordButton) {
      this.recordButton.setAttribute('aria-label', 'Start recording');
      this.recordButton.setAttribute('role', 'button');
      this.recordButton.setAttribute('tabindex', '0');
    }
    
    // Stop button
    if (this.stopButton) {
      this.stopButton.setAttribute('aria-label', 'Stop recording');
      this.stopButton.setAttribute('role', 'button');
      this.stopButton.setAttribute('tabindex', '0');
    }
    
    // Audio player
    if (this.audioPlayer) {
      this.audioPlayer.setAttribute('aria-label', 'Recording playback');
      this.audioPlayer.setAttribute('controls', '');
    }
    
    // Recording status
    if (this.recordingStatus) {
      this.recordingStatus.setAttribute('aria-live', 'polite');
    }
    
    // Loading indicator
    if (this.loadingIndicator) {
      this.loadingIndicator.setAttribute('aria-live', 'polite');
      this.loadingIndicator.setAttribute('aria-busy', 'true');
    }
    
    // Error message
    if (this.errorMessage) {
      this.errorMessage.setAttribute('aria-live', 'assertive');
      this.errorMessage.setAttribute('role', 'alert');
    }
  }

  /**
   * Add event listeners for responsive design
   * @private
   */
  _addResponsiveEventListeners() {
    // Handle window resize events
    window.addEventListener('resize', this._handleResize.bind(this));
    
    // Handle orientation change events
    window.addEventListener('orientationchange', this._handleOrientationChange.bind(this));
  }

  /**
   * Handle window resize events
   * @private
   */
  _handleResize() {
    // Adjust UI elements based on screen size
    this._adjustUIForScreenSize();
  }

  /**
   * Handle orientation change events
   * @private
   */
  _handleOrientationChange() {
    // Adjust UI elements based on orientation
    this._adjustUIForOrientation();
  }

  /**
   * Adjust UI elements based on screen size
   * @private
   */
  _adjustUIForScreenSize() {
    const isMobile = window.innerWidth < 768;
    
    // Adjust button sizes for mobile
    if (this.recordButton) {
      this.recordButton.classList.toggle('mobile-button', isMobile);
    }
    
    if (this.stopButton) {
      this.stopButton.classList.toggle('mobile-button', isMobile);
    }
    
    // Adjust container padding for mobile
    if (this.transcriptionContainer) {
      this.transcriptionContainer.classList.toggle('mobile-container', isMobile);
    }
  }

  /**
   * Adjust UI elements based on orientation
   * @private
   */
  _adjustUIForOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    
    // Adjust layout for portrait orientation
    if (this.transcriptionContainer) {
      this.transcriptionContainer.classList.toggle('portrait-layout', isPortrait);
    }
  }

  /**
   * Update the recording status
   * @param {boolean} isRecording - Whether recording is in progress
   */
  updateRecordingStatus(isRecording) {
    if (this.recordingStatus) {
      this.recordingStatus.textContent = isRecording ? 'Recording...' : 'Ready to record';
      this.recordingStatus.classList.toggle('recording', isRecording);
      }
  
      if (this.recordingTime) {
      this.recordingTime.textContent = isRecording ? '00:00' : '';
      this.recordingTime.classList.toggle('visible', isRecording);
    }
    
    this._updateButtonStates(isRecording);
  }

  /**
   * Update the recording time
   * @param {string} formattedTime - The formatted recording time
   */
  updateRecordingTime(formattedTime) {
    if (this.recordingTime) {
      this.recordingTime.textContent = formattedTime;
    }
  }

  /**
   * Update the button states based on recording status
   * @param {boolean} isRecording - Whether recording is in progress
   * @private
   */
  _updateButtonStates(isRecording) {
    if (this.recordButton) {
      this.recordButton.disabled = isRecording;
      this.recordButton.classList.toggle('disabled', isRecording);
      this.recordButton.setAttribute('aria-disabled', isRecording);
    }
    
    if (this.stopButton) {
      this.stopButton.disabled = !isRecording;
      this.stopButton.classList.toggle('disabled', !isRecording);
      this.stopButton.setAttribute('aria-disabled', !isRecording);
    }
  }

  /**
   * Set the audio source for playback
   * @param {Blob} audioBlob - The audio blob to play
   */
  setAudioSource(audioBlob) {
    if (this.audioPlayer) {
      const audioUrl = URL.createObjectURL(audioBlob);
      this.audioPlayer.src = audioUrl;
      this.audioPlayer.classList.add('visible');
      
      // Clean up the URL when the audio is loaded
      this.audioPlayer.onloadeddata = () => {
        URL.revokeObjectURL(audioUrl);
      };
    }
  }

  /**
   * Display the transcription result
   * @param {string} transcription - The transcription text
   */
  displayTranscription(transcription) {
    if (this.transcriptionContainer) {
      this.transcriptionContainer.innerHTML = `<p>${transcription}</p>`;
      this.transcriptionContainer.classList.add('visible');
    }
  }

  /**
   * Show the loading indicator
   */
  showLoadingIndicator() {
    this.isLoading = true;
    this._showLoadingIndicator();
  }

  /**
   * Hide the loading indicator
   */
  hideLoadingIndicator() {
    this.isLoading = false;
    this._hideLoadingIndicator();
  }

  /**
   * Show the loading indicator element
   * @private
   */
  _showLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.add('visible');
      this.loadingIndicator.setAttribute('aria-busy', 'true');
    }
  }

  /**
   * Hide the loading indicator element
   * @private
   */
  _hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.remove('visible');
      this.loadingIndicator.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Display an error message
   * @param {string} message - The error message to display
   */
  displayError(message) {
    this.hasError = true;
    this._showErrorMessage(message);
  }

  /**
   * Hide the error message
   */
  hideError() {
    this.hasError = false;
    this._hideErrorMessage();
  }

  /**
   * Show the error message element
   * @param {string} message - The error message to display
   * @private
   */
  _showErrorMessage(message) {
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
      this.errorMessage.classList.add('visible');
    }
  }

  /**
   * Hide the error message element
   * @private
   */
  _hideErrorMessage() {
    if (this.errorMessage) {
      this.errorMessage.textContent = '';
      this.errorMessage.classList.remove('visible');
    }
  }

  /**
   * Display past recordings
   * @param {Array} recordings - Array of past recordings
   */
  displayPastRecordings(recordings) {
    if (!this.pastRecordingsContainer || !recordings || recordings.length === 0) {
      return;
    }
    
    // Clear existing content
    this.pastRecordingsContainer.innerHTML = '';
    
    // Create heading
    const heading = document.createElement('h2');
    heading.textContent = 'Past Recordings';
    heading.setAttribute('id', 'past-recordings-heading');
    this.pastRecordingsContainer.appendChild(heading);
    
    // Create list
    const list = document.createElement('ul');
    list.setAttribute('aria-labelledby', 'past-recordings-heading');
    
    // Add recordings to list
    recordings.forEach((recording, index) => {
      const listItem = document.createElement('li');
      
      // Create recording date
      const date = document.createElement('span');
      date.textContent = new Date(recording.created_at).toLocaleString();
      date.classList.add('recording-date');
      
      // Create play button
      const playButton = document.createElement('button');
      playButton.textContent = 'Play';
      playButton.classList.add('play-button');
      playButton.setAttribute('aria-label', `Play recording from ${date.textContent}`);
      playButton.setAttribute('data-url', recording.url);
      
      // Add click event to play button
      playButton.addEventListener('click', () => {
        this._playPastRecording(recording.url);
      });
      
      // Add elements to list item
      listItem.appendChild(date);
      listItem.appendChild(playButton);
      
      // Add list item to list
      list.appendChild(listItem);
    });
    
    // Add list to container
    this.pastRecordingsContainer.appendChild(list);
    
    // Show container
    this.pastRecordingsContainer.classList.add('visible');
  }

  /**
   * Play a past recording
   * @param {string} url - The URL of the recording to play
   * @private
   */
  _playPastRecording(url) {
    if (this.audioPlayer) {
      this.audioPlayer.src = url;
      this.audioPlayer.classList.add('visible');
      this.audioPlayer.play();
    }
  }

  /**
   * Update the recording button state
   * @param {boolean} isRecording - Whether recording is in progress
   */
  updateRecordingButton(isRecording) {
    const recordButton = document.getElementById("recordToggle");
    if (isRecording) {
      recordButton.classList.add("bg-red-500", "hover:bg-red-600");
      recordButton.classList.remove("bg-blue-500", "hover:bg-blue-600");
      recordButton.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
    } else {
      recordButton.classList.add("bg-blue-500", "hover:bg-blue-600");
      recordButton.classList.remove("bg-red-500", "hover:bg-red-600");
      recordButton.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
    }
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    const loadingElement = document.getElementById("loadingIndicator");
    if (loadingElement) {
      loadingElement.classList.remove("hidden");
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingElement = document.getElementById("loadingIndicator");
    if (loadingElement) {
      loadingElement.classList.add("hidden");
    }
  }

  /**
   * Update the transcription text
   * @param {string} text - The transcription text
   */
  updateTranscription(text) {
    const transcriptionText = document.getElementById("transcriptionText");
    if (transcriptionText) {
      transcriptionText.value = text;
    }
  }

  /**
   * Update UI with a message
   * @param {string} message - The message to display
   */
  updateUI(message) {
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  /**
   * Load the list of past recordings
   * @param {Array} recordings - Array of recording objects
   * @param {string} [highlightRecordingId] - ID of the recording to highlight as new
   */
  loadRecordingList(recordings, highlightRecordingId = null) {
    const container = document.getElementById('recordingsList');
    if (!container) return;

    // Clear existing recordings
    container.innerHTML = '';

    if (!recordings || recordings.length === 0) {
      container.innerHTML = '<div class="text-gray-500 text-center py-4">No recordings yet. Start recording to see your past recordings here.</div>';
      return;
    }

    recordings.forEach(recording => {
      const recordingElement = document.createElement('div');
      recordingElement.className = 'recording-item bg-white rounded-lg shadow p-4 mb-4';
      
      // Add highlight class if this is the new recording
      if (recording.id === highlightRecordingId) {
        recordingElement.classList.add('highlight-new');
      }

      const date = new Date(recording.created_at);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

      recordingElement.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="text-sm text-gray-500">${formattedDate}</div>
            <div class="mt-2 text-gray-700">${recording.transcription || 'No transcription available'}</div>
          </div>
          <div class="flex gap-2 ml-4">
            <button class="play-recording px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600" 
                    data-recording-id="${recording.id}"
                    data-storage-path="${recording.storage_path}">
              Play
            </button>
            <button class="view-followup px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    data-recording-id="${recording.id}">
              Follow-up
            </button>
          </div>
        </div>
        <!-- Collapsible sections -->
        <div class="recording-playback mt-4 hidden">
          <audio class="w-full" controls></audio>
        </div>
        <div class="recording-followup mt-4 hidden">
          <div class="flex flex-col gap-2">
            <textarea class="w-full bg-[#e7edf3] rounded-xl p-4 text-base text-[#0e141b] placeholder:text-[#4e7397] focus:outline-none min-h-36 resize-none" 
                      placeholder="Generating follow-up email..."></textarea>
            <button class="generate-followup w-full h-10 rounded-full bg-[#1980e6] text-white text-sm font-bold hover:bg-[#1670c5] transition-colors duration-200">
              Send Follow Up via Gmail
            </button>
          </div>
          </div>
        `;
  
      container.appendChild(recordingElement);
    });

    // Add event listeners for the new recording items
    this._addRecordingEventListeners();

    // Add highlight animation styles if not already present
    if (!document.getElementById('highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'highlight-styles';
      style.textContent = `
        @keyframes highlight {
          0% { background-color: #e3f2fd; }
          100% { background-color: white; }
        }
        .highlight-new {
          animation: highlight 2s ease-out;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Add event listeners for recording actions
   * @private
   */
  _addRecordingEventListeners() {
    // Play recording buttons
    document.querySelectorAll('.play-recording').forEach(button => {
      button.addEventListener('click', async (event) => {
        const recordingId = event.currentTarget.getAttribute('data-recording-id');
        const storagePath = event.currentTarget.getAttribute('data-storage-path');
        const recordingItem = event.currentTarget.closest('.recording-item');
        const playbackSection = recordingItem.querySelector('.recording-playback');
        const audioElement = playbackSection.querySelector('audio');
        
        if (!recordingId || !storagePath) {
          console.error('Missing recording ID or storage path');
          this.displayError('Unable to play recording: Missing data');
              return;
            }
  
        try {
          this.showLoading();
          console.log('Getting public URL for path:', storagePath);
          
          // Get the public URL using the storage path
          const { data, error } = await supabase.storage
            .from('recordings')
            .createSignedUrl(storagePath, 3600); // 1 hour expiry
          
          if (error) {
            console.error('Error getting signed URL:', error);
            throw error;
          }
          
          if (!data?.signedUrl) {
            console.error('No signed URL returned');
            throw new Error('Failed to get audio URL');
          }
          
          console.log('Got signed URL:', data.signedUrl);
          
          // Toggle playback section visibility
          playbackSection.classList.toggle('hidden');
          
          // Set up audio element
          audioElement.src = data.signedUrl;
          audioElement.play();
          
          // Add event listener for when audio ends
          audioElement.onended = () => {
            playbackSection.classList.add('hidden');
          };
        } catch (error) {
          console.error('Error playing recording:', error);
          this.displayError('Failed to play recording: ' + error.message);
        } finally {
          this.hideLoading();
        }
      });
    });
    
    // View follow-up buttons
    document.querySelectorAll('.view-followup').forEach(button => {
      button.addEventListener('click', async (event) => {
        const recordingId = event.currentTarget.getAttribute('data-recording-id');
        if (!recordingId) return;
        
        // Redirect to the follow-up page with the recording ID
        window.location.href = `follow_up.html?recording_id=${recordingId}`;
      });
    });
    
    // Generate follow-up buttons
    document.querySelectorAll('.generate-followup').forEach(button => {
      button.addEventListener('click', async (event) => {
        const recordingItem = event.currentTarget.closest('.recording-item');
        const recordingId = recordingItem.querySelector('.view-followup').getAttribute('data-recording-id');
        const textarea = recordingItem.querySelector('textarea');
        
        try {
          this.showLoading();
          const transcription = await this._fetchTranscription(recordingId);
          if (transcription) {
            const followUp = await this._generateFollowUp(recordingId, transcription);
            if (followUp) {
              textarea.value = followUp;
            }
          }
        } catch (error) {
          console.error('Error generating follow-up:', error);
          this.displayError('Failed to generate follow-up: ' + error.message);
        } finally {
          this.hideLoading();
        }
      });
    });
  }
  
  /**
   * Fetch transcription for a recording
   * @param {string} recordingId - The recording ID
   * @returns {Promise<string>} The transcription text
   * @private
   */
  async _fetchTranscription(recordingId) {
    try {
      console.log(`🔍 UIManager: Fetching transcription for recording_id: ${recordingId}`);
      
      const { data, error } = await supabase
        .from("transcriptions")
        .select("text, edited_text")
        .eq("recording_id", recordingId)
        .single();

      if (error) {
        console.error("❌ Error fetching transcription:", error);
        throw error;
      }
      
      // Check if we have data
      if (!data) {
        console.warn("⚠️ No transcription data found for recording_id:", recordingId);
        return "";
      }
      
      // Log what we found
      console.log("📝 Transcription data:", {
        hasEditedText: !!data.edited_text,
        hasOriginalText: !!data.text,
        editedTextLength: data.edited_text?.length || 0,
        originalTextLength: data.text?.length || 0
      });
      
      // Return the edited text if available, otherwise return the original text
      return data.edited_text || data.text || "";
    } catch (error) {
      console.error("❌ Error in _fetchTranscription:", error);
      throw error;
    }
  }

  /**
   * Generate follow-up email
   * @param {string} recordingId - The recording ID
   * @param {string} transcription - The transcription text
   * @returns {Promise<string>} The generated follow-up email
   * @private
   */
  async _generateFollowUp(recordingId, transcription) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error("Not authenticated");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No session found");

    console.log("Sending follow-up request with:", {
      recordingId,
      transcriptionLength: transcription?.length || 0,
      userId: user.id
    });

    const response = await fetch("https://fxuafoiuwzsjezuqzjgn.supabase.co/functions/v1/generate-follow-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        recording_id: recordingId,
        user_id: user.id,
        transcription_text: transcription
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Follow-up generation failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        recordingId,
        userId: user.id
      });
      throw new Error(`Failed to generate follow-up: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Save the generated follow-up to the database
    const { error: saveError } = await supabase
      .from("follow_ups")
      .upsert({
        recording_id: recordingId,
        email_draft: result.email_draft,
        transcription_id: result.transcription_id,
        summary: result.summary,
        user_id: user.id,
        is_edited: false,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error("Failed to save follow-up:", saveError);
      throw new Error("Failed to save follow-up to database");
    }

    return result.email_draft;  // Return just the email_draft string
  }
}