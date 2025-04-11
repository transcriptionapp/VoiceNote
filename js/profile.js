// Profile page functionality
import { supabase } from './modules/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const menuBtn = document.getElementById('menuBtn');
    const userInfoContainer = document.getElementById('userInfo');
    const preferencesContainer = document.getElementById('preferences');
    const dataManagementContainer = document.getElementById('dataManagement');

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = './index.html';
        return;
    }

    // Load user information
    async function loadUserInfo() {
        const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error loading profile:', error);
            return;
        }

        if (userInfoContainer) {
            userInfoContainer.innerHTML = `
                <h2>User Information</h2>
                <p class="preferences-subtitle">Your account details and profile settings</p>
                <div class="profile-header">
                    <div class="avatar-container">
                        <img 
                            id="avatarImg"
                            src="${profile?.avatar_url || 'https://placehold.co/200x200'}" 
                            alt="Profile picture"
                            class="avatar-img"
                        />
                        <div id="uploadProgress" class="upload-progress hidden">
                            <div class="loader"></div>
                        </div>
                        <input 
                            type="file" 
                            id="avatarInput" 
                            accept="image/*"
                            class="hidden" 
                        />
                        <button class="avatar-edit-btn" onclick="document.getElementById('avatarInput').click()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                                <path d="M224,76H180.28L166.65,55.49A8,8,0,0,0,160,52H96a8,8,0,0,0-6.65,3.49L75.72,76H32A16,16,0,0,0,16,92V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V92A16,16,0,0,0,224,76ZM128,168a36,36,0,1,1,36-36A36,36,0,0,1,128,168Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Email</label>
                        <span>${user.email}</span>
                    </div>
                    <div class="info-item">
                        <label>Name</label>
                        <span>${profile?.name || 'Not set'}</span>
                    </div>
                    <div class="info-item">
                        <label>Created</label>
                        <span>${new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;

            // Add event listener for avatar upload
            const avatarInput = document.getElementById('avatarInput');
            if (avatarInput) {
                avatarInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 5 * 1024 * 1024) { // 5MB limit
                            alert('File size must be less than 5MB');
                            return;
                        }
                        await uploadAvatar(file);
                    }
                });
            }
        }
    }

    // Load user preferences
    async function loadPreferences() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('language, role, tools, use_case')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            const preferencesContainer = document.getElementById('preferences');
            preferencesContainer.innerHTML = `
                <h2>Your Transcription Settings</h2>
                <p class="preferences-subtitle">Set your primary Transcription and Follow-Up Settings</p>
                <div class="preference-item">
                    <h3>Language</h3>
                    <p class="preference-description">Select your primary language for transcription</p>
                    <select id="language" class="preference-select">
                        <option value="English" ${data.language === 'English' ? 'selected' : ''}>English</option>
                        <option value="Spanish" ${data.language === 'Spanish' ? 'selected' : ''}>Spanish</option>
                        <option value="French" ${data.language === 'French' ? 'selected' : ''}>French</option>
                        <option value="German" ${data.language === 'German' ? 'selected' : ''}>German</option>
                        <option value="Other" ${data.language === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="preference-item">
                    <h3>Role</h3>
                    <p class="preference-description">What best describes your professional role?</p>
                    <select id="role" class="preference-select">
                        <option value="consultant" ${data.role === 'consultant' ? 'selected' : ''}>Consultant</option>
                        <option value="recruiter" ${data.role === 'recruiter' ? 'selected' : ''}>Recruiter</option>
                        <option value="lawyer" ${data.role === 'lawyer' ? 'selected' : ''}>Lawyer</option>
                        <option value="sales" ${data.role === 'sales' ? 'selected' : ''}>Sales Representative</option>
                        <option value="coach" ${data.role === 'coach' ? 'selected' : ''}>Coach</option>
                        <option value="other" ${data.role === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="preference-item">
                    <h3>Use Case</h3>
                    <p class="preference-description">What type of conversations do you want to capture?</p>
                    <select id="useCase" class="preference-select">
                        <option value="Client meetings" ${data.use_case === 'Client meetings' ? 'selected' : ''}>Client meetings</option>
                        <option value="Sales calls" ${data.use_case === 'Sales calls' ? 'selected' : ''}>Sales calls</option>
                        <option value="Interviews" ${data.use_case === 'Interviews' ? 'selected' : ''}>Interviews</option>
                        <option value="Legal discussions" ${data.use_case === 'Legal discussions' ? 'selected' : ''}>Legal discussions</option>
                        <option value="Coaching sessions" ${data.use_case === 'Coaching sessions' ? 'selected' : ''}>Coaching sessions</option>
                        <option value="Internal team syncs" ${data.use_case === 'Internal team syncs' ? 'selected' : ''}>Internal team syncs</option>
                        <option value="Other" ${data.use_case === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="preference-item">
                    <h3>Tools</h3>
                    <p class="preference-description">Select the tools you use for recording conversations</p>
                    <button id="toolsBtn" class="tools-select-btn">
                        ${data.tools ? data.tools.split(',').length : 0} tools selected
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>
                        </svg>
                    </button>
                    <div id="toolsDropdown" class="tools-dropdown hidden">
                        <div class="tools-options">
                            <label class="tool-option">
                                <input type="checkbox" value="Mobile phone" ${data.tools && data.tools.includes('Mobile phone') ? 'checked' : ''}>
                                <span>Mobile phone</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="Desktop computer" ${data.tools && data.tools.includes('Desktop computer') ? 'checked' : ''}>
                                <span>Desktop computer</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="Zoom / Online meetings" ${data.tools && data.tools.includes('Zoom / Online meetings') ? 'checked' : ''}>
                                <span>Zoom / Online meetings</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="In-person 1:1s" ${data.tools && data.tools.includes('In-person 1:1s') ? 'checked' : ''}>
                                <span>In-person 1:1s</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="Conferences / Events" ${data.tools && data.tools.includes('Conferences / Events') ? 'checked' : ''}>
                                <span>Conferences / Events</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="Office meetings" ${data.tools && data.tools.includes('Office meetings') ? 'checked' : ''}>
                                <span>Office meetings</span>
                            </label>
                            <label class="tool-option">
                                <input type="checkbox" value="Real-estate viewings" ${data.tools && data.tools.includes('Real-estate viewings') ? 'checked' : ''}>
                                <span>Real-estate viewings</span>
                            </label>
                        </div>
                        <div class="tools-dropdown-footer">
                            <button id="applyTools" class="apply-tools-btn">Apply</button>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners for the dropdowns
            document.getElementById('language').addEventListener('change', function() {
                updatePreference('language', this.value);
            });

            document.getElementById('role').addEventListener('change', function() {
                updatePreference('role', this.value);
            });

            document.getElementById('useCase').addEventListener('change', function() {
                updatePreference('use_case', this.value);
            });

            // Tools dropdown functionality
            const toolsBtn = document.getElementById('toolsBtn');
            const toolsDropdown = document.getElementById('toolsDropdown');
            const applyToolsBtn = document.getElementById('applyTools');

            toolsBtn.addEventListener('click', function() {
                toolsDropdown.classList.toggle('hidden');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!toolsBtn.contains(e.target) && !toolsDropdown.contains(e.target)) {
                    toolsDropdown.classList.add('hidden');
                }
            });

            applyToolsBtn.addEventListener('click', function() {
                const selectedTools = Array.from(document.querySelectorAll('.tool-option input:checked'))
                    .map(checkbox => checkbox.value);
                updatePreference('tools', selectedTools.join(','));
                toolsBtn.textContent = `${selectedTools.length} tools selected`;
                toolsDropdown.classList.add('hidden');
            });

        } catch (error) {
            console.error('Error loading preferences:', error);
            preferencesContainer.innerHTML = '<p class="error">Failed to load preferences</p>';
        }
    }

    // Handle data management actions
    async function handleDataManagement() {
        if (dataManagementContainer) {
            dataManagementContainer.innerHTML = `
                <h2>Data Management</h2>
                <p class="preferences-subtitle">Export or delete your data</p>
                <div class="data-management-grid">
                    <button class="delete-btn" onclick="deleteAllData()">
                        Delete All Data
                    </button>
                    <button class="export-btn" onclick="exportData()">
                        Export Data
                    </button>
                </div>
            `;
        }
    }

    // Initialize the page
    await loadUserInfo();
    await loadPreferences();
    await handleDataManagement();

    // Add event listeners
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            window.history.back();
        });
    }

    // Profile picture upload
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    alert('File size must be less than 5MB');
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    alert('Please upload an image file');
                    return;
                }
                uploadAvatar(file);
            }
        });
    }
});

// Update preference function
async function updatePreference(field, value) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const { error } = await supabase
            .from('users')
            .update({ [field]: value })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating preference:', error);
            alert('Failed to update preference');
            return;
        }

        // Show success message
        alert(`${field} updated successfully`);
    } catch (error) {
        console.error('Error updating preference:', error);
        alert('Failed to update preference');
    }
}

// Edit preference function
window.editPreference = async (field) => {
    const newValue = prompt(`Enter new ${field}:`);
    if (!newValue) return;

    await updatePreference(field, newValue);
};

// Delete all data function
window.deleteAllData = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        // Delete recordings
        const { error: recordingsError } = await supabase
            .from('recordings')
            .delete()
            .eq('user_id', user.id);

        if (recordingsError) throw recordingsError;

        // Delete transcriptions
        const { error: transcriptionsError } = await supabase
            .from('transcriptions')
            .delete()
            .eq('user_id', user.id);

        if (transcriptionsError) throw transcriptionsError;

        alert('All data has been deleted successfully');
        window.location.reload();
    } catch (error) {
        console.error('Error deleting data:', error);
        alert('Failed to delete data');
    }
};

// Export data function
window.exportData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        // Get user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError) throw userError;

        // Get recordings
        const { data: recordings, error: recordingsError } = await supabase
            .from('recordings')
            .select('*')
            .eq('user_id', user.id);

        if (recordingsError) throw recordingsError;

        // Get transcriptions
        const { data: transcriptions, error: transcriptionsError } = await supabase
            .from('transcriptions')
            .select('*')
            .eq('user_id', user.id);

        if (transcriptionsError) throw transcriptionsError;

        // Create export data
        const exportData = {
            user: userData,
            recordings,
            transcriptions
        };

        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voicenote-export-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data');
    }
};

// Profile Picture Upload Functions
async function uploadAvatar(file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!file || !user) return;

    try {
        // Show loading state
        const avatarImg = document.getElementById('avatarImg');
        const uploadProgress = document.getElementById('uploadProgress');
        avatarImg.style.opacity = '0.5';
        uploadProgress.classList.remove('hidden');

        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user profile with new avatar URL
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Update UI
        avatarImg.src = publicUrl;
        avatarImg.style.opacity = '1';
        uploadProgress.classList.add('hidden');

    } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('Failed to upload profile picture. Please try again.');
        // Reset UI
        const avatarImg = document.getElementById('avatarImg');
        const uploadProgress = document.getElementById('uploadProgress');
        avatarImg.style.opacity = '1';
        uploadProgress.classList.add('hidden');
    }
}

// Profile Picture Functions
async function initializeProfilePicture() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        const avatarImg = document.getElementById('avatarImg');
        if (data.avatar_url) {
            avatarImg.src = data.avatar_url;
        }
    } catch (error) {
        console.error('Error loading avatar:', error);
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        // Show loading state
        const avatarImg = document.getElementById('avatarImg');
        const uploadProgress = document.getElementById('uploadProgress');
        avatarImg.style.opacity = '0.5';
        uploadProgress.classList.remove('hidden');

        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user profile with new avatar URL
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Update UI
        avatarImg.src = publicUrl;
        avatarImg.style.opacity = '1';
        uploadProgress.classList.add('hidden');

    } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('Failed to upload profile picture. Please try again.');
        
        // Reset UI
        const avatarImg = document.getElementById('avatarImg');
        const uploadProgress = document.getElementById('uploadProgress');
        avatarImg.style.opacity = '1';
        uploadProgress.classList.add('hidden');
    }
}

// Initialize profile picture on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeProfilePicture();
    
    // Add event listener for file input
    const fileInput = document.getElementById('avatarInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleAvatarUpload);
    }
}); 