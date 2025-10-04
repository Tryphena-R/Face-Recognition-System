const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusDiv = document.getElementById('status');
const recognizeButton = document.getElementById('recognizeButton');
const cameraToggleButton = document.getElementById('cameraToggleButton');
const loader = document.getElementById('loader');
// New image upload elements
const imageUpload = document.getElementById('imageUpload');
const uploadButton = document.getElementById('uploadButton');
const uploadedImage = document.getElementById('uploadedImage');
const backToCameraButton = document.getElementById('backToCameraButton');
// Sidebar elements
const nameInput = document.getElementById('nameInput');
const enrollFromCameraButton = document.getElementById('enrollFromCameraButton');
const enrollFromImageButton = document.getElementById('enrollFromImageButton');
const enrollImageUpload = document.getElementById('enrollImageUpload');
const enrolledList = document.getElementById('enrolledList');
const clearAllButton = document.getElementById('clearAllButton');
// Modal elements
const confirmationModal = document.getElementById('confirmationModal');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

const cameraOnIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
const cameraOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
const FACE_DB_KEY = 'faceRecognitionDB';
let confirmAction = null;

let isRecognizing = false;
let recognitionTimeoutId = null;
let faceMatcher = null;
let cameraStream = null;
let currentMode = 'camera'; // 'camera' or 'image'

// --- DATABASE HELPERS ---
function getFaceDB() { return JSON.parse(localStorage.getItem(FACE_DB_KEY)) || []; }
function saveFaceDB(db) { localStorage.setItem(FACE_DB_KEY, JSON.stringify(db)); }

// --- SIDEBAR & UI MANAGEMENT ---
function renderSidebar() {
    const db = getFaceDB();
    enrolledList.innerHTML = '';
    if (db.length === 0) {
        enrolledList.innerHTML = '<li class="text-gray-500 text-sm p-2">No faces enrolled yet.</li>';
    } else {
        db.forEach(person => {
            const listItem = document.createElement('li');
            listItem.className = 'flex items-center justify-between bg-[#3b3837] p-2 rounded-md';
            listItem.innerHTML = `
                <span class="text-[#e0e2db]">${person.name}</span>
                <div class="flex items-center space-x-2">
                    <button data-name="${person.name}" class="rename-btn text-[#e6af2e] hover:text-[#cca029]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button data-name="${person.name}" class="delete-btn text-red-500 hover:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            `;
            enrolledList.appendChild(listItem);
        });
    }
    document.querySelectorAll('.rename-btn').forEach(b => b.addEventListener('click', handleRenameStart));
    document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', handleDelete));
    updateButtonStates();
}

function updateButtonStates() {
    const db = getFaceDB();
    const isCameraOn = cameraStream !== null;
    const hasName = nameInput.value.trim() !== '';
    
    enrollFromCameraButton.disabled = !isCameraOn || !hasName || currentMode === 'image';
    enrollFromImageButton.disabled = !hasName;
    
    recognizeButton.disabled = (!isCameraOn && currentMode === 'camera') || db.length === 0;
    uploadButton.disabled = db.length === 0;
    clearAllButton.disabled = db.length === 0;

    if (currentMode === 'image') {
        recognizeButton.classList.add('hidden');
        backToCameraButton.classList.remove('hidden');
        cameraToggleButton.classList.add('hidden');
    } else {
        recognizeButton.classList.remove('hidden');
        backToCameraButton.classList.add('hidden');
        cameraToggleButton.classList.remove('hidden');
    }
}

nameInput.addEventListener('input', updateButtonStates);

// --- MODELS & CAMERA ---
async function loadModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    statusDiv.textContent = 'Loading core models...';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    statusDiv.textContent = 'Models loaded successfully!';
    loader.style.display = 'none';
}
async function startCamera() {
    if (cameraStream) return;
    try {
        statusDiv.textContent = 'Starting camera...';
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        cameraStream = stream;
        video.srcObject = stream;
        cameraToggleButton.innerHTML = cameraOnIcon;
    } catch (err) {
        console.error("Camera Error:", err);
        statusDiv.textContent = 'Error: Could not access the camera.';
        cameraToggleButton.innerHTML = cameraOffIcon;
    }
}
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        cameraStream = null;
        if (isRecognizing) stopRecognition();
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        statusDiv.textContent = 'Camera is off.';
        cameraToggleButton.innerHTML = cameraOffIcon;
        updateButtonStates();
    }
}
cameraToggleButton.addEventListener('click', () => { cameraStream ? stopCamera() : startCamera(); });
video.addEventListener('play', () => {
    statusDiv.textContent = 'Camera started.';
    faceapi.matchDimensions(canvas, video);
    loadMatcher();
    updateButtonStates();
});

// --- CORE FACE LOGIC ---
async function loadMatcher() {
    const db = getFaceDB();
    if (db.length === 0) {
        faceMatcher = null;
    } else {
        const labeledDescriptors = await Promise.all(db.map(person => {
            const descriptor = new Float32Array(person.descriptor);
            return new faceapi.LabeledFaceDescriptors(person.name, [descriptor]);
        }));
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
    }
    renderSidebar();
}

enrollFromCameraButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const db = getFaceDB();
    if (db.find(p => p.name === name)) {
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Name "${name}" already exists.</span>`;
        return;
    }

    statusDiv.innerHTML = `Detecting face from camera...`;
    const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        statusDiv.innerHTML = `<span class="text-red-500">No face detected from camera.</span>`;
        return;
    }

    db.push({ name: name, descriptor: Array.from(detection.descriptor) });
    saveFaceDB(db);
    statusDiv.innerHTML = `<span class="text-[#e6af2e]">Enrolled ${name}!</span>`;
    nameInput.value = '';
    loadMatcher();
});

enrollFromImageButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
        if (!name) {
            statusDiv.innerHTML = '<span class="text-red-500">Please enter a name first.</span>';
            return;
        }
    const db = getFaceDB();
    if (db.find(p => p.name === name)) {
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Name "${name}" already exists.</span>`;
        return;
    }
    enrollImageUpload.click();
});

enrollImageUpload.addEventListener('change', async (event) => {
    if (!event.target.files || !event.target.files[0]) {
        return;
    }
    
    const name = nameInput.value.trim();
    if (!name) return;
    
    const db = getFaceDB();
    if (db.find(p => p.name === name)) return;

    const file = event.target.files[0];
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = async () => {
        statusDiv.innerHTML = `Analyzing image for enrollment...`;
        const detections = await faceapi
            .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        URL.revokeObjectURL(image.src);

        if (detections.length === 0) {
            statusDiv.innerHTML = `<span class="text-red-500">No face detected in the uploaded image.</span>`;
            return;
        }
        if (detections.length > 1) {
            statusDiv.innerHTML = `<span class="text-[#e6af2e]">Multiple faces detected. Please upload an image with only one person.</span>`;
            return;
        }

        db.push({ name: name, descriptor: Array.from(detections[0].descriptor) });
        saveFaceDB(db);
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Enrolled ${name} from image!</span>`;
        nameInput.value = '';
        loadMatcher();
    };
    image.onerror = () => {
        statusDiv.innerHTML = `<span class="text-red-500">Could not load the selected image.</span>`;
        URL.revokeObjectURL(image.src);
    };
    image.src = imageUrl;
    event.target.value = '';
});


// --- RENAME AND DELETE LOGIC ---
function handleRenameStart(event) {
    renderSidebar(); 
    const nameToEdit = event.currentTarget.getAttribute('data-name');
    const listItem = Array.from(enrolledList.querySelectorAll('li')).find(li => li.querySelector(`[data-name="${nameToEdit}"]`));
    if (!listItem) return;

    const nameSpan = listItem.querySelector('span');
    const actionButtonsDiv = listItem.querySelector('div');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = nameToEdit;
    input.className = 'flex-grow bg-[#5c5857] text-[#e0e2db] rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-[#e6af2e] focus:outline-none';

    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    saveBtn.className = 'text-green-400 hover:text-green-300';
    saveBtn.onclick = () => handleSaveRename(nameToEdit, input);

    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    cancelBtn.className = 'text-gray-400 hover:text-gray-300';
    cancelBtn.onclick = () => renderSidebar();

    const editContainer = document.createElement('div');
    editContainer.className = 'flex items-center w-full space-x-2';
    editContainer.appendChild(input);
    editContainer.appendChild(saveBtn);
    editContainer.appendChild(cancelBtn);

    nameSpan.replaceWith(editContainer);
    actionButtonsDiv.remove();
    input.focus();
    input.select();
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSaveRename(nameToEdit, input);
        if (e.key === 'Escape') renderSidebar();
    });
}
function handleSaveRename(oldName, inputElement) {
    const newName = inputElement.value.trim();
    if (!newName) {
        statusDiv.innerHTML = '<span class="text-red-500">Name cannot be empty.</span>';
        return;
    }
    if (newName === oldName) {
        renderSidebar();
        return;
    }
    let db = getFaceDB();
    if (db.some(p => p.name === newName)) {
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Name "${newName}" already exists.</span>`;
        return;
    }
    const person = db.find(p => p.name === oldName);
    if (person) {
        person.name = newName;
        saveFaceDB(db);
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Renamed "${oldName}" to "${newName}".</span>`;
        loadMatcher();
    }
}
function handleDelete(event) {
    const nameToDelete = event.currentTarget.getAttribute('data-name');
    showConfirmationModal(`Delete "${nameToDelete}"? This cannot be undone.`, () => {
        let db = getFaceDB();
        db = db.filter(p => p.name !== nameToDelete);
        saveFaceDB(db);
        statusDiv.innerHTML = `<span class="text-[#e6af2e]">Deleted ${nameToDelete}.</span>`;
        loadMatcher();
    });
}
clearAllButton.addEventListener('click', () => {
    showConfirmationModal('Are you sure you want to delete all enrolled faces?', () => {
        saveFaceDB([]);
        if (isRecognizing) stopRecognition();
        statusDiv.innerHTML = '<span class="text-red-500">All faces have been cleared.</span>';
        loadMatcher();
    });
});

// --- IMAGE UPLOAD AND RECOGNITION LOGIC ---
uploadButton.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', async (event) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        
        uploadedImage.onload = async () => {
            switchToImageMode();
            await recognizeFacesInImage(uploadedImage); 
            URL.revokeObjectURL(uploadedImage.src);
        };
        uploadedImage.src = imageUrl;
    }
});

function switchToImageMode() {
    currentMode = 'image';
    video.classList.add('hidden');
    uploadedImage.classList.remove('hidden');
    if (isRecognizing) stopRecognition();
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    updateButtonStates();
}

function switchToCameraMode() {
    currentMode = 'camera';
    video.classList.remove('hidden');
    uploadedImage.classList.add('hidden');
    uploadedImage.src = '';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    statusDiv.textContent = 'Switched back to camera mode.';
    updateButtonStates();
}

backToCameraButton.addEventListener('click', switchToCameraMode);

async function recognizeFacesInImage(imageElement) {
    statusDiv.textContent = 'Analyzing image...';
    const container = document.getElementById('camera-container');
    const ctx = canvas.getContext('2d');

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvas.style.transform = 'scaleX(1)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { naturalWidth, naturalHeight } = imageElement;
    const scale = Math.min(canvas.width / naturalWidth, canvas.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const xOffset = (canvas.width - renderedWidth) / 2;
    const yOffset = (canvas.height - renderedHeight) / 2;
    
    const displaySize = { width: naturalWidth, height: naturalHeight };

    const detections = await faceapi
        .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptors();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    if (resizedDetections.length > 0 && faceMatcher) {
        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
        let recognizedCount = 0;
        results.forEach((result, i) => {
            if (result.label !== 'unknown') recognizedCount++;
            
            const box = resizedDetections[i].detection.box;
            
            const scaledBox = new faceapi.Box({
                x: box.x * scale + xOffset,
                y: box.y * scale + yOffset,
                width: box.width * scale,
                height: box.height * scale
            });
            
            const drawOptions = {
                label: result.toString(),
                boxColor: '#e6af2e',
                textColor: '#191716'
            };
            const drawBox = new faceapi.draw.DrawBox(scaledBox, drawOptions);
            drawBox.draw(canvas);
        });
        statusDiv.innerHTML = recognizedCount > 0 ?
            `<span class="text-[#e6af2e]">Found ${recognizedCount} known person(s) in the image.</span>` :
            '<span class="text-[#e6af2e]">No known faces found in the image.</span>';
    } else {
        statusDiv.textContent = 'No faces detected in the image.';
    }
}


// --- RECOGNITION LOOP (FOR VIDEO) ---
const recognitionLoop = async () => {
    if (!isRecognizing || video.paused || video.ended || video.readyState < 3) {
        if (recognitionTimeoutId) clearTimeout(recognitionTimeoutId);
        return;
    }
    try {
        canvas.style.transform = 'scaleX(-1)'; 
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks().withFaceDescriptors();

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const resized = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length > 0 && faceMatcher) {
            const results = resized.map(d => faceMatcher.findBestMatch(d.descriptor));
            let recognizedCount = 0;
            results.forEach((result, i) => {
                if (result.label !== 'unknown') recognizedCount++;
                const box = resized[i].detection.box;
                const label = result.toString();
                ctx.strokeStyle = '#e6af2e';
                ctx.lineWidth = 2;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                const font = '16px sans-serif';
                ctx.font = font;
                const padding = 5;
                const textMetrics = ctx.measureText(label);
                const textHeight = 16;
                const textBgY = box.y > (textHeight + padding * 2) ?
                    box.y - (textHeight + padding * 2) :
                    box.y + box.height;
                ctx.fillStyle = '#e6af2e';
                ctx.fillRect(box.x, textBgY, textMetrics.width + padding * 2, textHeight + padding * 2);
                ctx.save();
                const textX = box.x + padding;
                const textY = textBgY + padding + (textHeight / 2);
                const textCenterX = textX + textMetrics.width / 2;
                ctx.translate(textCenterX, 0);
                ctx.scale(-1, 1);
                ctx.translate(-textCenterX, 0);
                ctx.fillStyle = '#191716';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, textX, textY);
                ctx.restore();
            });
            statusDiv.innerHTML = recognizedCount > 0 ?
                `<span class="text-[#e6af2e]">Recognized ${recognizedCount} person(s).</span>` :
                '<span class="text-gray-500">Searching for known faces...</span>';
        } else {
            statusDiv.textContent = 'No faces detected.';
        }
    } catch (err) {
        console.error("Recognition Error:", err);
        statusDiv.innerHTML = '<span class="text-red-500">Recognition error.</span>';
        stopRecognition();
    }
    recognitionTimeoutId = setTimeout(recognitionLoop, 200);
};

function startRecognition() {
    if (getFaceDB().length === 0) {
        statusDiv.innerHTML = '<span class="text-red-500">No faces enrolled to recognize.</span>';
        return;
    }
    isRecognizing = true;
    recognizeButton.textContent = 'Stop Recognition';
    recognizeButton.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-[#e0e2db]');
    recognizeButton.classList.add('bg-[#e6af2e]', 'hover:bg-[#cca029]', 'focus:ring-[#e6af2e]', 'text-[#191716]');
    statusDiv.textContent = 'Starting recognition...';
    recognitionLoop();
}

function stopRecognition() {
    isRecognizing = false;
    if (recognitionTimeoutId) clearTimeout(recognitionTimeoutId);
    recognizeButton.textContent = 'Start Recognition';
    recognizeButton.classList.remove('bg-[#e6af2e]', 'hover:bg-[#cca029]', 'focus:ring-[#e6af2e]', 'text-[#191716]');
    recognizeButton.classList.add('bg-green-600', 'hover:bg-green-700', 'text-[#e0e2db]');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    statusDiv.textContent = 'Recognition stopped.';
}

recognizeButton.addEventListener('click', () => {
    isRecognizing ? stopRecognition() : startRecognition();
});

// --- MODAL LOGIC ---
function showConfirmationModal(message, onConfirm) {
    modalMessage.textContent = message;
    confirmAction = onConfirm;
    confirmationModal.classList.remove('hidden');
}
modalConfirmBtn.addEventListener('click', () => {
    if (confirmAction) confirmAction();
    confirmationModal.classList.add('hidden');
});
modalCancelBtn.addEventListener('click', () => {
    confirmationModal.classList.add('hidden');
});

// --- INIT ---
(async () => {
    await loadModels();
    renderSidebar();
    cameraToggleButton.innerHTML = cameraOffIcon; 
    statusDiv.textContent = 'Ready. Press the camera icon to start.';
    updateButtonStates();
})();