// 🔹 REQUEST LOCATION PERMISSION ON PAGE LOAD
window.addEventListener('load', function() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Location permission granted');
            },
            (error) => {
                console.warn('⚠️ Location permission not granted:', error);
            }
        );
    }
});
// =============================================
//  CONFIGURATION
// =============================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9Km1bp8RhdUEa4LbH_rSTimCONjj1uodB2ZZHM0Qye5xPoYkmoe_7qv_MjLRPZZkRig/exec';

// =============================================
//  GLOBAL STATE VARIABLES
// =============================================
let capturedPhoto = null;
let geoLocation = null;
let geoSource = null;
let geoAccuracy = null;
let photoTimestamp = null;
let selectedTier = null;
let originalFile = null;

// =============================================
//  BUTTON FLOW STATE
// =============================================
let isPdfDownloaded = false;
let isFormSubmitted = false;
let isPhotoCaptured = false;

// =============================================
//  BUTTON CLICK LOGS (Timestamps + Location)
// =============================================
let buttonLogs = {
    // PDF Button
    pdfClickTime: null,
    pdfClickLat: null,
    pdfClickLong: null,
    
    // Submit Button
    submitClickTime: null,
    submitClickLat: null,
    submitClickLong: null,
    
    // Capture Photo Button
    captureClickTime: null,
    captureClickLat: null,
    captureClickLong: null
};

// =============================================
// VALIDATION RULES
// =============================================
const validationRules = {
    name: {
        pattern: /^[A-Za-z\s]+$/,
        message: 'Only alphabets and spaces allowed',
        minLength: 2,
        maxLength: 100
    },
    phone: {
        pattern: /^[6-9][0-9]{9}$/,
        message: 'Enter valid 10-digit mobile number (starting with 6-9)',
        exactLength: 10
    },
    alphanumeric: {
        pattern: /^[A-Za-z0-9\s\-]+$/,
        message: 'Only alphanumeric characters allowed',
        minLength: 1
    }
};

// =============================================
// GET CURRENT LOCATION (Promise-based)
// =============================================
function getCurrentLocationPromise(timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude.toFixed(6),
                    longitude: position.coords.longitude.toFixed(6),
                    accuracy: position.coords.accuracy.toFixed(0) + 'm'
                });
            },
            (error) => {
                console.warn('Location error:', error);
                resolve(null); // Resolve with null instead of rejecting
            },
            {
                enableHighAccuracy: true,
                timeout: timeout,
                maximumAge: 0
            }
        );
    });
}

// =============================================
// LOG BUTTON CLICK WITH TIMESTAMP & LOCATION
// =============================================
async function logButtonClick(buttonName) {
    const timestamp = new Date().toISOString();
    const localTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
    
    let location = null;
    
    try {
        location = await getCurrentLocationPromise(5000);
    } catch (e) {
        console.warn('Could not get location for button log:', e);
    }
    
    const lat = location ? location.latitude : 'N/A';
    const long = location ? location.longitude : 'N/A';
    
    switch(buttonName) {
        case 'pdf':
            buttonLogs.pdfClickTime = localTime;
            buttonLogs.pdfClickLat = lat;
            buttonLogs.pdfClickLong = long;
            break;
        case 'submit':
            buttonLogs.submitClickTime = localTime;
            buttonLogs.submitClickLat = lat;
            buttonLogs.submitClickLong = long;
            break;
        case 'capture':
            buttonLogs.captureClickTime = localTime;
            buttonLogs.captureClickLat = lat;
            buttonLogs.captureClickLong = long;
            break;
    }
    
    console.log(`📍 ${buttonName.toUpperCase()} Button Clicked:`, {
        time: localTime,
        lat: lat,
        long: long
    });
    
    return { timestamp: localTime, lat, long };
}

// =============================================
// CHECK IF ALL REQUIRED FIELDS ARE FILLED
// =============================================
function checkAllFieldsFilled() {
    // Required text fields
    const outletName = document.getElementById('outletName')?.value?.trim();
    const lapuNo = document.getElementById('lapuNo')?.value?.trim();
    const fseContact = document.getElementById('fseContact')?.value?.trim();
    const tsmContact = document.getElementById('tsmContact')?.value?.trim();
    
    // Tier must be selected
    const tierSelected = selectedTier !== null;
    
    // Validate phone number format
    const fseValid = fseContact && /^[6-9][0-9]{9}$/.test(fseContact);
    const tsmValid = tsmContact && /^[6-9][0-9]{9}$/.test(tsmContact);
    const lapuValid = lapuNo && lapuNo.length === 10;
    
    // Check all conditions
    const allFilled = !!(
        outletName && 
        outletName.length >= 2 &&
        lapuValid &&
        fseValid &&
        tsmValid &&
        tierSelected
    );
    
    return allFilled;
}

// =============================================
// UPDATE BUTTON STATES BASED ON FLOW
// =============================================
function updateButtonStates() {
    const pdfBtn = document.getElementById('pdfBtn');
    const submitBtn = document.getElementById('submitBtn');
    const captureBtn = document.getElementById('captureBtn');
    
    const allFieldsFilled = checkAllFieldsFilled();
    
    // Step 1: PDF button enabled when ALL fields are filled
    if (pdfBtn) {
        pdfBtn.disabled = !allFieldsFilled;
        
        if (allFieldsFilled && !isPdfDownloaded) {
            pdfBtn.classList.add('ready-pulse');
            pdfBtn.innerHTML = '📄 Download & Share PDF';
        } else if (isPdfDownloaded) {
            pdfBtn.classList.remove('ready-pulse');
            pdfBtn.innerHTML = '✅ PDF Downloaded';
        }
    }
    
    // Step 2: Submit button enabled ONLY AFTER PDF is downloaded
    if (submitBtn) {
        submitBtn.disabled = !isPdfDownloaded;
        
        if (isPdfDownloaded && !isFormSubmitted) {
            submitBtn.classList.add('ready-pulse');
            submitBtn.innerHTML = '📤 Submit Data';
        } else if (isFormSubmitted) {
            submitBtn.classList.remove('ready-pulse');
            submitBtn.innerHTML = '✅ Data Submitted';
        } else {
            submitBtn.classList.remove('ready-pulse');
            submitBtn.innerHTML = '🔒 Submit (Download PDF First)';
        }
    }
    
    // Step 3: Capture Photo enabled AFTER Submit
    if (captureBtn) {
        captureBtn.disabled = !isFormSubmitted;
        
        if (isFormSubmitted && !isPhotoCaptured) {
            captureBtn.classList.add('ready-pulse');
            captureBtn.innerHTML = '📸 Capture Photo';
        } else if (isPhotoCaptured) {
            captureBtn.classList.remove('ready-pulse');
            captureBtn.innerHTML = '✅ Photo Captured';
        } else {
            captureBtn.innerHTML = '🔒 Capture (Submit First)';
        }
    }
    
    // Update flow indicator
    updateFlowIndicator();
}

// =============================================
// FLOW INDICATOR UI
// =============================================
function updateFlowIndicator() {
    let flowIndicator = document.getElementById('flowIndicator');
    
    if (!flowIndicator) {
        flowIndicator = document.createElement('div');
        flowIndicator.id = 'flowIndicator';
        flowIndicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 12px;
            z-index: 9999;
            display: flex;
            gap: 15px;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;
        // document.body.appendChild(flowIndicator);
    }
    
    const allFieldsFilled = checkAllFieldsFilled();
    
    const step1 = allFieldsFilled ? '✅' : '⭕';
    const step2 = isPdfDownloaded ? '✅' : (allFieldsFilled ? '🔵' : '⭕');
    const step3 = isFormSubmitted ? '✅' : (isPdfDownloaded ? '🔵' : '⭕');
    const step4 = isPhotoCaptured ? '✅' : (isFormSubmitted ? '🔵' : '⭕');
    
    flowIndicator.innerHTML = `
        <span>${step1} Data</span>
        <span>→</span>
        <span>${step2} PDF</span>
        <span>→</span>
        <span>${step3} Submit</span>
        <span>→</span>
        <span>${step4} Photo</span>
    `;
}

// =============================================
// VALIDATION FUNCTIONS
// =============================================
function validateField(input) {
    const validationType = input.dataset.validation;
    const value = input.value.trim();
    const errorElement = document.getElementById(`${input.id}-error`);

    let isValid = true;
    let errorMessage = '';

    if (!value && input.hasAttribute('required')) {
        isValid = false;
        errorMessage = 'This field is required';
    } else if (value && validationType && validationRules[validationType]) {
        const rule = validationRules[validationType];

        if (rule.pattern && !rule.pattern.test(value)) {
            isValid = false;
            errorMessage = rule.message;
        }

        if (rule.exactLength && value.length !== rule.exactLength) {
            isValid = false;
            errorMessage = `Must be exactly ${rule.exactLength} digits`;
        }

        if (rule.minLength && value.length < rule.minLength) {
            isValid = false;
            errorMessage = `Minimum ${rule.minLength} characters required`;
        }
    }

    input.classList.remove('valid', 'invalid');
    if (value) {
        input.classList.add(isValid ? 'valid' : 'invalid');
    }

    if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.classList.toggle('show', !isValid && (value || input.hasAttribute('required')));
    }

    // Update button states when field changes
    updateButtonStates();

    return isValid;
}

function validateAllFields() {
    const requiredFields = [
        { id: 'outletName', label: 'Outlet Name' },
        { id: 'lapuNo', label: 'Outlet Lapu No' },
        { id: 'fseContact', label: 'FSE Contact No' },
        { id: 'tsmContact', label: 'TSM/SE Contact No' }
    ];

    const errors = [];
    let allValid = true;

    requiredFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (input) {
            const value = input.value.trim();
            const isValid = validateField(input);

            if (!isValid) {
                allValid = false;
                if (!value) {
                    errors.push(`${field.label} is required`);
                } else {
                    const validationType = input.dataset.validation;
                    if (validationType && validationRules[validationType]) {
                        errors.push(`${field.label}: ${validationRules[validationType].message}`);
                    }
                }
            }
        }
    });

    // Check tier selection
    if (!selectedTier) {
        allValid = false;
        errors.push('Please select a Tier (Platinum/Gold/Executive)');
    }

    const summary = document.getElementById('validationSummary');
    const errorList = document.getElementById('validationErrors');

    if (errors.length > 0 && summary && errorList) {
        errorList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
        summary.classList.add('show');
    } else if (summary) {
        summary.classList.remove('show');
    }

    return allValid;
}

// =============================================
// INPUT RESTRICTION FUNCTIONS
// =============================================
function restrictToAlphabets(input) {
    input.addEventListener('input', function (e) {
        const cursorPos = this.selectionStart;
        const oldValue = this.value;
        this.value = this.value.replace(/[^A-Za-z\s]/g, '');
        updateButtonStates();
    });

    input.addEventListener('keypress', function (e) {
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/[A-Za-z\s]/.test(char)) {
            e.preventDefault();
        }
    });

    input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleanedText = pastedText.replace(/[^A-Za-z\s]/g, '');
        document.execCommand('insertText', false, cleanedText);
        updateButtonStates();
    });
}

function restrictToNumbers(input) {
    const counterId = `${input.id}-counter`;
    const counterElement = document.getElementById(counterId);

    function updateCounter() {
        const length = input.value.length;
        if (counterElement) {
            counterElement.textContent = `${length}/10 digits`;
            counterElement.classList.remove('complete', 'error');
            if (length === 10) {
                counterElement.classList.add('complete');
            } else if (length > 0 && length < 10) {
                counterElement.classList.add('error');
            }
        }
    }

    input.addEventListener('input', function (e) {
        this.value = this.value.replace(/[^0-9]/g, '');

        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }

        updateCounter();
        updateButtonStates();

        if (this.value.length === 10) {
            validateField(this);
        }
    });

    input.addEventListener('keypress', function (e) {
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/[0-9]/.test(char)) {
            e.preventDefault();
            return;
        }
        if (this.value.length >= 10) {
            e.preventDefault();
        }
    });

    input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleanedText = pastedText.replace(/[^0-9]/g, '').slice(0, 10 - this.value.length);

        const start = this.selectionStart;
        const end = this.selectionEnd;
        const currentValue = this.value;
        const newValue = currentValue.slice(0, start) + cleanedText + currentValue.slice(end);
        this.value = newValue.slice(0, 10);

        updateCounter();
        updateButtonStates();
    });

    updateCounter();
}

// =============================================
// INITIALIZE VALIDATIONS
// =============================================
function initializeValidations() {
    const outletName = document.getElementById('outletName');
    if (outletName) {
        restrictToAlphabets(outletName);
        outletName.addEventListener('blur', () => validateField(outletName));
        outletName.addEventListener('input', () => {
            if (outletName.classList.contains('invalid')) {
                validateField(outletName);
            }
            updateButtonStates();
        });
    }

    const fseContact = document.getElementById('fseContact');
    if (fseContact) {
        restrictToNumbers(fseContact);
        fseContact.addEventListener('blur', () => validateField(fseContact));
        fseContact.addEventListener('input', () => {
            if (fseContact.classList.contains('invalid') || fseContact.value.length === 10) {
                validateField(fseContact);
            }
            updateButtonStates();
        });
    }

    const tsmContact = document.getElementById('tsmContact');
    if (tsmContact) {
        restrictToNumbers(tsmContact);
        tsmContact.addEventListener('blur', () => validateField(tsmContact));
        tsmContact.addEventListener('input', () => {
            if (tsmContact.classList.contains('invalid') || tsmContact.value.length === 10) {
                validateField(tsmContact);
            }
            updateButtonStates();
        });
    }

    const lapuNo = document.getElementById('lapuNo');
    if (lapuNo) {
        restrictToNumbers(lapuNo);
        lapuNo.addEventListener('blur', () => validateField(lapuNo));
        lapuNo.addEventListener('input', () => {
            if (lapuNo.classList.contains('invalid') || lapuNo.value.length === 10) {
                validateField(lapuNo);
            }
            updateButtonStates();
        });
    }
}

// =============================================
// TOAST NOTIFICATION
// =============================================
function showToast(message, type = 'info', duration = 5000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
}

// =============================================
// DEVICE DETECTION
// =============================================
function getDeviceInfo() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
    const isChrome = /Chrome/.test(ua) || /CriOS/.test(ua);
    const isIOSChrome = /CriOS/.test(ua);
    const isIOSSafari = isIOS && isSafari;

    let iOSVersion = 0;
    if (isIOS) {
        const match = ua.match(/OS (\d+)_/);
        if (match) {
            iOSVersion = parseInt(match[1], 10);
        }
    }

    return {
        isIOS,
        isAndroid,
        isSafari,
        isChrome,
        isIOSChrome,
        isIOSSafari,
        iOSVersion,
        isMobile: isIOS || isAndroid,
        userAgent: ua,
        supportsGeolocation: 'geolocation' in navigator
    };
}

// =============================================
// DISPLAY GPS INFO
// =============================================
function displayGPSInfo(gpsData, source) {
    const geoInfo = document.getElementById('geoInfo');
    const photoSection = document.getElementById('photoSection');

    if (!geoInfo) return;

    geoInfo.classList.remove('exif-source', 'device-source', 'no-source', 'ip-source');

    if (source === 'device' && gpsData) {
        geoLocation = `${gpsData.latitude}, ${gpsData.longitude}`;
        geoSource = gpsData.method || 'Device GPS';
        geoAccuracy = gpsData.accuracy || null;

        geoInfo.classList.add('device-source');

        geoInfo.innerHTML = `
            <strong>🛰️ GPS Location Captured:</strong>
            <span class="geo-badge device">GPS LOCKED ✓</span><br><br>
            <strong>Coordinates:</strong> ${geoLocation}<br>
            <strong>Accuracy:</strong> ±${gpsData.accuracy}<br>
            <strong>Time:</strong> ${new Date().toLocaleString('en-IN')}<br>
            <small>Precise location captured successfully</small>
        `;

    } else if (source === 'exif' && gpsData) {
        geoLocation = `${gpsData.latitude}, ${gpsData.longitude}`;
        geoSource = 'EXIF';
        geoAccuracy = null;
        geoInfo.classList.add('exif-source');

        geoInfo.innerHTML = `
            <strong>📍 GPS from Photo:</strong> 
            <span class="geo-badge exif">PHOTO EXIF ✓</span><br><br>
            <strong>Coordinates:</strong> ${geoLocation}<br>
            ${gpsData.altitude ? `<strong>Altitude:</strong> ${gpsData.altitude}<br>` : ''}
            <small>Location extracted from photo metadata</small>
        `;

    } else {
        geoLocation = null;
        geoSource = null;
        geoAccuracy = null;
        geoInfo.classList.add('no-source');

        geoInfo.innerHTML = `
            <strong>📍 Location:</strong>
            <span class="geo-badge none">NOT CAPTURED</span><br><br>
            <small>Location not captured.<br>
            <strong>Please ensure location permission is enabled.</strong></small>
        `;
    }

    geoInfo.style.display = 'block';
    if (photoSection) {
        photoSection.style.display = 'block';
    }
}

// =============================================
// EXIF EXTRACTION (Simplified)
// =============================================
function extractGPSFromImage(file) {
    return new Promise((resolve) => {
        const device = getDeviceInfo();
        
        if (device.isIOS) {
            resolve(null);
            return;
        }

        if (typeof EXIF !== 'undefined') {
            try {
                const img = document.createElement('img');
                const objectUrl = URL.createObjectURL(file);

                img.onload = function () {
                    EXIF.getData(img, function () {
                        const lat = EXIF.getTag(this, 'GPSLatitude');
                        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
                        const lon = EXIF.getTag(this, 'GPSLongitude');
                        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');

                        if (lat && lon && latRef && lonRef) {
                            const latitude = convertToDecimal(lat, latRef);
                            const longitude = convertToDecimal(lon, lonRef);
                            URL.revokeObjectURL(objectUrl);
                            resolve({
                                latitude: latitude.toFixed(6),
                                longitude: longitude.toFixed(6),
                                method: 'EXIF'
                            });
                        } else {
                            URL.revokeObjectURL(objectUrl);
                            resolve(null);
                        }
                    });
                };

                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(null);
                };

                img.src = objectUrl;
            } catch (e) {
                resolve(null);
            }
        } else {
            resolve(null);
        }
    });
}

function convertToDecimal(dmsArray, ref) {
    if (!dmsArray || dmsArray.length < 3) return 0;

    let degrees, minutes, seconds;

    if (typeof dmsArray[0] === 'object' && dmsArray[0].numerator !== undefined) {
        degrees = dmsArray[0].numerator / dmsArray[0].denominator;
        minutes = dmsArray[1].numerator / dmsArray[1].denominator;
        seconds = dmsArray[2].numerator / dmsArray[2].denominator;
    } else {
        degrees = parseFloat(dmsArray[0]) || 0;
        minutes = parseFloat(dmsArray[1]) || 0;
        seconds = parseFloat(dmsArray[2]) || 0;
    }

    let decimal = degrees + (minutes / 60) + (seconds / 3600);

    if (ref === 'S' || ref === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

// =============================================
// DEVICE SHARE CALCULATION
// =============================================
function calculateDeviceShare() {
    const airtelGross = parseFloat(document.getElementById('airtelGross')?.value) || 0;
    const jioMnp = parseFloat(document.getElementById('jioMnp')?.value) || 0;
    const jioDsr = parseFloat(document.getElementById('jioDsr')?.value) || 0;

    const jioTotal = jioMnp + jioDsr;
    const deviceShareInput = document.getElementById('deviceShare');

    if (!deviceShareInput) return;

    if (jioTotal === 0) {
        if (airtelGross > 0) {
            deviceShareInput.value = '∞ (No JIO)';
            deviceShareInput.style.color = '#4CAF50';
        } else {
            deviceShareInput.value = '';
            deviceShareInput.style.color = '#888';
        }
    } else {
        const deviceShare = airtelGross / jioTotal;

        if (deviceShare >= 1) {
            deviceShareInput.value = deviceShare.toFixed(2);
            deviceShareInput.style.color = '#4CAF50';
        } else if (deviceShare >= 0.5) {
            deviceShareInput.value = deviceShare.toFixed(2);
            deviceShareInput.style.color = '#ffc107';
        } else {
            deviceShareInput.value = deviceShare.toFixed(2);
            deviceShareInput.style.color = '#f44336';
        }
    }
}

// =============================================
// SLAB RATE FUNCTIONS
// =============================================
const SLAB_THRESHOLDS = [
    { min: 50, rate: 200, label: '50+', id: 'slab-50' },
    { min: 40, rate: 175, label: '40', id: 'slab-40' },
    { min: 30, rate: 150, label: '30', id: 'slab-30' },
    { min: 20, rate: 125, label: '20', id: 'slab-20' },
    { min: 10, rate: 75, label: '10', id: 'slab-10' }
];

function getSlabInfo(grossCount) {
    for (let i = 0; i < SLAB_THRESHOLDS.length; i++) {
        if (grossCount >= SLAB_THRESHOLDS[i].min) {
            const nextSlab = i > 0 ? SLAB_THRESHOLDS[i - 1] : null;
            return {
                rate: SLAB_THRESHOLDS[i].rate,
                label: SLAB_THRESHOLDS[i].label,
                id: SLAB_THRESHOLDS[i].id,
                nextSlab: nextSlab,
                neededForNext: nextSlab ? nextSlab.min - grossCount : 0,
                isMaxSlab: i === 0
            };
        }
    }

    return {
        rate: 0,
        label: 'Below 10',
        id: null,
        nextSlab: SLAB_THRESHOLDS[SLAB_THRESHOLDS.length - 1],
        neededForNext: 10 - grossCount,
        isMaxSlab: false
    };
}

function highlightActiveSlab(slabInfo) {
    const slabTable = document.getElementById('slabTable');
    if (!slabTable) return;

    const rows = slabTable.querySelectorAll('tr');
    rows.forEach(row => {
        row.classList.remove('active-slab', 'inactive-slab', 'next-slab');
    });

    SLAB_THRESHOLDS.forEach((slab) => {
        const row = document.getElementById(slab.id);
        if (!row) return;

        if (slab.id === slabInfo.id) {
            row.classList.add('active-slab');
        } else if (slabInfo.nextSlab && slab.id === slabInfo.nextSlab.id) {
            row.classList.add('next-slab');
        } else if (slab.rate > slabInfo.rate) {
            row.classList.add('inactive-slab');
        }
    });
}

function updateGrossRowStyling(slabInfo, mnpCount) {
    const grossRow = document.getElementById('grossRow');
    const slabBadge = document.getElementById('slabBadge');
    const slabLabel = document.getElementById('slabLabel');
    const slabProgress = document.getElementById('slabProgress');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');

    if (!grossRow) return;

    if (slabInfo.rate > 0) {
        grossRow.classList.add('has-slab');
        grossRow.classList.remove('no-slab');
        if (slabBadge) {
            slabBadge.classList.add('active');
            slabBadge.classList.remove('inactive');
            slabBadge.textContent = `₹${slabInfo.rate}/MNP`;
        }
    } else {
        grossRow.classList.remove('has-slab');
        grossRow.classList.add('no-slab');
        if (slabBadge) {
            slabBadge.classList.remove('active');
            slabBadge.classList.add('inactive');
            slabBadge.textContent = 'No Slab';
        }
    }

    if (slabLabel) {
        if (slabInfo.rate > 0) {
            slabLabel.innerHTML = `
                <strong>Slab ${slabInfo.label}</strong> → ₹${slabInfo.rate} × ${mnpCount} MNP = 
                <strong style="color: #4CAF50;">₹${(slabInfo.rate * mnpCount).toLocaleString('en-IN')}</strong>
            `;
        } else {
            slabLabel.textContent = 'Need minimum 10 Gross to unlock slab incentive';
        }
    }

    if (slabProgress && progressText && progressBar) {
        if (!slabInfo.isMaxSlab && slabInfo.nextSlab) {
            slabProgress.style.display = 'block';
            progressText.innerHTML = `<span style="color: #ffc107;">🎯 ${slabInfo.neededForNext} more for ₹${slabInfo.nextSlab.rate}/MNP slab</span>`;
            
            let progressPercent = 0;
            if (slabInfo.rate === 0) {
                progressPercent = (10 - slabInfo.neededForNext) / 10 * 100;
            } else {
                const currentMin = SLAB_THRESHOLDS.find(s => s.rate === slabInfo.rate).min;
                const nextMin = slabInfo.nextSlab.min;
                const range = nextMin - currentMin;
                const current = nextMin - slabInfo.neededForNext - currentMin;
                progressPercent = (current / range) * 100;
            }
            progressBar.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
        } else if (slabInfo.isMaxSlab) {
            slabProgress.style.display = 'block';
            progressText.innerHTML = `<span style="color: #4CAF50;">🏆 Maximum slab achieved!</span>`;
            progressBar.style.width = '100%';
        } else {
            slabProgress.style.display = 'none';
        }
    }
}

// =============================================
// MAIN CALCULATION FUNCTION
// =============================================
function calculateAll() {
    const dsrCount = parseInt(document.getElementById('dsrCount')?.value) || 0;
    const mnpCount = parseInt(document.getElementById('mnpCount')?.value) || 0;
    const wifiCount = parseInt(document.getElementById('wifiCount')?.value) || 0;
    const apbCount = parseInt(document.getElementById('apbCount')?.value) || 0;
    const simexCount = parseInt(document.getElementById('simexCount')?.value) || 0;
    const lapuTertiary = parseInt(document.getElementById('lapuTertiary')?.value) || 0;
    const mnpDays = parseInt(document.getElementById('mnpDays')?.value) || 0;
    const wifiDays = parseInt(document.getElementById('wifiDays')?.value) || 0;

    const dsrAmountEl = document.getElementById('dsrAmount');
    const mnpAmountEl = document.getElementById('mnpAmount');
    
    if (dsrAmountEl) dsrAmountEl.value = (dsrCount * 135).toLocaleString('en-IN');
    if (mnpAmountEl) mnpAmountEl.value = (mnpCount * 235).toLocaleString('en-IN');

    const grossCount = dsrCount + mnpCount;
    const slabInfo = getSlabInfo(grossCount);
    const grossCommitmentAmount = mnpCount * slabInfo.rate;

    const grossCountEl = document.getElementById('grossCount');
    const grossAmountEl = document.getElementById('grossAmount');
    
    if (grossCountEl) grossCountEl.value = grossCount;
    if (grossAmountEl) grossAmountEl.value = grossCommitmentAmount.toLocaleString('en-IN');

    highlightActiveSlab(slabInfo);
    updateGrossRowStyling(slabInfo, mnpCount);

    const tertiaryAmount = lapuTertiary * 0.039;
    const mnpDaysAmount = (lapuTertiary / 30 * 0.014) * mnpDays;
    const wifiDaysAmount = (lapuTertiary / 30 * 0.015) * wifiDays;
    
    const tertiaryAmountEl = document.getElementById('tertiaryAmount');
    const mnpDaysAmountEl = document.getElementById('mnpDaysAmount');
    const wifiDaysAmountEl = document.getElementById('wifiDaysAmount');
    
    if (tertiaryAmountEl) tertiaryAmountEl.value = tertiaryAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (mnpDaysAmountEl) mnpDaysAmountEl.value = mnpDaysAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (wifiDaysAmountEl) wifiDaysAmountEl.value = wifiDaysAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });

    const wifiAmountEl = document.getElementById('wifiAmount');
    const apbAmountEl = document.getElementById('apbAmount');
    const simexAmountEl = document.getElementById('simexAmount');
    
    if (wifiAmountEl) wifiAmountEl.value = (wifiCount * 150).toLocaleString('en-IN');
    if (apbAmountEl) apbAmountEl.value = (apbCount * 45).toLocaleString('en-IN');
    if (simexAmountEl) simexAmountEl.value = (simexCount * 50).toLocaleString('en-IN');

    const total = grossCommitmentAmount +
        (wifiCount * 150) +
        (apbCount * 45) +
        (simexCount * 50) +
        tertiaryAmount +
        mnpDaysAmount +
        wifiDaysAmount;

    const totalAmountEl = document.getElementById('totalAmount');
    if (totalAmountEl) {
        totalAmountEl.textContent = `Total Amount Rs. ${Math.round(total).toLocaleString('en-IN')}`;
    }
}

// =============================================
// CAMERA CAPTURE HANDLER
// =============================================
// CAMERA CAPTURE HANDLER
// =============================================
async function handleCameraCapture() {
    const device = getDeviceInfo();
    const loading = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingSubtext = document.getElementById('loadingSubtext');

    // LOG CAPTURE BUTTON CLICK
    await logButtonClick('capture');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'photoInput_' + Date.now();

    // Set capture attribute for mobile devices
    if (device.isMobile) {
        input.setAttribute('capture', 'environment');
    }

    input.style.cssText = 'display:none;';
    document.body.appendChild(input);

    input.addEventListener('change', async function handlePhotoChange() {
        if (!this.files || !this.files[0]) {
            if (input.parentNode) document.body.removeChild(input);
            return;
        }

        const file = this.files[0];
        originalFile = file;

        if (loading) loading.style.display = 'flex';
        if (loadingText) loadingText.textContent = '📍 Getting your location...';
        if (loadingSubtext) loadingSubtext.textContent = 'Please wait...';

        let locationData = null;
        try {
            locationData = await getCurrentLocationPromise(10000);
        } catch (e) {
            console.warn('Location error:', e);
        }

        if (loadingText) loadingText.textContent = '📸 Processing photo...';

        const reader = new FileReader();

        reader.onload = async function (e) {
            capturedPhoto = e.target.result;
            photoTimestamp = new Date().toLocaleString('en-IN');

            const photoPreview = document.getElementById('photoPreview');
            if (photoPreview) {
                photoPreview.src = capturedPhoto;
                photoPreview.style.display = 'block';
            }
            
            const photoSection = document.getElementById('photoSection');
            if (photoSection) photoSection.style.display = 'block';

            let exifGPS = null;
            if (!device.isIOS) {
                exifGPS = await extractGPSFromImage(file);
            }

            if (locationData) {
                displayGPSInfo(locationData, 'device');
            } else if (exifGPS) {
                displayGPSInfo(exifGPS, 'exif');
            } else {
                displayGPSInfo(null, null);
            }

            // Mark photo as captured
            isPhotoCaptured = true;
            updateButtonStates();

            if (loading) loading.style.display = 'none';

            showToast('✅ Photo captured successfully! Flow complete.', 'success', 4000);

            // SEND FINAL UPDATE TO GOOGLE SHEETS WITH ALL LOGS
            await sendFinalUpdate();

            if (input.parentNode) document.body.removeChild(input);
            input.removeEventListener('change', handlePhotoChange);
        };

        reader.onerror = function () {
            if (loading) loading.style.display = 'none';
            showToast('❌ Error reading image file', 'error');
            if (input.parentNode) document.body.removeChild(input);
            input.removeEventListener('change', handlePhotoChange);
        };

        reader.readAsDataURL(file);
    }, { once: true });

    // Trigger file input - use setTimeout for iOS compatibility
    setTimeout(() => {
        input.click();
    }, 100);
}

// =============================================
// SEND FINAL UPDATE WITH ALL BUTTON LOGS
// =============================================
async function sendFinalUpdate() {
    const formData = collectFormData();
    
    // Add button logs
    formData.pdfClickTime = buttonLogs.pdfClickTime || '';
    formData.pdfClickLat = buttonLogs.pdfClickLat || '';
    formData.pdfClickLong = buttonLogs.pdfClickLong || '';
    formData.submitClickTime = buttonLogs.submitClickTime || '';
    formData.submitClickLat = buttonLogs.submitClickLat || '';
    formData.submitClickLong = buttonLogs.submitClickLong || '';
    formData.captureClickTime = buttonLogs.captureClickTime || '';
    formData.captureClickLat = buttonLogs.captureClickLat || '';
    formData.captureClickLong = buttonLogs.captureClickLong || '';
    formData.updateType = 'FINAL_WITH_PHOTO';

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(formData)
        });
        console.log('✅ Final update sent with all button logs');
    } catch (e) {
        console.error('Error sending final update:', e);
    }
}

// =============================================
// COLLECT FORM DATA
// =============================================
function collectFormData() {
    let latitude = '';
    let longitude = '';
    if (geoLocation) {
        const coords = geoLocation.split(',');
        if (coords.length === 2) {
            latitude = coords[0].trim();
            longitude = coords[1].trim();
        }
    }

    return {
        outletName: document.getElementById('outletName')?.value || '',
        lapuNo: document.getElementById('lapuNo')?.value || '',
        fseContact: document.getElementById('fseContact')?.value || '',
        tsmContact: document.getElementById('tsmContact')?.value || '',
        dsrCount: document.getElementById('dsrCount')?.value || '0',
        dsrAmount: document.getElementById('dsrAmount')?.value || '0',
        mnpCount: document.getElementById('mnpCount')?.value || '0',
        mnpAmount: document.getElementById('mnpAmount')?.value || '0',
        grossCount: document.getElementById('grossCount')?.value || '0',
        grossAmount: document.getElementById('grossAmount')?.value || '0',
        lapuTertiary: document.getElementById('lapuTertiary')?.value || '0',
        tertiaryAmount: document.getElementById('tertiaryAmount')?.value || '0',
        mnpDays: document.getElementById('mnpDays')?.value || '0',
        mnpDaysAmount: document.getElementById('mnpDaysAmount')?.value || '0',
        wifiDays: document.getElementById('wifiDays')?.value || '0',
        wifiDaysAmount: document.getElementById('wifiDaysAmount')?.value || '0',
        wifiCount: document.getElementById('wifiCount')?.value || '0',
        wifiAmount: document.getElementById('wifiAmount')?.value || '0',
        apbCount: document.getElementById('apbCount')?.value || '0',
        apbAmount: document.getElementById('apbAmount')?.value || '0',
        simexCount: document.getElementById('simexCount')?.value || '0',
        simexAmount: document.getElementById('simexAmount')?.value || '0',
        totalAmount: document.getElementById('totalAmount')?.textContent?.replace('Total Amount Rs. ', '') || '0',
        tier: selectedTier || '',
        viMnp: document.getElementById('viMnp')?.value || '0',
        viDsr: document.getElementById('viDsr')?.value || '0',
        jioMnp: document.getElementById('jioMnp')?.value || '0',
        jioDsr: document.getElementById('jioDsr')?.value || '0',
        airtelGross: document.getElementById('airtelGross')?.value || '0',
        deviceShare: document.getElementById('deviceShare')?.value || 'N/A',
        latitude: latitude,
        longitude: longitude,
        geoLocation: geoLocation || '',
        geoSource: geoSource || '',
        geoAccuracy: geoAccuracy || '',
        photoTimestamp: photoTimestamp || '',
        photoBase64: capturedPhoto || '',
        userAgent: navigator.userAgent,
        submissionTime: new Date().toISOString()
    };
}

// =============================================
// DOMContentLoaded - INITIALIZATION
// =============================================
window.addEventListener('DOMContentLoaded', async () => {
    initializeValidations();
    calculateAll();
    calculateDeviceShare();
    updateButtonStates();

    const device = getDeviceInfo();
    console.log('Device Info:', device);

    // =============================================
    // TIER SELECTION
    // =============================================
    document.querySelectorAll('input[name="tier"]').forEach(radio => {
        radio.addEventListener('change', function () {
            selectedTier = this.value;
            document.body.classList.remove('tier-platinum', 'tier-gold', 'tier-executive');
            document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
            document.body.classList.add(`tier-${this.value}`);
            this.closest('.tier-btn').classList.add('active');
            updateButtonStates();
        });
    });

    // =============================================
    // INPUT LISTENERS - Main Calculation
    // =============================================
    ['dsrCount', 'mnpCount', 'wifiCount', 'apbCount', 'simexCount', 'lapuTertiary', 'mnpDays', 'wifiDays'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                calculateAll();
                updateButtonStates();
            });
        }
    });

    // =============================================
    // INPUT LISTENERS - Device Share
    // =============================================
    ['airtelGross', 'jioMnp', 'jioDsr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateDeviceShare);
    });

    // =============================================
    // PDF BUTTON - (After all fields filled)
    // =============================================
    const pdfBtn = document.getElementById('pdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', async function () {
            // Validate all fields first
            const isValid = validateAllFields();
            if (!isValid) {
                showToast('⚠️ Please fill all required fields correctly', 'warning');
                return;
            }

            // LOG PDF BUTTON CLICK - Record time & location
            await logButtonClick('pdf');
            
            showToast('📍 PDF download location recorded', 'info', 2000);

            // Generate PDF
            await generatePDF();

            // Mark PDF as downloaded
            isPdfDownloaded = true;
            updateButtonStates();

            showToast('✅ PDF Downloaded! Now click Submit to continue.', 'success', 4000);
        });
    }

    // =============================================
    // SUBMIT BUTTON - (Only after PDF is downloaded)
    // =============================================
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async function () {
            // Check if PDF was downloaded first
            if (!isPdfDownloaded) {
                showToast('⚠️ Please download PDF first!', 'warning');
                return;
            }

            // LOG SUBMIT BUTTON CLICK - Record time & location
            await logButtonClick('submit');

            const loading = document.getElementById('loadingOverlay');
            const loadingText = document.getElementById('loadingText');

            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Submitting...';
            if (loading) loading.style.display = 'flex';
            if (loadingText) loadingText.textContent = '📤 Submitting data to server...';

            try {
                const formData = collectFormData();
                
                // Add ALL button logs to submission
                formData.pdfClickTime = buttonLogs.pdfClickTime || '';
                formData.pdfClickLat = buttonLogs.pdfClickLat || '';
                formData.pdfClickLong = buttonLogs.pdfClickLong || '';
                formData.submitClickTime = buttonLogs.submitClickTime || '';
                formData.submitClickLat = buttonLogs.submitClickLat || '';
                formData.submitClickLong = buttonLogs.submitClickLong || '';
                formData.updateType = 'SUBMIT_DATA';

                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(formData)
                });

                isFormSubmitted = true;
                
                if (loading) loading.style.display = 'none';
                submitBtn.textContent = '✅ Data Submitted!';
                submitBtn.disabled = false;
                
                updateButtonStates();

                showToast('✅ Data submitted! Now capture photo.', 'success', 4000);

            } catch (error) {
                console.error('Submit error:', error);
                if (loading) loading.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Submit Data';
                showToast('❌ Error submitting. Please try again.', 'error');
            }
        });
    }

    // =============================================
    // CAPTURE BUTTON - (After Submit clicked)
    // =============================================
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!isFormSubmitted) {
                showToast('⚠️ Please submit the form first!', 'warning');
                return;
            }

            await handleCameraCapture();
        });
    }
});

// =============================================
// CLEAN PDF EXPORT - FIXED UNICODE ISSUES
// =============================================
document.getElementById('pdfBtn').addEventListener('click', async function () {

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2);

    // =============================================
    // TIER COLOR PALETTES
    // =============================================
    const tierPalettes = {
        platinum: {
            primary: [45, 52, 54],
            secondary: [99, 110, 114],
            accent: [189, 195, 199],
            headerBg: [30, 39, 46],
            text: [236, 240, 241],
            darkText: [44, 62, 80],
            borderColor: [180, 180, 180],
            badge: [108, 122, 137]
        },
        gold: {
            primary: [183, 149, 11],
            secondary: [243, 156, 18],
            accent: [241, 196, 15],
            headerBg: [94, 68, 0],
            text: [255, 248, 220],
            darkText: [92, 64, 0],
            borderColor: [200, 170, 100],
            badge: [218, 165, 32]
        },
        executive: {
            primary: [120, 15, 15],
            secondary: [192, 57, 43],
            accent: [231, 76, 60],
            headerBg: [65, 12, 12],
            text: [255, 245, 245],
            darkText: [69, 10, 10],
            borderColor: [180, 100, 100],
            badge: [155, 29, 29]
        },
        default: {
            primary: [44, 62, 80],
            secondary: [52, 73, 94],
            accent: [76, 175, 80],
            headerBg: [33, 47, 61],
            text: [255, 255, 255],
            darkText: [50, 50, 50],
            borderColor: [180, 180, 180],
            badge: [39, 174, 96]
        }
    };

    function getPalette() {
        if (selectedTier === 'platinum') return tierPalettes.platinum;
        if (selectedTier === 'gold') return tierPalettes.gold;
        if (selectedTier === 'executive') return tierPalettes.executive;
        return tierPalettes.default;
    }

    function getSignatureOwner() {
        if (selectedTier === 'platinum') return 'ZBM';
        if (selectedTier === 'gold') return 'ZSM';
        if (selectedTier === 'executive') return 'TSM';
        return 'FSE';
    }

    const palette = getPalette();
    let yPos = margin;

    // =============================================
    // TEXT CLEANING FUNCTION
    // =============================================
    function cleanText(text) {
        if (!text) return '';
        return text
            .replace(/₹/g, 'Rs.')
            .replace(/🎯/g, '>>')
            .replace(/🏆/g, '**')
            .replace(/→/g, '->')
            .replace(/×/g, 'x')
            .replace(/✓/g, '(OK)')
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // =============================================
    // HELPER FUNCTIONS
    // =============================================

    function addLuxuryHeader(title, subtitle) {
        pdf.setFillColor(...palette.headerBg);
        pdf.rect(0, 0, pageWidth, 20, 'F');

        pdf.setFillColor(...palette.accent);
        pdf.rect(0, 20, pageWidth, 1.2, 'F');

        pdf.setTextColor(...palette.text);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, pageWidth / 2, 9, { align: 'center' });

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(subtitle, pageWidth / 2, 15, { align: 'center' });

        if (selectedTier) {
            const badgeText = selectedTier.toUpperCase();
            const badgeWidth = 26;
            pdf.setFillColor(...palette.badge);
            pdf.roundedRect(pageWidth - margin - badgeWidth, 4, badgeWidth, 7, 1.5, 1.5, 'F');
            pdf.setTextColor(...palette.text);
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.text(badgeText, pageWidth - margin - badgeWidth / 2, 9, { align: 'center' });
        }

        return 25;
    }

    function addMiniHeader(title) {
        pdf.setFillColor(...palette.headerBg);
        pdf.rect(0, 0, pageWidth, 12, 'F');
        pdf.setFillColor(...palette.accent);
        pdf.rect(0, 12, pageWidth, 0.8, 'F');

        pdf.setTextColor(...palette.text);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, pageWidth / 2, 8, { align: 'center' });

        return 16;
    }

    function addSectionTitle(text, y) {
        const sectionHeight = 6;
        pdf.setFillColor(...palette.primary);
        pdf.rect(margin, y, contentWidth, sectionHeight, 'F');

        pdf.setFillColor(...palette.accent);
        pdf.rect(margin, y, 2.5, sectionHeight, 'F');

        pdf.setTextColor(...palette.text);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(text, margin + 6, y + 4.2);

        return y + sectionHeight + 0.5;
    }

    function addTableRow(label, value, y) {
        const rowHeight = 6;
        const labelWidth = contentWidth * 0.55;

        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');
        pdf.line(margin + labelWidth, y, margin + labelWidth, y + rowHeight);

        pdf.setTextColor(...palette.darkText);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(label), margin + 2, y + 4);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(value), margin + labelWidth + 2, y + 4);

        return y + rowHeight;
    }

    function addThreeColumnRow(col1, col2, col3, y, isHeader = false) {
        const rowHeight = 6;
        const colWidth = contentWidth / 3;

        if (isHeader) {
            pdf.setFillColor(...palette.secondary);
            pdf.setTextColor(...palette.text);
        } else {
            pdf.setFillColor(255, 255, 255);
            pdf.setTextColor(...palette.darkText);
        }
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');
        pdf.line(margin + colWidth, y, margin + colWidth, y + rowHeight);
        pdf.line(margin + colWidth * 2, y, margin + colWidth * 2, y + rowHeight);

        pdf.setFontSize(7);
        pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
        pdf.text(String(col1), margin + colWidth * 0.5, y + 4, { align: 'center' });
        pdf.text(String(col2), margin + colWidth * 1.5, y + 4, { align: 'center' });
        pdf.text(String(col3), margin + colWidth * 2.5, y + 4, { align: 'center' });

        return y + rowHeight;
    }

    function addFiveColumnRow(col1, col2, col3, col4, col5, y, isHeader = false) {
        const rowHeight = 6;
        const colWidth = contentWidth / 5;

        if (isHeader) {
            pdf.setFillColor(...palette.secondary);
            pdf.setTextColor(...palette.text);
        } else {
            pdf.setFillColor(255, 255, 255);
            pdf.setTextColor(...palette.darkText);
        }
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');
        for (let i = 1; i < 5; i++) {
            pdf.line(margin + colWidth * i, y, margin + colWidth * i, y + rowHeight);
        }

        pdf.setFontSize(6);
        pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
        pdf.text(String(col1), margin + colWidth * 0.5, y + 4, { align: 'center' });
        pdf.text(String(col2), margin + colWidth * 1.5, y + 4, { align: 'center' });
        pdf.text(String(col3), margin + colWidth * 2.5, y + 4, { align: 'center' });
        pdf.text(String(col4), margin + colWidth * 3.5, y + 4, { align: 'center' });
        pdf.text(String(col5), margin + colWidth * 4.5, y + 4, { align: 'center' });

        return y + rowHeight;
    }

    function addTotalBox(text, y) {
        const boxHeight = 10;

        pdf.setFillColor(...palette.primary);
        pdf.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F');

        pdf.setTextColor(...palette.text);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(cleanText(text).toUpperCase(), pageWidth / 2, y + 6.5, { align: 'center' });

        return y + boxHeight + 2;
    }

    function addHighlightRow(label, count, amount, y) {
        const rowHeight = 7;
        const colWidth = contentWidth / 3;

        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');
        pdf.line(margin + colWidth, y, margin + colWidth, y + rowHeight);
        pdf.line(margin + colWidth * 2, y, margin + colWidth * 2, y + rowHeight);

        pdf.setTextColor(...palette.darkText);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(label), margin + colWidth * 0.5, y + 4.8, { align: 'center' });
        pdf.text(String(count), margin + colWidth * 1.5, y + 4.8, { align: 'center' });
        pdf.text('Rs. ' + String(amount), margin + colWidth * 2.5, y + 4.8, { align: 'center' });

        return y + rowHeight;
    }

    // =============================================
    // SLAB TEXT ROW - CLEAN TEXT EXTRACTION
    // =============================================
    function addSlabTextRow(y) {
        const slabBadgeEl = document.getElementById('slabBadge');
        const slabLabelEl = document.getElementById('slabLabel');
        const progressTextEl = document.getElementById('progressText');

        let slabBadgeText = slabBadgeEl ? cleanText(slabBadgeEl.textContent) : '';
        let slabLabelText = slabLabelEl ? cleanText(slabLabelEl.textContent) : '';
        let progressText = progressTextEl ? cleanText(progressTextEl.textContent) : '';

        const hasProgress = progressText && progressText.length > 0;
        const rowHeight = hasProgress ? 11 : 7;

        // Background
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentWidth, rowHeight, 'F');

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');

        // Line 1: Badge + Label
        let textY = y + 4.5;
        pdf.setTextColor(...palette.darkText);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');

        const line1 = slabBadgeText + '  |  ' + slabLabelText;
        pdf.text(line1, margin + 3, textY);

        // Line 2: Progress text
        if (hasProgress) {
            textY += 4.5;
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(200, 120, 0);
            pdf.text(progressText, margin + 3, textY);
        }

        return y + rowHeight;
    }

    function addDeclarationWithCheckbox(y) {
        const boxHeight = 18;

        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, y, contentWidth, boxHeight, 'FD');

        const checkboxSize = 3.5;
        const checkboxX = margin + 3;
        const checkboxY = y + 4;

        pdf.setDrawColor(...palette.primary);
        pdf.setLineWidth(0.4);
        pdf.rect(checkboxX, checkboxY, checkboxSize, checkboxSize, 'S');

        pdf.setDrawColor(...palette.primary);
        pdf.setLineWidth(0.6);
        pdf.line(checkboxX + 0.7, checkboxY + 1.8, checkboxX + 1.4, checkboxY + 2.8);
        pdf.line(checkboxX + 1.4, checkboxY + 2.8, checkboxX + 2.8, checkboxY + 0.8);

        pdf.setTextColor(...palette.darkText);
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'normal');

        const declaration = 'I hereby confirm that all information provided above is accurate and complete. I agree to comply with the terms and conditions of the retailer enrollment program for the December 2025 period. I understand that any false information may result in disqualification from the program.';
        const textX = checkboxX + checkboxSize + 3;
        const maxWidth = contentWidth - (checkboxSize + 10);
        const splitDeclaration = pdf.splitTextToSize(declaration, maxWidth);
        pdf.text(splitDeclaration, textX, y + 6);

        return y + boxHeight + 2;
    }

    function addPageFooter(pageNum, totalPages) {
        const footerY = pageHeight - 10;

        pdf.setDrawColor(...palette.borderColor);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

        pdf.setFontSize(6);
        pdf.setTextColor(130, 130, 130);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Page ' + pageNum + ' of ' + totalPages, margin, footerY);
        pdf.text('Generated: ' + new Date().toLocaleString('en-IN'), pageWidth / 2, footerY, { align: 'center' });

        const docId = 'ENR-' + Date.now().toString(36).toUpperCase();
        pdf.text(docId, pageWidth - margin, footerY, { align: 'right' });
    }

    // =============================================
    // PAGE 1 - MAIN INFORMATION
    // =============================================

    yPos = addLuxuryHeader('RETAILER ENROLLMENT SHEET', 'December 2025');

    // SECTION 1: RETAILER INFORMATION
    yPos = addSectionTitle('RETAILER INFORMATION', yPos);

    const outletName = document.getElementById('outletName')?.value || '-';
    const lapuNo = document.getElementById('lapuNo')?.value || '-';
    const fseContact = document.getElementById('fseContact')?.value || '-';
    const tsmContact = document.getElementById('tsmContact')?.value || '-';

    yPos = addTableRow('Outlet Name', outletName, yPos);
    yPos = addTableRow('Lapu No', lapuNo, yPos);
    yPos = addTableRow('FSE Contact No', fseContact, yPos);
    yPos = addTableRow('TSM/SE Contact No', tsmContact, yPos);

    yPos += 2;

    // SECTION 2: COMPETITOR DATA
    yPos = addSectionTitle('COMPETITOR DATA', yPos);

    yPos = addFiveColumnRow('VI MNP', 'VI DSR', 'JIO MNP', 'JIO DSR', 'AIRTEL GROSS', yPos, true);

    const viMnp = document.getElementById('viMnp')?.value || '0';
    const viDsr = document.getElementById('viDsr')?.value || '0';
    const jioMnp = document.getElementById('jioMnp')?.value || '0';
    const jioDsr = document.getElementById('jioDsr')?.value || '0';
    const airtelGross = document.getElementById('airtelGross')?.value || '0';

    yPos = addFiveColumnRow(viMnp, viDsr, jioMnp, jioDsr, airtelGross, yPos);

    const deviceShare = document.getElementById('deviceShare')?.value || 'N/A';
    yPos = addTableRow('Device Share', deviceShare, yPos);

    // yPos += 2;

    // // SECTION 3: MARGIN SCHEME
    // yPos = addSectionTitle('MARGIN SCHEME', yPos);
    // yPos = addThreeColumnRow('Scheme', 'Margin', 'Gate', yPos, true);
    // yPos = addThreeColumnRow('Base Margins', '3.90%', '-', yPos);
    // yPos = addThreeColumnRow('MNP Participation', '1.40%', '1 MNP/Day', yPos);
    // yPos = addThreeColumnRow('WIFI Participation', '1.50%', '1 WIFI/Day', yPos);
    // yPos = addThreeColumnRow('TOTAL MARGIN', '6.80%', '-', yPos);

    yPos += 2;

    // SECTION 4: MARGIN CALCULATIONS
    yPos = addSectionTitle('MARGIN CALCULATIONS', yPos);
    yPos = addThreeColumnRow('Item', 'Value', 'Amount (Rs.)', yPos, true);

    const lapuTertiary = document.getElementById('lapuTertiary')?.value || '0';
    const tertiaryAmount = document.getElementById('tertiaryAmount')?.value || '0';
    const mnpDays = document.getElementById('mnpDays')?.value || '0';
    const mnpDaysAmount = document.getElementById('mnpDaysAmount')?.value || '0';
    const wifiDays = document.getElementById('wifiDays')?.value || '0';
    const wifiDaysAmount = document.getElementById('wifiDaysAmount')?.value || '0';

    yPos = addThreeColumnRow('Lapu Tertiary (3.9%)', lapuTertiary, tertiaryAmount, yPos);
    yPos = addThreeColumnRow('MNP Days (1.4%)', mnpDays, mnpDaysAmount, yPos);
    yPos = addThreeColumnRow('WiFi Days (1.5%)', wifiDays, wifiDaysAmount, yPos);

    yPos += 2;

    // SECTION 5: ADDITIONAL ITEMS
    yPos = addSectionTitle('ADDITIONAL ITEMS', yPos);
    yPos = addThreeColumnRow('Item', 'Count', 'Amount (Rs.)', yPos, true);

    const wifiCount = document.getElementById('wifiCount')?.value || '0';
    const wifiAmount = document.getElementById('wifiAmount')?.value || '0';
    const apbCount = document.getElementById('apbCount')?.value || '0';
    const apbAmount = document.getElementById('apbAmount')?.value || '0';
    const simexCount = document.getElementById('simexCount')?.value || '0';
    const simexAmount = document.getElementById('simexAmount')?.value || '0';

    yPos = addThreeColumnRow('WIFI (Rs.150)', wifiCount, wifiAmount, yPos);
    yPos = addThreeColumnRow('APB SBA (Rs.45)', apbCount, apbAmount, yPos);
    yPos = addThreeColumnRow('SIMEX (Rs.50)', simexCount, simexAmount, yPos);

    yPos += 2;

    // // SECTION 6: OTF RATES & CALCULATIONS
    // yPos = addSectionTitle('OTF RATES & CALCULATIONS', yPos);

    // yPos = addThreeColumnRow('FRC', 'DSR', 'MNP', yPos, true);
    // yPos = addThreeColumnRow('349', 'Rs.135', 'Rs.235', yPos);
    // yPos = addThreeColumnRow('449', 'Rs.135', 'Rs.235', yPos);

    // pdf.setFillColor(255, 255, 255);
    // pdf.rect(margin, yPos, contentWidth, 5, 'F');
    // pdf.setDrawColor(...palette.borderColor);
    // pdf.setLineWidth(0.15);
    // pdf.rect(margin, yPos, contentWidth, 5, 'S');
    // pdf.setTextColor(...palette.darkText);
    // pdf.setFontSize(6);
    // pdf.setFont('helvetica', 'bold');
    // pdf.text('SIMEX - Rs.50 Per SIMEX', pageWidth / 2, yPos + 3.3, { align: 'center' });
    // yPos += 6;

    // COMMISSION TABLE
    yPos = addThreeColumnRow('Item', 'Count', 'Amount (Rs.)', yPos, true);

    const dsrCount = document.getElementById('dsrCount')?.value || '0';
    const dsrAmount = document.getElementById('dsrAmount')?.value || '0';
    const mnpCount = document.getElementById('mnpCount')?.value || '0';
    const mnpAmount = document.getElementById('mnpAmount')?.value || '0';
    const grossCount = document.getElementById('grossCount')?.value || '0';
    const grossAmount = document.getElementById('grossAmount')?.value || '0';

    yPos = addThreeColumnRow('DSR OTF (Rs.135)', dsrCount, dsrAmount, yPos);
    yPos = addThreeColumnRow('MNP OTF (Rs.235)', mnpCount, mnpAmount, yPos);
    yPos = addHighlightRow('GROSS COMMITMENT', grossCount, grossAmount, yPos);

    // SLAB TEXT ROW
    // yPos = addSlabTextRow(yPos);

    yPos += 2;

    // COMMISSION TOTAL
    const totalText = document.getElementById('totalAmount')?.textContent || 'Total Amount Rs. 0';
    yPos = addTotalBox(totalText, yPos);

    addPageFooter(1, 2);

    // =============================================
    // PAGE 2 - DECLARATION & SIGNATURES
    // =============================================
    pdf.addPage();
    yPos = addMiniHeader('DECLARATION & AUTHORIZATION');

    yPos += 5;

    yPos = addSectionTitle('DECLARATION', yPos);
    yPos = addDeclarationWithCheckbox(yPos);

    yPos += 8;

    yPos = addSectionTitle('SIGNATURES', yPos);

    const sigBoxWidth = (contentWidth - 8) / 2;
    const sigBoxHeight = 40;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...palette.borderColor);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, yPos, sigBoxWidth, sigBoxHeight, 'FD');

    pdf.setTextColor(...palette.darkText);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RETAILER SIGNATURE', margin + 4, yPos + 6);

    pdf.setDrawColor(...palette.borderColor);
    pdf.setLineWidth(0.15);
    pdf.line(margin + 4, yPos + sigBoxHeight - 12, margin + sigBoxWidth - 4, yPos + sigBoxHeight - 12);

    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(130, 130, 130);
    pdf.text('Name:', margin + 4, yPos + sigBoxHeight - 7);
    pdf.text('Date:', margin + 4, yPos + sigBoxHeight - 3);

    const owner = getSignatureOwner();
    const ownerX = margin + sigBoxWidth + 8;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...palette.borderColor);
    pdf.setLineWidth(0.2);
    pdf.rect(ownerX, yPos, sigBoxWidth, sigBoxHeight, 'FD');

    pdf.setTextColor(...palette.darkText);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(owner + ' SIGNATURE', ownerX + 4, yPos + 6);

    pdf.setDrawColor(...palette.borderColor);
    pdf.setLineWidth(0.15);
    pdf.line(ownerX + 4, yPos + sigBoxHeight - 12, ownerX + sigBoxWidth - 4, yPos + sigBoxHeight - 12);

    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(130, 130, 130);
    pdf.text('Name:', ownerX + 4, yPos + sigBoxHeight - 7);
    pdf.text('Date:', ownerX + 4, yPos + sigBoxHeight - 3);

    yPos += sigBoxHeight + 10;

    if (selectedTier) {
        pdf.setTextColor(...palette.darkText);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.text(selectedTier.toUpperCase() + ' TIER ENROLLMENT', pageWidth - margin, yPos, { align: 'right' });
    }

    yPos += 8;

    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.25);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    pdf.setLineDashPattern([], 0);

    pdf.setFontSize(9);
    pdf.text('--', margin - 3, yPos + 1);

    addPageFooter(2, 2);

    // =============================================
    // SAVE & SHARE PDF
    // =============================================

    const outlet = document.getElementById('outletName')?.value || 'Retailer';
    const tierSuffix = selectedTier ? '_' + selectedTier.toUpperCase() : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Enrollment_${outlet.replace(/[^a-zA-Z0-9]/g, '_')}${tierSuffix}_${dateStr}.pdf`;

    const pdfBlob = pdf.output('blob');

    const fileURL = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = fileURL;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(fileURL);

    if (navigator.canShare && navigator.canShare({
        files: [new File([pdfBlob], filename, { type: 'application/pdf' })]
    })) {
        try {
            await navigator.share({
                title: 'Retailer Enrollment PDF',
                text: 'Please find the enrollment PDF attached.',
                files: [new File([pdfBlob], filename, { type: 'application/pdf' })]
            });
        } catch (err) {
            // User cancelled
        }
    }
});
// =============================================
// INJECT STYLES FOR BUTTON STATES
// =============================================
const style = document.createElement('style');
style.textContent = `
    .ready-pulse {
        animation: pulse 1.5s infinite;
        box-shadow: 0 0 20px rgba(76, 175, 80, 0.6);
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
    
    #pdfBtn:disabled,
    #submitBtn:disabled,
    #captureBtn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #ccc !important;
    }
    
    #flowIndicator {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        animation: slideDown 0.3s ease;
    }
    
    .toast.success { background: #4CAF50; }
    .toast.warning { background: #ff9800; }
    .toast.error { background: #f44336; }
    .toast.info { background: #2196F3; }
    
    @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);

window.addEventListener('DOMContentLoaded', async () => {
    initializeValidations();
    calculateAll();
    calculateDeviceShare();

    const device = getDeviceInfo();
    console.log('Device Info:', device);

    // Show initial location status
    displayGPSInfo(null, null);
});

// =============================================
// SWIFT APP INTEGRATION (iOS App Support)
// =============================================
; (function () {
    window.injectedLocation = null;

    window.swiftGPSReady = function (lat, lon, acc) {
        geoLocation = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`;
        geoSource = 'Swift Real GPS';
        geoAccuracy = `${Math.round(acc)}m`;

        const geoInfo = document.getElementById('geoInfo');
        geoInfo.innerHTML = `
                <strong>Real GPS Locked (via App)</strong><br>
                <span class="geo-badge device" style="background:#00C853;color:white;padding:4px 8px;border-radius:4px;font-size:11px;">SWIFT GPS ✓</span><br><br>
                <strong>Coordinates:</strong> ${geoLocation}<br>
                <strong>Accuracy:</strong> ±${geoAccuracy}<br>
                <small>100% accurate • Works on HTTP • Used by Airtel/Jio FSEs</small>
            `;
        geoInfo.classList.remove('no-source', 'ip-source');
        geoInfo.classList.add('device-source');
        geoInfo.style.display = 'block';
        document.getElementById('photoSection').style.display = 'block';
        showToast('Real GPS captured successfully!', 'success', 4000);
    };

    const check = setInterval(() => {
        if (window.injectedLocation) {
            clearInterval(check);
            window.swiftGPSReady(
                window.injectedLocation.latitude,
                window.injectedLocation.longitude,
                window.injectedLocation.accuracy
            );
        }
    }, 700);

    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.userAgent.includes('SwiftApp')) {
        setTimeout(() => {
            if (!window.injectedLocation && !geoLocation) {
                showToast('📍 Tap "Capture Photo" to get GPS + Photo', 'info', 5000);
            }
        }, 4000);
    }
})();