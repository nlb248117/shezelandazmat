// Configuration - Update these with your Google Sheets details
const CONFIG = {
    // Apps Script Web App URL - Replace with your deployed web app URL
    // Get this URL after deploying your Apps Script (see README for instructions)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwsLvQls6S0vlVDtotfl1iyFAEE6sieyOHooMCeqZhEdnhUh-9hsHcypi9LV6bIikY3uw/exec',
    EVENT_NAMES: {
        event1: 'Mehndi', // Name for Event 1
        event2: 'Shaadi', // Name for Event 2
        event3: 'Valima' // Name for Event 3
    },
    EVENT_DETAILS: {
        event1: {
            name: 'Mehndi',
            date: 'Friday, May 29, 2026',
            time: '6:00 PM',
            location: 'Star Edmonton Banquet & Conference Centre, 6930 34 St NW, Edmonton, AB T6B 2X2'
        },
        event2: {
            name: 'Shaadi',
            date: 'Sunday, May 31, 2026',
            time: '6:30 PM',
            location: 'Meridian Banquets, 4820 76 Ave NW, Edmonton, AB T6B 0A5'
        },
        event3: {
            name: 'Valima',
            date: 'Sunday, June 7, 2026',
            time: '6:30 PM',
            location: 'Bellvue Manor, 8083 Jane St, Concord, Ontario L4K 2M7, (Toronto Area)'
        }
    }
};

// State management
let currentToken = null;
let inviteData = null;
let hasRSVPed = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check for token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        currentToken = token;
        checkRSVPStatus(token);
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // RSVP button
    document.getElementById('rsvp-button').addEventListener('click', () => {
        if (currentToken) {
            // If token exists, check if already RSVPed
            checkRSVPStatus(currentToken);
        } else {
            // Show password modal
            document.getElementById('password-modal').style.display = 'block';
        }
    });
    
    // Password form submission
    document.getElementById('password-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('password-input').value.trim();
        if (password) {
            currentToken = password;
            checkRSVPStatus(password);
        }
    });
    
    // Close modal
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('password-modal').style.display = 'none';
        document.getElementById('password-error').classList.remove('show');
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('password-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
            document.getElementById('password-error').classList.remove('show');
        }
    });
    
    // Back button
    document.getElementById('back-button').addEventListener('click', () => {
        showLandingPage();
    });
}

async function checkRSVPStatus(token) {
    toggleGlobalLoading(true, 'Checking RSVP status...');
    try {
        // Use GET request to avoid CORS issues with Apps Script
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=checkRSVPStatus&token=${encodeURIComponent(token)}`;
        
        // Load invite data first (we'll use this regardless)
        await loadInviteData(token);
        
        if (!inviteData || inviteData.length === 0) {
            showError('Invalid invitation code. Please check and try again.');
            toggleGlobalLoading(false);
            return;
        }
        
        // Try to check RSVP status using GET (works better with Apps Script)
        try {
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success && result.hasRSVPed && result.responses && result.responses.length > 0) {
                hasRSVPed = true;
                showSummaryFromExistingResponses(result.responses);
                toggleGlobalLoading(false);
                return;
            }
        } catch (fetchError) {
            // If fetch fails due to CORS, we'll just show the form
            // (user might not have RSVPed yet, or we can't check)
            console.log('Could not check RSVP status, showing form');
        }
        
        // Not RSVPed yet or couldn't check, show form
        showRSVPForm();
        toggleGlobalLoading(false);
    } catch (error) {
        console.error('Error checking RSVP status:', error);
        showError('Unable to verify invitation. Please try again later.');
        toggleGlobalLoading(false);
    }
}

async function loadInviteData(token) {
    try {
        // Use GET request to avoid CORS issues
        const url = `${CONFIG.APPS_SCRIPT_URL}?action=getInviteData&token=${encodeURIComponent(token)}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load invitation data');
        }
        
        // Map the data and add event names
        inviteData = result.data.map(row => ({
            token: row.token,
            name: row.name,
            event1: row.event1,
            event2: row.event2,
            event3: row.event3,
            event1Name: CONFIG.EVENT_NAMES.event1,
            event2Name: CONFIG.EVENT_NAMES.event2,
            event3Name: CONFIG.EVENT_NAMES.event3
        }));
    } catch (error) {
        console.error('Error loading invite data:', error);
        throw error;
    }
}

function showRSVPForm() {
    // Hide landing page and modal
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('password-modal').style.display = 'none';
    document.getElementById('rsvp-form-page').classList.remove('hidden');
    
    // Clear any previous errors
    const formError = document.getElementById('form-error');
    if (formError) {
        formError.classList.remove('show');
        formError.textContent = '';
    }
    
    // Show loading initially
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('form-content').classList.add('hidden');
    
    // Build form
    setTimeout(() => {
        buildRSVPForm();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('form-content').classList.remove('hidden');
    }, 500);
}

function buildRSVPForm() {
    const formContent = document.getElementById('rsvp-form');
    const attendeesList = document.getElementById('attendees-list');
    
    // Remove any existing events info section
    const existingEventsSection = formContent.querySelector('.events-info-section');
    if (existingEventsSection) {
        existingEventsSection.remove();
    }
    
    attendeesList.innerHTML = '';
    
    // Check which events have at least one invitee
    const hasEvent1 = inviteData.some(attendee => attendee.event1);
    const hasEvent2 = inviteData.some(attendee => attendee.event2);
    const hasEvent3 = inviteData.some(attendee => attendee.event3);
    
    // Add event information section if any events are present
    if (hasEvent1 || hasEvent2 || hasEvent3) {
        const eventsInfoSection = document.createElement('div');
        eventsInfoSection.className = 'events-info-section';
        eventsInfoSection.innerHTML = '<h2>Event Details</h2>';
        
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';
        
        if (hasEvent1) {
            eventsContainer.appendChild(createEventInfoCard('event1'));
        }
        if (hasEvent2) {
            eventsContainer.appendChild(createEventInfoCard('event2'));
        }
        if (hasEvent3) {
            eventsContainer.appendChild(createEventInfoCard('event3'));
        }
        
        eventsInfoSection.appendChild(eventsContainer);
        formContent.insertBefore(eventsInfoSection, attendeesList);
    }
    
    inviteData.forEach((attendee, index) => {
        const attendeeGroup = document.createElement('div');
        attendeeGroup.className = 'attendee-group';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'attendee-name';
        nameDiv.textContent = attendee.name;
        attendeeGroup.appendChild(nameDiv);
        
        // Create grid container for event checkboxes
        const eventsGrid = document.createElement('div');
        eventsGrid.className = 'attendee-events-grid';
        
        // Event 1
        if (attendee.event1) {
            const event1Group = createEventCheckbox('event1', CONFIG.EVENT_NAMES.event1, index, true);
            eventsGrid.appendChild(event1Group);
        }
        
        // Event 2
        if (attendee.event2) {
            const event2Group = createEventCheckbox('event2', CONFIG.EVENT_NAMES.event2, index, true);
            eventsGrid.appendChild(event2Group);
        }
        
        // Event 3
        if (attendee.event3) {
            const event3Group = createEventCheckbox('event3', CONFIG.EVENT_NAMES.event3, index, true);
            eventsGrid.appendChild(event3Group);
        }
        
        attendeeGroup.appendChild(eventsGrid);
        attendeesList.appendChild(attendeeGroup);
    });
    
    // Setup form submission (remove old listener first)
    const form = document.getElementById('rsvp-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', handleFormSubmit);
}

function createEventCheckbox(eventKey, eventName, attendeeIndex, enabled) {
    const group = document.createElement('div');
    group.className = 'event-checkbox-group';
    
    const label = document.createElement('label');
    label.className = `event-label ${enabled ? '' : 'disabled'}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = `attendee_${attendeeIndex}_${eventKey}`;
    checkbox.value = 'attending';
    checkbox.disabled = !enabled;
    if (enabled) {
        checkbox.checked = false; // Default to attending
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'event-name';
    nameSpan.textContent = eventName;
    
    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    group.appendChild(label);
    
    return group;
}

function createEventInfoCard(eventKey) {
    const eventDetails = CONFIG.EVENT_DETAILS[eventKey];
    if (!eventDetails) return null;
    
    const card = document.createElement('div');
    card.className = 'event-info-card';
    
    card.innerHTML = `
        <div class="event-info-header">
            <h3>${eventDetails.name}</h3>
        </div>
        <div class="event-info-body">
            <div class="event-info-item">
                <span class="event-info-icon">📅</span>
                <span class="event-info-label">Date:</span>
                <span class="event-info-value">${eventDetails.date}</span>
            </div>
            <div class="event-info-item">
                <span class="event-info-icon">🕐</span>
                <span class="event-info-label">Time:</span>
                <span class="event-info-value">${eventDetails.time}</span>
            </div>
            <div class="event-info-item">
                <span class="event-info-icon">📍</span>
                <span class="event-info-label">Location:</span>
                <span class="event-info-value">${eventDetails.location}</span>
            </div>
        </div>
    `;
    
    return card;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    toggleGlobalLoading(true, 'Submitting RSVP...');
    try {
        // Collect form data
        const formData = new FormData(e.target);
        const responses = [];
        
        inviteData.forEach((attendee, index) => {
            const response = {
                token: currentToken,
                name: attendee.name,
                event1: null,
                event2: null,
                event3: null
            };
            
            if (attendee.event1) {
                response.event1 = formData.get(`attendee_${index}_event1`) === 'attending' ? 'Yes' : 'No';
            }
            if (attendee.event2) {
                response.event2 = formData.get(`attendee_${index}_event2`) === 'attending' ? 'Yes' : 'No';
            }
            if (attendee.event3) {
                response.event3 = formData.get(`attendee_${index}_event3`) === 'attending' ? 'Yes' : 'No';
            }
            
            responses.push(response);
        });
        
        // Submit to Google Sheets
        try {
            await submitRSVP(responses);
            toggleGlobalLoading(false);
            // Show summary on success
            showSummaryFromResponses(responses);
        } catch (error) {
            // If submission fails, still show summary (data may have been saved)
            // This handles cases where we can't verify due to CORS
            console.warn('Could not verify submission, but assuming success:', error);
            toggleGlobalLoading(false);
            showSummaryFromResponses(responses);
        }
    } catch (error) {
        console.error('Error submitting RSVP:', error);
        toggleGlobalLoading(false);
        const formError = document.getElementById('form-error');
        if (formError) {
            formError.textContent = 'Failed to submit RSVP. Please try again.';
            formError.classList.add('show');
        } else {
            alert('Failed to submit RSVP. Please try again.');
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Submit RSVP';
    }
}

async function submitRSVP(responses) {
    // Google Apps Script doesn't support CORS for POST requests
    // Use a form-based submission workaround
    return new Promise((resolve, reject) => {
        // Create a hidden form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = CONFIG.APPS_SCRIPT_URL;
        form.style.display = 'none';
        
        // Create a hidden input with the JSON data
        const dataInput = document.createElement('input');
        dataInput.type = 'hidden';
        dataInput.name = 'data';
        dataInput.value = JSON.stringify({
            action: 'submitRSVP',
            responses: responses
        });
        form.appendChild(dataInput);
        
        // Create a hidden iframe to receive the response
        const iframe = document.createElement('iframe');
        iframe.name = 'rsvp-submit-frame-' + Date.now();
        iframe.style.display = 'none';
        form.target = iframe.name;
        
        // Add to page
        document.body.appendChild(iframe);
        document.body.appendChild(form);
        
        // Set up response handler
        let resolved = false;
        
        const checkResponse = () => {
            try {
                // Try to access iframe content (may fail due to CORS, but that's OK)
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const bodyText = iframeDoc.body ? (iframeDoc.body.textContent || iframeDoc.body.innerText) : '';
                
                if (bodyText) {
                    try {
                        const result = JSON.parse(bodyText);
                        if (result.success) {
                            resolved = true;
                            cleanup();
                            resolve(result);
                            return;
                        } else {
                            resolved = true;
                            cleanup();
                            reject(new Error(result.error || 'Failed to submit RSVP'));
                            return;
                        }
                    } catch (e) {
                        // Not JSON, might be HTML error page
                        // Check if it contains success indicators
                        if (bodyText.includes('success') || bodyText.includes('RSVP submitted')) {
                            resolved = true;
                            cleanup();
                            resolve({ success: true });
                            return;
                        }
                    }
                }
            } catch (e) {
                // CORS - can't read iframe content, but that's expected
                // The submission likely succeeded, we just can't verify it
            }
        };
        
        const cleanup = () => {
            try {
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
                if (form.parentNode) {
                    document.body.removeChild(form);
                }
            } catch (e) {}
        };
        
        // Check response after a delay
        iframe.onload = () => {
            setTimeout(checkResponse, 500);
        };
        
        // Fallback: assume success after reasonable time
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                // Assume success - Apps Script processed the form submission
                resolve({ success: true });
            }
        }, 3000);
        
        // Submit the form
        form.submit();
    });
}

function showSummaryFromExistingResponses(existingResponses) {
    // existingResponses: array of response objects from Apps Script
    // Format: {token, name, event1, event2, event3, timestamp}
    const responses = existingResponses.map(response => {
        const attendee = inviteData.find(inv => inv.name === response.name);
        
        return {
            name: response.name,
            event1: attendee && attendee.event1 ? (response.event1 || 'N/A') : null,
            event2: attendee && attendee.event2 ? (response.event2 || 'N/A') : null,
            event3: attendee && attendee.event3 ? (response.event3 || 'N/A') : null
        };
    });
    
    showSummaryFromResponses(responses);
}

function showSummaryFromResponses(responses) {
    // Hide all pages
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('rsvp-form-page').classList.add('hidden');
    document.getElementById('password-modal').style.display = 'none';
    
    // Show summary page
    document.getElementById('summary-page').classList.remove('hidden');
    
    // Build summary
    const summaryDetails = document.getElementById('summary-details');
    summaryDetails.innerHTML = '';
    
    responses.forEach(response => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'summary-item-name';
        nameDiv.textContent = response.name;
        summaryItem.appendChild(nameDiv);
        
        inviteData.forEach(attendee => {
            if (attendee.name === response.name) {
                if (attendee.event1 && response.event1) {
                    const eventDiv = document.createElement('div');
                    eventDiv.className = 'summary-event';
                    eventDiv.textContent = `${attendee.event1Name}: ${response.event1}`;
                    summaryItem.appendChild(eventDiv);
                }
                if (attendee.event2 && response.event2) {
                    const eventDiv = document.createElement('div');
                    eventDiv.className = 'summary-event';
                    eventDiv.textContent = `${attendee.event2Name}: ${response.event2}`;
                    summaryItem.appendChild(eventDiv);
                }
                if (attendee.event3 && response.event3) {
                    const eventDiv = document.createElement('div');
                    eventDiv.className = 'summary-event';
                    eventDiv.textContent = `${attendee.event3Name}: ${response.event3}`;
                    summaryItem.appendChild(eventDiv);
                }
            }
        });
        
        summaryDetails.appendChild(summaryItem);
    });
}

function showLandingPage() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('rsvp-form-page').classList.add('hidden');
    document.getElementById('summary-page').classList.add('hidden');
    document.getElementById('password-modal').style.display = 'none';
    
    // Reset state
    currentToken = null;
    inviteData = null;
    hasRSVPed = false;
}

function showError(message) {
    const errorDiv = document.getElementById('password-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    } else {
        // If password modal is not visible, show error in form
        const formError = document.getElementById('form-error');
        if (formError) {
            formError.textContent = message;
            formError.classList.add('show');
        } else {
            alert(message);
        }
    }
}

// === ADD THIS NEW FUNCTION ===
function toggleGlobalLoading(show, message = 'Loading...') {
    const loader = document.getElementById('global-loader');
    const textElement = document.getElementById('loader-text');
    
    if (show) {
        if (textElement) textElement.textContent = message;
        if (loader) loader.classList.remove('hidden');
    } else {
        if (loader) loader.classList.add('hidden');
    }

}


