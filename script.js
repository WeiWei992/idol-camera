document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const idolOverlay = document.getElementById('idol-overlay');
    const captureBtn = document.getElementById('capture-btn');
    const idolUpload = document.getElementById('idol-upload');
    const switchCamBtn = document.getElementById('switch-cam-btn');
    const sizeSlider = document.getElementById('size-slider');
    const viewport = document.getElementById('viewport');

    let currentStream = null;
    let facingMode = 'user';

    // State for drag and resize
    let state = {
        x: 0,
        y: 0,
        scale: 0.8, // 80% of viewport height initially
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        initialLeft: 0,
        initialTop: 0
    };

    // Initialize Camera
    async function initCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            currentStream = stream;
            video.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please allow camera permissions.");
        }
    }

    // Initialize Overlay Position
    function initOverlay() {
        // Default to bottom right
        const viewportRect = viewport.getBoundingClientRect();
        const imgHeight = viewportRect.height * state.scale;

        // We need to wait for image to load to get aspect ratio, 
        // but for initial placement we can just set style
        idolOverlay.style.height = `${state.scale * 100}%`;
        idolOverlay.style.width = 'auto';

        // Reset position to bottom right
        idolOverlay.style.left = 'auto';
        idolOverlay.style.top = 'auto';
        idolOverlay.style.right = '0px';
        idolOverlay.style.bottom = '0px';

        // Update state coordinates after browser renders
        requestAnimationFrame(() => {
            const rect = idolOverlay.getBoundingClientRect();
            const parentRect = viewport.getBoundingClientRect();
            state.x = rect.left - parentRect.left;
            state.y = rect.top - parentRect.top;

            // Now switch to absolute positioning with left/top for dragging
            idolOverlay.style.right = 'auto';
            idolOverlay.style.bottom = 'auto';
            idolOverlay.style.left = `${state.x}px`;
            idolOverlay.style.top = `${state.y}px`;
        });
    }

    // Switch Camera
    switchCamBtn.addEventListener('click', () => {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        initCamera();
    });

    // Handle Idol Upload
    idolUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                idolOverlay.src = e.target.result;
                idolOverlay.onload = () => initOverlay();
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle Size Slider
    sizeSlider.addEventListener('input', (e) => {
        const val = e.target.value; // 10 to 200
        state.scale = val / 100;
        idolOverlay.style.height = `${state.scale * 100}%`;
    });

    // Drag Logic
    function handleStart(clientX, clientY) {
        state.isDragging = true;
        state.dragStartX = clientX;
        state.dragStartY = clientY;
        state.initialLeft = idolOverlay.offsetLeft;
        state.initialTop = idolOverlay.offsetTop;
        idolOverlay.style.cursor = 'grabbing';
    }

    function handleMove(clientX, clientY) {
        if (!state.isDragging) return;

        const dx = clientX - state.dragStartX;
        const dy = clientY - state.dragStartY;

        state.x = state.initialLeft + dx;
        state.y = state.initialTop + dy;

        idolOverlay.style.left = `${state.x}px`;
        idolOverlay.style.top = `${state.y}px`;
    }

    function handleEnd() {
        state.isDragging = false;
        idolOverlay.style.cursor = 'grab';
    }

    // Mouse Events
    idolOverlay.addEventListener('mousedown', e => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => {
        handleMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', handleEnd);

    // Touch Events
    idolOverlay.addEventListener('touchstart', e => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
    });
    window.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    });
    window.addEventListener('touchend', handleEnd);


    // Capture Image
    captureBtn.addEventListener('click', () => {
        const width = video.videoWidth;
        const height = video.videoHeight;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // 1. Draw Video
        if (facingMode === 'user') {
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, width, height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 2. Draw Idol Overlay
        if (idolOverlay.src && idolOverlay.naturalWidth > 0) {
            // Get relative position and size from DOM
            const viewportRect = viewport.getBoundingClientRect();
            const overlayRect = idolOverlay.getBoundingClientRect();

            // Calculate ratios
            const scaleX = width / viewportRect.width;
            const scaleY = height / viewportRect.height;

            // Calculate position on canvas
            // Relative to viewport
            const relX = overlayRect.left - viewportRect.left;
            const relY = overlayRect.top - viewportRect.top;

            // Map to canvas coordinates
            const drawX = relX * scaleX;
            const drawY = relY * scaleY;
            const drawW = overlayRect.width * scaleX;
            const drawH = overlayRect.height * scaleY;

            ctx.drawImage(idolOverlay, drawX, drawY, drawW, drawH);
        }

        // 3. Download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `idol-cam-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        // Flash effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = 0;
        flash.style.left = 0;
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '1';
        flash.style.transition = 'opacity 0.5s';
        flash.style.zIndex = '100';
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 500);
        }, 50);
    });

    // Start
    initCamera();
});
