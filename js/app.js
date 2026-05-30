import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@1.2.9/dist/index.es.min.js";

// DOM elements
const welcomeScreen = document.getElementById("welcome-screen");
const welcomeDragZone = document.getElementById("welcome-drag-zone");
const welcomeFileInput = document.getElementById("welcome-file-input");

const canvas = document.getElementById("canvas");
const loader = document.getElementById("loader");
const loaderPercent = document.getElementById("loader-percent");
const loaderBar = document.getElementById("loader-bar");
const loaderStatus = document.getElementById("loader-status");

const uiPanel = document.querySelector(".ui-panel");
const infoFile = document.getElementById("info-file");
const infoCount = document.getElementById("info-count");
const infoSize = document.getElementById("info-size");

const inputY = document.getElementById("input-y");
const yVal = document.getElementById("y-val");
const inputRx = document.getElementById("input-rx");
const rxVal = document.getElementById("rx-val");
const inputRy = document.getElementById("input-ry");
const ryVal = document.getElementById("ry-val");
const inputRz = document.getElementById("input-rz");
const rzVal = document.getElementById("rz-val");
const btnCopyCode = document.getElementById("btn-copy-code");

const fileLoaderInput = document.getElementById("file-loader-input");
const toast = document.getElementById("toast");

const btnHidePanel = document.getElementById("btn-hide-panel");
const btnShowPanel = document.getElementById("btn-show-panel");

// UI State
let currentSplatObj = null;
let currentTarget = new SPLAT.Vector3(0, 0, 0);

// Helper to set vector components safely
function setVector(vec, x, y, z) {
    if (!vec) return;
    vec.x = x;
    vec.y = y;
    vec.z = z;
}

// Custom math helper: Convert degrees to Euler angles to Quaternion
function eulerToQuaternion(rxDeg, ryDeg, rzDeg) {
    const pitch = rxDeg * Math.PI / 180;
    const yaw = ryDeg * Math.PI / 180;
    const roll = rzDeg * Math.PI / 180;

    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    const w = cr * cp * cy + sr * sp * sy;
    const x = sr * cp * cy - cr * sp * sy;
    const y = cr * sp * cy + sr * cp * sy;
    const z = cr * cp * sy - sr * sp * cy;

    return new SPLAT.Quaternion(x, y, z, w);
}

// Initialize gsplat.js WebGL engine
const renderer = new SPLAT.WebGLRenderer(canvas);
const scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();

// Setup initial camera view
setVector(camera.position, 0, 0.5, 2.5); // Spawn in the front looking towards center

// Initialize OrbitControls (for pure circular inspection)
const orbitControls = new SPLAT.OrbitControls(camera, canvas);
orbitControls.setCameraTarget(currentTarget);
orbitControls.panSpeed = 0; // Lock panning to keep orbit target strictly centered

// Restrict zoom limits using correct gsplat.js properties to keep the camera inside the room
orbitControls.minZoom = 0.5; // Prevent zooming too close to focus point (50cm)
orbitControls.maxZoom = 2.5; // Prevent zooming out past the walls of the room (2.5m)

// Restrict vertical rotation (pitch in degrees) using correct gsplat.js properties
orbitControls.minAngle = -15; // Limit looking up from under the floor level
orbitControls.maxAngle = 75;  // Limit looking straight down to prevent flipping

orbitControls.update();

// Show Toast helper
function showToast(text) {
    toast.innerText = text;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Apply visual transformation adjustments
function updateSplatTransforms() {
    if (!currentSplatObj) return;

    const yPos = parseFloat(inputY.value);
    const rx = parseFloat(inputRx.value);
    const ry = parseFloat(inputRy.value);
    const rz = parseFloat(inputRz.value);

    // Update UI value labels
    yVal.innerText = yPos.toFixed(2) + "m";
    rxVal.innerText = rx + "°";
    ryVal.innerText = ry + "°";
    rzVal.innerText = rz + "°";

    // Apply to Splat
    currentSplatObj.position = new SPLAT.Vector3(0, yPos, 0);
    currentSplatObj.rotation = eulerToQuaternion(rx, ry, rz);
}

// Load Splat file function
async function loadSplatScene(url, fileName) {
    // Hide Welcome screen
    welcomeScreen.style.opacity = "0";
    welcomeScreen.style.pointerEvents = "none";

    // Show loader
    loader.style.opacity = "1";
    loader.style.pointerEvents = "all";
    loaderStatus.innerText = "Инициализация...";
    loaderStatus.style.color = "var(--text-primary)";
    loaderPercent.innerText = "0%";
    loaderBar.style.width = "0%";

    try {
        // Clear existing scenes if any
        scene.reset();
        currentSplatObj = null;

        infoFile.innerText = fileName;
        infoCount.innerText = "Подсчет...";
        infoSize.innerText = "Загрузка...";

        // Load splat async with progress
        await SPLAT.Loader.LoadAsync(url, scene, (progress) => {
            const percent = Math.round(progress * 100);
            loaderPercent.innerText = percent + "%";
            loaderBar.style.width = percent + "%";
            loaderStatus.innerText = `Загрузка: ${percent}%`;
        });

        // In gsplat.js, LoadAsync returns void and adds the loaded splat to scene.objects
        const splat = scene.objects[scene.objects.length - 1];
        currentSplatObj = splat;

        // Safe splat count resolution across different API versions
        let count = 0;
        if (splat) {
            if (typeof splat.splatCount === "number") {
                count = splat.splatCount;
            } else if (splat.splatData && typeof splat.splatData.splatCount === "number") {
                count = splat.splatData.splatCount;
            } else if (splat.splatData && splat.splatData.positions) {
                count = splat.splatData.positions.length / 3;
            } else if (splat.splatData && splat.splatData.position) {
                count = splat.splatData.position.length / 3;
            }
        }

        // Update scene info
        infoCount.innerText = count > 0 ? count.toLocaleString() : "Н/Д";
        
        // Estimate size (roughly) or show file name
        const estimatedBytes = count * 32;
        const mb = (estimatedBytes / (1024 * 1024)).toFixed(1);
        infoSize.innerText = mb > 1 ? `${mb} MB` : "Н/Д";

        // Reset transformations values
        inputY.value = "0.0";
        inputRx.value = "0";
        inputRy.value = "0";
        inputRz.value = "0";
        updateSplatTransforms();
        forceRenderFrames = 60; // Force render for the first 60 frames to display scene properly

        // Reset camera to preset 1
        setVector(camera.position, 0, 0.5, 2.5);
        currentTarget = new SPLAT.Vector3(0, 0, 0);
        orbitControls.setCameraTarget(currentTarget);
        orbitControls.update();

        // Fade out loader
        setTimeout(() => {
            loader.style.opacity = "0";
            loader.style.pointerEvents = "none";
            
            // Show main UI panel and reset collapsed states
            uiPanel.classList.remove("collapsed");
            btnShowPanel.classList.remove("visible");
            uiPanel.style.opacity = "1";
            uiPanel.style.pointerEvents = "all";
        }, 400);

        showToast("Сцена успешно загружена!");

    } catch (err) {
        console.error("Error loading splat scene:", err);
        loaderStatus.innerText = "Ошибка загрузки: " + err.message;
        loaderStatus.style.color = "var(--danger-color)";
        showToast("Не удалось загрузить splat-файл!");
        
        // Bring back welcome screen
        setTimeout(() => {
            loader.style.opacity = "0";
            loader.style.pointerEvents = "none";
            welcomeScreen.style.opacity = "1";
            welcomeScreen.style.pointerEvents = "all";
        }, 2200);
    }
}

// Smart on-demand (dirty) rendering to keep GPU load at 0% when idle!
let lastCamPos = { x: 0, y: 0, z: 0 };
let lastCamRot = { x: 0, y: 0, z: 0, w: 0 };
let lastSplatPos = { x: 0, y: 0, z: 0 };
let lastSplatRot = { x: 0, y: 0, z: 0, w: 0 };
let forceRenderFrames = 60;

// Render loop
const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    forceRenderFrames = 10; // Force rendering on resize
};

const frame = () => {
    orbitControls.update();
    
    // Check if camera moved
    const camMoved = 
        camera.position.x !== lastCamPos.x || 
        camera.position.y !== lastCamPos.y || 
        camera.position.z !== lastCamPos.z ||
        camera.rotation.x !== lastCamRot.x ||
        camera.rotation.y !== lastCamRot.y ||
        camera.rotation.z !== lastCamRot.z ||
        camera.rotation.w !== lastCamRot.w;
        
    // Check if splat aligned values changed
    let splatMoved = false;
    if (currentSplatObj) {
        splatMoved = 
            currentSplatObj.position.x !== lastSplatPos.x || 
            currentSplatObj.position.y !== lastSplatPos.y || 
            currentSplatObj.position.z !== lastSplatPos.z ||
            currentSplatObj.rotation.x !== lastSplatRot.x ||
            currentSplatObj.rotation.y !== lastSplatRot.y ||
            currentSplatObj.rotation.z !== lastSplatRot.z ||
            currentSplatObj.rotation.w !== lastSplatRot.w;
    }
    
    // Render on demand: only if camera/splat moved or we are forcing frames
    if (camMoved || splatMoved || forceRenderFrames > 0) {
        renderer.render(scene, camera);
        
        // Save last state
        lastCamPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        lastCamRot = { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z, w: camera.rotation.w };
        
        if (currentSplatObj) {
            lastSplatPos = { x: currentSplatObj.position.x, y: currentSplatObj.position.y, z: currentSplatObj.position.z };
            lastSplatRot = { x: currentSplatObj.rotation.x, y: currentSplatObj.rotation.y, z: currentSplatObj.rotation.z, w: currentSplatObj.rotation.w };
        }
        
        if (forceRenderFrames > 0) forceRenderFrames--;
    }
    
    requestAnimationFrame(frame);
};

// Initialize resize listeners & render frame
window.addEventListener("resize", handleResize);
handleResize();
requestAnimationFrame(frame);

// --- Welcome Drag Zone listeners ---

// Drag zone click triggers hidden input
welcomeDragZone.addEventListener("click", () => {
    welcomeFileInput.click();
});

welcomeFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    loadSplatScene(objectUrl, file.name);
});

// Drag & Drop events
welcomeDragZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    welcomeDragZone.classList.add("dragover");
});

welcomeDragZone.addEventListener("dragleave", () => {
    welcomeDragZone.classList.remove("dragover");
});

welcomeDragZone.addEventListener("drop", (e) => {
    e.preventDefault();
    welcomeDragZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    loadSplatScene(objectUrl, file.name);
});


// --- Control Panel Hide/Show toggles ---
btnHidePanel.addEventListener("click", () => {
    uiPanel.classList.add("collapsed");
    btnShowPanel.classList.add("visible");
    forceRenderFrames = 10; // Trigger redraw when panel layout updates
});

btnShowPanel.addEventListener("click", () => {
    uiPanel.classList.remove("collapsed");
    btnShowPanel.classList.remove("visible");
    forceRenderFrames = 10; // Trigger redraw when panel layout updates
});

// --- Control Panel listeners ---

// Sidebar file loader input change
fileLoaderInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    loadSplatScene(objectUrl, file.name);
});

// Transformation adjustments (Y-height and rotations)
inputY.addEventListener("input", updateSplatTransforms);
inputRx.addEventListener("input", updateSplatTransforms);
inputRy.addEventListener("input", updateSplatTransforms);
inputRz.addEventListener("input", updateSplatTransforms);

// Copy Alignment parameters helper
btnCopyCode.addEventListener("click", () => {
    const y = parseFloat(inputY.value);
    const rx = parseFloat(inputRx.value);
    const ry = parseFloat(inputRy.value);
    const rz = parseFloat(inputRz.value);

    const codeSnippet = `// Код для вставки в инициализацию splat-сцены:
splat.position = new SPLAT.Vector3(0, ${y.toFixed(2)}, 0);
splat.rotation = eulerToQuaternion(${rx}, ${ry}, ${rz});`;

    navigator.clipboard.writeText(codeSnippet).then(() => {
        showToast("Код выравнивания скопирован!");
    }).catch(err => {
        console.error("Clipboard error:", err);
        showToast("Не удалось скопировать!");
    });
});



// --- Query Parameter Auto-Load ---
// E.g. https://yourdomain.com/?file=home_ultra.splat
const urlParams = new URLSearchParams(window.location.search);
const fileParam = urlParams.get("file");
if (fileParam) {
    loadSplatScene(fileParam, fileParam.split('/').pop());
}
