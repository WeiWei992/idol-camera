# Idol Camera Web App

A web application that allows you to take photos with your favorite idol!

## Features
- **Camera Feed**: Uses your device's camera (front or back). The switch button only appears when more than one camera is available.
- **Idol Overlay**: Upload any image of your idol (a transparent PNG works best).
- **Adjustable**: Drag to move. Resize with the slider, a two-finger pinch, or the mouse wheel.
- **Rotate & Flip**: Twist with two fingers (or Shift + mouse wheel) to rotate; double-tap the idol to straighten it. The Flip button mirrors the idol so they can face you.
- **Self-Timer**: Cycle the timer button between Off, 3s and 10s. Tap the shutter again to cancel a countdown.
- **Install as App**: Add it to your home screen to open it full-screen like a normal app. It also works offline after the first visit.
- **What You See Is What You Get**: The saved photo matches the on-screen framing exactly.
- **Preview, Save & Share**: Review each shot, then save it or share it directly (on supported devices).
- **Privacy**: All processing happens on your device. No images are uploaded to a server, and the camera is released when the tab is in the background.

## How to Use
1. Allow camera permissions.
2. Tap the upload button to select an image (transparent PNG recommended).
3. Drag and resize the idol to pose with them.
4. Tap the capture button (or press <kbd>Space</kbd> on desktop), then **Save** or **Share**.

## Install on Your Phone
- **Android (Chrome)**: menu ⋮ → **Add to Home screen** / **Install app**.
- **iPhone (Safari)**: Share button → **Add to Home Screen**.

## Running Locally
Camera access requires a secure context, so open the app via `http://localhost/...` (e.g. XAMPP) or HTTPS — not by double-clicking `index.html`.

## Deployment
To use this on a mobile device, this site must be served over HTTPS.
GitHub Pages is a great free option.
