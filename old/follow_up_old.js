// follow_up.js - Handles AI Follow-Up Email Logic

// Dependencies: Uses api.js for fetching follow-up email, updates follow_up.html UI

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const recordingId = urlParams.get('recording_id');
    const transcriptionId = urlParams.get('transcription_id');
    const userId = urlParams.get('user_id');

    const statusEl = document.getElementById('status');
    const loaderEl = document.getElementById('loader');
    const emailTextEl = document.getElementById('emailText');
    const generateBtn = document.getElementById('generateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const retryBtn = document.getElementById('retryBtn');

    function updateStatus(message) {
        statusEl.textContent = message;
    }

    function pollForFollowUpEmail() {
        let attempts = 0;
        loaderEl.style.display = 'block';

        const intervalId = setInterval(async () => {
            attempts++;
            const emailText = await fetchFollowUpEmail(recordingId);

            if (emailText) {
                clearInterval(intervalId);
                emailTextEl.value = emailText;
                updateStatus('✅ Email is ready!');
                copyBtn.classList.remove('hidden');
                loaderEl.style.display = 'none';

                // ✅ Initialize ClipboardJS AFTER button is visible
                new ClipboardJS('#copyBtn').on('success', e => {
                    updateStatus('📋 Copied!');
                    e.clearSelection();
                });

            } else if (attempts >= 4) {
                clearInterval(intervalId);
                updateStatus('❌ No email found yet. Retry?');
                retryBtn.classList.remove('hidden');
                generateBtn.disabled = false;
                loaderEl.style.display = 'none';
            }
        }, 5000);
    }

    async function requestFollowUpEmail() {
        updateStatus('⏳ Requesting follow-up...');
        generateBtn.disabled = true;
        retryBtn.classList.add('hidden');
        loaderEl.style.display = 'block';

        try {
            await requestFollowUp(recordingId);
            updateStatus('⏳ Generating email...');
            pollForFollowUpEmail();
        } catch (error) {
            updateStatus('❌ Error requesting follow-up.');
            retryBtn.classList.remove('hidden');
            loaderEl.style.display = 'none';
            generateBtn.disabled = false;
        }
    }

    retryBtn.onclick = () => location.reload();

    // ✅ Ensure ClipboardJS initializes only when the button is visible
    copyBtn.addEventListener('click', () => {
        new ClipboardJS('#copyBtn').on('success', e => {
            updateStatus('📋 Copied!');
            e.clearSelection();
        });
    });

    window.onload = () => generateBtn.click();

    loaderEl.style.display = 'none';
    updateStatus('🚀 Ready to generate.');
});