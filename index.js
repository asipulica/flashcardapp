// Google Drive API Integration for Flashcard App
// Add this to your HTML file

// 1. Add Google API script to your HTML <head>:
/*
<script src="https://apis.google.com/js/api.js"></script>
<script src="https://accounts.google.com/gsi/client"></script>
*/

// 2. Google Drive Configuration
const GOOGLE_CONFIG = {
    CLIENT_ID: '540006831483-lsql3inrlecelc19nimmufqpfnc58od6.apps.googleusercontent.com', // Get from Google Cloud Console
    API_KEY: 'YAIzaSyDKAapUMzGhBTErw61f19103KOCzqBa1u0RE',     // Get from Google Cloud Console
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/drive.file'
};

let gapi;
let google;
let tokenClient;
let isGoogleApiLoaded = false;

// 3. Initialize Google API
async function initializeGoogleAPI() {
    try {
        await new Promise((resolve) => {
            gapi.load('client', resolve);
        });
        
        await gapi.client.init({
            apiKey: GOOGLE_CONFIG.API_KEY,
            discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_DOC]
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.CLIENT_ID,
            scope: GOOGLE_CONFIG.SCOPES,
            callback: (tokenResponse) => {
                console.log('Google Drive connected!');
                updateGoogleDriveStatus(true);
            }
        });

        isGoogleApiLoaded = true;
        console.log('Google API initialized successfully');
    } catch (error) {
        console.error('Error initializing Google API:', error);
        alert('Failed to initialize Google Drive API. Please check your configuration.');
    }
}

// 4. Connect to Google Drive
async function connectToGoogleDrive() {
    if (!isGoogleApiLoaded) {
        await initializeGoogleAPI();
    }

    try {
        tokenClient.requestAccessToken();
    } catch (error) {
        console.error('Error connecting to Google Drive:', error);
        alert('Failed to connect to Google Drive');
    }
}

// 5. Save flashcards to Google Drive
async function saveToGoogleDrive() {
    if (!gapi.client.getToken()) {
        alert('Please connect to Google Drive first');
        return;
    }

    try {
        const flashcardData = JSON.stringify(appData, null, 2);
        const fileName = `flashcards_backup_${new Date().toISOString().split('T')[0]}.json`;
        
        const fileMetadata = {
            name: fileName,
            parents: ['appDataFolder'] // This saves to app-specific folder
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
        form.append('file', new Blob([flashcardData], {type: 'application/json'}));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            }),
            body: form
        });

        if (response.ok) {
            const result = await response.json();
            alert('Flashcards saved to Google Drive successfully!');
            console.log('File saved:', result);
        } else {
            throw new Error('Failed to save to Google Drive');
        }
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        alert('Failed to save flashcards to Google Drive');
    }
}

// 6. Load flashcards from Google Drive
async function loadFromGoogleDrive() {
    if (!gapi.client.getToken()) {
        alert('Please connect to Google Drive first');
        return;
    }

    try {
        // List files in app data folder
        const response = await gapi.client.drive.files.list({
            q: "parents in 'appDataFolder' and name contains 'flashcards_backup'",
            orderBy: 'modifiedTime desc',
            pageSize: 10
        });

        const files = response.result.files;
        if (files.length === 0) {
            alert('No flashcard backups found in Google Drive');
            return;
        }

        // Get the most recent backup
        const latestFile = files[0];
        const fileResponse = await gapi.client.drive.files.get({
            fileId: latestFile.id,
            alt: 'media'
        });

        const flashcardData = JSON.parse(fileResponse.body);
        
        if (confirm(`Load flashcards from ${latestFile.name}? This will replace your current data.`)) {
            appData = flashcardData;
            saveData(); // Save to local storage
            updateFoldersDisplay();
            updateFolderSelects();
            alert('Flashcards loaded from Google Drive successfully!');
        }
    } catch (error) {
        console.error('Error loading from Google Drive:', error);
        alert('Failed to load flashcards from Google Drive');
    }
}

// 7. Update Google Drive connection status
function updateGoogleDriveStatus(connected) {
    const statusElement = document.getElementById('googledrive-status');
    const providerElement = statusElement.parentElement;
    
    if (connected) {
        statusElement.textContent = 'Connected ✅';
        providerElement.classList.add('connected');
        appData.cloudConnections.googledrive = true;
    } else {
        statusElement.textContent = 'Not Connected';
        providerElement.classList.remove('connected');
        appData.cloudConnections.googledrive = false;
    }
    
    saveData();
}

// 8. Auto-sync function
async function autoSyncToGoogleDrive() {
    if (appData.cloudConnections.googledrive && gapi.client.getToken()) {
        try {
            await saveToGoogleDrive();
            console.log('Auto-sync to Google Drive completed');
        } catch (error) {
            console.error('Auto-sync failed:', error);
        }
    }
}

// 9. Replace the existing connectCloud function for Google Drive
function connectCloud(provider) {
    if (provider === 'googledrive') {
        connectToGoogleDrive();
        return;
    }
    
    // Keep existing simulation for other providers
    appData.cloudConnections[provider] = !appData.cloudConnections[provider];
    
    const statusElement = document.getElementById(provider + '-status');
    const providerElement = statusElement.parentElement;
    
    if (appData.cloudConnections[provider]) {
        statusElement.textContent = 'Connected ✅';
        providerElement.classList.add('connected');
        alert(`Connected to ${provider.charAt(0).toUpperCase() + provider.slice(1)}!`);
    } else {
        statusElement.textContent = 'Not Connected';
        providerElement.classList.remove('connected');
        alert(`Disconnected from ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
    }
    
    saveData();
}

// 10. Enhanced sync function
async function syncAll() {
    const connectedProviders = Object.keys(appData.cloudConnections)
        .filter(provider => appData.cloudConnections[provider]);
    
    if (connectedProviders.length === 0) {
        alert('No cloud providers connected. Please connect to at least one cloud service.');
        return;
    }

    if (connectedProviders.includes('googledrive')) {
        await saveToGoogleDrive();
    }

    // Simulate sync for other providers
    const otherProviders = connectedProviders.filter(p => p !== 'googledrive');
    if (otherProviders.length > 0) {
        alert(`Also syncing with ${otherProviders.join(', ')}...`);
    }
}

// 11. Initialize when page loads
window.addEventListener('load', () => {
    // Initialize your existing app
    initApp();
    
    // Initialize Google API if scripts are loaded
    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
        initializeGoogleAPI();
    }
    
    // Auto-sync every 5 minutes
    setInterval(autoSyncToGoogleDrive, 5 * 60 * 1000);
});