document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const idolOverlay = document.getElementById('idol-overlay');
    const captureBtn = document.getElementById('capture-btn');
    const idolUpload = document.getElementById('idol-upload');
    const switchCamBtn = document.getElementById('switch-cam-btn');
    const sizeSlider = document.getElementById('size-slider');
    const viewport = document.getElementById('viewport');
    const statusBox = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const retryBtn = document.getElementById('retry-btn');
    const hint = document.getElementById('hint');
    const flash = document.getElementById('flash');
    const preview = document.getElementById('preview');
    const previewImg = document.getElementById('preview-img');
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const retakeBtn = document.getElementById('retake-btn');

    const MIN_SCALE = sizeSlider.min / 100;
    const MAX_SCALE = sizeSlider.max / 100;

    let currentStream = null;
    let facingMode = 'user';
    let idolObjectUrl = null;
    let lastCapture = null; // { blob, url, filename }

    // Overlay geometry is stored relative to the viewport so it survives
    // resizes and orientation changes.
    const overlay = {
        cx: 0.5,    // center X as a fraction of viewport width
        cy: 0.5,    // center Y as a fraction of viewport height
        scale: sizeSlider.value / 100, // height as a fraction of viewport height
        aspect: 1   // natural width / height of the idol image
    };

    // Active pointers on the overlay, used for drag and pinch-to-resize
    const pointers = new Map();
    let gesture = null;

    // ---------- Camera ----------

    function showStatus(message, canRetry = false) {
        statusText.textContent = message;
        retryBtn.hidden = !canRetry;
        statusBox.hidden = false;
    }

    function hideStatus() {
        statusBox.hidden = true;
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    async function initCamera() {
        stopCamera();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showStatus('Camera is not available. Open this page over HTTPS (or localhost) in a modern browser.');
            return;
        }

        showStatus('Starting camera…');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            currentStream = stream;
            video.srcObject = stream;

            // Prefer what the browser actually gave us over what we asked for
            const settings = stream.getVideoTracks()[0].getSettings();
            const actualFacing = settings.facingMode || facingMode;
            video.classList.toggle('mirrored', actualFacing === 'user');

            hideStatus();
            updateSwitchButton();
        } catch (err) {
            console.error('Error accessing camera:', err);
            if (err.name === 'NotAllowedError') {
                showStatus('Camera permission was denied. Allow camera access in your browser settings, then retry.', true);
            } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
                showStatus('No camera was found on this device.', true);
            } else if (err.name === 'NotReadableError') {
                showStatus('The camera is being used by another app.', true);
            } else {
                showStatus('Could not access the camera.', true);
            }
        }
    }

    async function updateSwitchButton() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');
            switchCamBtn.hidden = cameras.length < 2;
        } catch {
            switchCamBtn.hidden = false;
        }
    }

    switchCamBtn.addEventListener('click', () => {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        initCamera();
    });

    retryBtn.addEventListener('click', initCamera);

    // Release the camera while the page is in the background
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopCamera();
        } else if (preview.hidden) {
            initCamera();
        }
    });

    // ---------- Idol overlay ----------

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    // Overlay rectangle in viewport CSS pixels
    function overlayRect() {
        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        const height = overlay.scale * vh;
        const width = height * overlay.aspect;
        return {
            left: overlay.cx * vw - width / 2,
            top: overlay.cy * vh - height / 2,
            width,
            height
        };
    }

    function renderOverlay() {
        const rect = overlayRect();
        idolOverlay.style.left = `${rect.left}px`;
        idolOverlay.style.top = `${rect.top}px`;
        idolOverlay.style.width = `${rect.width}px`;
        idolOverlay.style.height = `${rect.height}px`;
    }

    function setScale(scale) {
        overlay.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
        sizeSlider.value = Math.round(overlay.scale * 100);
        renderOverlay();
    }

    idolUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (idolObjectUrl) URL.revokeObjectURL(idolObjectUrl);
        idolObjectUrl = URL.createObjectURL(file);
        idolOverlay.src = idolObjectUrl;
        // Allow choosing the same file again later
        idolUpload.value = '';
    });

    idolOverlay.addEventListener('load', () => {
        overlay.aspect = idolOverlay.naturalWidth / idolOverlay.naturalHeight;

        // Place the idol at the bottom right, fully inside the viewport
        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        const width = overlay.scale * vh * overlay.aspect;
        overlay.cx = clamp(1 - width / 2 / vw, 0, 1);
        overlay.cy = clamp(1 - overlay.scale / 2, 0, 1);

        idolOverlay.hidden = false;
        hint.hidden = true;
        sizeSlider.disabled = false;
        renderOverlay();
    });

    idolOverlay.addEventListener('error', () => {
        showStatus('That file could not be loaded as an image. Try a PNG or JPG.');
        setTimeout(() => { if (currentStream) hideStatus(); }, 3000);
    });

    sizeSlider.addEventListener('input', () => {
        setScale(sizeSlider.value / 100);
    });

    // Drag with one pointer, pinch with two
    function startGesture() {
        const pts = [...pointers.values()];
        gesture = {
            cx: overlay.cx,
            cy: overlay.cy,
            scale: overlay.scale,
            startX: pts.reduce((s, p) => s + p.x, 0) / pts.length,
            startY: pts.reduce((s, p) => s + p.y, 0) / pts.length,
            startDist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
        };
    }

    // Listen on the viewport so a second pinch finger may land beside the idol
    viewport.addEventListener('pointerdown', (e) => {
        if (pointers.size === 0 && e.target !== idolOverlay) return;
        e.preventDefault();
        viewport.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        idolOverlay.classList.add('dragging');
        startGesture();
    });

    viewport.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const pts = [...pointers.values()];
        const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;

        overlay.cx = clamp(gesture.cx + (x - gesture.startX) / viewport.clientWidth, 0, 1);
        overlay.cy = clamp(gesture.cy + (y - gesture.startY) / viewport.clientHeight, 0, 1);

        if (pts.length > 1 && gesture.startDist > 0) {
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            setScale(gesture.scale * dist / gesture.startDist);
        } else {
            renderOverlay();
        }
    });

    function endPointer(e) {
        if (!pointers.delete(e.pointerId)) return;
        if (pointers.size > 0) {
            startGesture();
        } else {
            gesture = null;
            idolOverlay.classList.remove('dragging');
        }
    }

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    // Mouse wheel / trackpad resize on desktop
    idolOverlay.addEventListener('wheel', (e) => {
        e.preventDefault();
        setScale(overlay.scale * Math.exp(-e.deltaY * 0.001));
    }, { passive: false });

    window.addEventListener('resize', () => {
        if (!idolOverlay.hidden) renderOverlay();
    });

    // ---------- Capture ----------

    function capture() {
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        if (!currentStream || !videoW || !videoH) return;

        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;

        // Reproduce `object-fit: cover`: crop the video to the visible area
        const coverScale = Math.max(vw / videoW, vh / videoH);
        const sw = vw / coverScale;
        const sh = vh / coverScale;
        const sx = (videoW - sw) / 2;
        const sy = (videoH - sh) / 2;

        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        // Uniform factor from viewport CSS pixels to canvas pixels
        const k = canvas.width / vw;

        const ctx = canvas.getContext('2d');

        // 1. Draw video, mirrored the same way as the preview
        if (video.classList.contains('mirrored')) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 2. Draw idol overlay at the same place it appears on screen
        if (!idolOverlay.hidden && idolOverlay.naturalWidth > 0) {
            const rect = overlayRect();
            ctx.filter = `drop-shadow(0 0 ${10 * k}px rgba(0, 0, 0, 0.5))`;
            ctx.drawImage(idolOverlay, rect.left * k, rect.top * k, rect.width * k, rect.height * k);
            ctx.filter = 'none';
        }

        flash.classList.remove('active');
        void flash.offsetWidth; // restart the animation
        flash.classList.add('active');

        canvas.toBlob((blob) => {
            if (!blob) return;
            if (lastCapture) URL.revokeObjectURL(lastCapture.url);
            lastCapture = {
                blob,
                url: URL.createObjectURL(blob),
                filename: `idol-cam-${Date.now()}.png`
            };
            previewImg.src = lastCapture.url;
            shareBtn.hidden = !canShareFile(blob, lastCapture.filename);
            preview.hidden = false;
            saveBtn.focus();
        }, 'image/png');
    }

    function canShareFile(blob, filename) {
        if (!navigator.canShare) return false;
        try {
            return navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] });
        } catch {
            return false;
        }
    }

    captureBtn.addEventListener('click', capture);

    document.addEventListener('keydown', (e) => {
        if (!preview.hidden) {
            if (e.key === 'Escape') closePreview();
            return;
        }
        if (e.key === ' ' && e.target === document.body) {
            e.preventDefault();
            capture();
        }
    });

    // ---------- Preview ----------

    function closePreview() {
        preview.hidden = true;
        captureBtn.focus();
    }

    saveBtn.addEventListener('click', () => {
        if (!lastCapture) return;
        const link = document.createElement('a');
        link.download = lastCapture.filename;
        link.href = lastCapture.url;
        link.click();
    });

    shareBtn.addEventListener('click', async () => {
        if (!lastCapture) return;
        const file = new File([lastCapture.blob], lastCapture.filename, { type: lastCapture.blob.type });
        try {
            await navigator.share({ files: [file], title: 'Idol Cam' });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        }
    });

    retakeBtn.addEventListener('click', closePreview);

    // Start
    initCamera();
});
