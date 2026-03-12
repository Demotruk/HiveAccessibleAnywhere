/**
 * QR scan/upload screen — the first screen.
 * User can upload a screenshot of their backup QR or scan with camera.
 */

import type { ScreenFn } from '../../types';
import { decodeQRFromFile, startCameraScanner } from '../../qr/scanner';

export const ScanScreen: ScreenFn = (container, state, advance) => {
  container.innerHTML = `<div class="ct center">
    <h1>Restore Backup</h1>
    <p class="sm mt mb">Upload your backup QR screenshot or scan it with your camera.</p>

    <div class="scan-area" id="drop-zone">
      <span class="scan-icon">\u{1F4F7}</span>
      <p class="sm">Tap to select image or drag &amp; drop</p>
      <p class="xs mt">Supports PNG, JPG, or any image with a QR code</p>
    </div>
    <input type="file" accept="image/*" id="file-input" class="file-input">

    <p class="err hidden" id="err"></p>

    <div class="divider">or</div>

    <button class="btn-s" id="camera-btn">\u{1F4F7} Scan with Camera</button>

    <div id="camera-section" class="hidden">
      <div class="camera-container">
        <video id="camera-video" playsinline muted></video>
        <div class="camera-overlay"></div>
      </div>
      <button class="btn-s" id="camera-stop">Stop Camera</button>
    </div>
  </div>`;

  const dropZone = container.querySelector('#drop-zone') as HTMLElement;
  const fileInput = container.querySelector('#file-input') as HTMLInputElement;
  const errEl = container.querySelector('#err') as HTMLElement;
  const cameraBtn = container.querySelector('#camera-btn') as HTMLButtonElement;
  const cameraSection = container.querySelector('#camera-section') as HTMLElement;
  const videoEl = container.querySelector('#camera-video') as HTMLVideoElement;
  const cameraStopBtn = container.querySelector('#camera-stop') as HTMLButtonElement;

  let cameraScanner: { stop: () => void } | null = null;

  function showError(msg: string) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  function clearError() {
    errEl.classList.add('hidden');
  }

  async function handleFile(file: File | Blob) {
    clearError();
    try {
      const data = await decodeQRFromFile(file);
      if (data) {
        handleQRData(data);
      } else {
        showError('No QR code found in this image. Try a clearer screenshot.');
      }
    } catch {
      showError('Could not read the image. Try a different file.');
    }
  }

  function handleQRData(data: string) {
    if (cameraScanner) {
      cameraScanner.stop();
      cameraScanner = null;
    }
    state.encryptedData = data;
    advance('pin');
  }

  // Click to upload
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });

  // Camera scanning
  cameraBtn.addEventListener('click', () => {
    clearError();
    cameraBtn.classList.add('hidden');
    cameraSection.classList.remove('hidden');

    cameraScanner = startCameraScanner(videoEl, handleQRData);
  });

  cameraStopBtn.addEventListener('click', () => {
    if (cameraScanner) {
      cameraScanner.stop();
      cameraScanner = null;
    }
    cameraSection.classList.add('hidden');
    cameraBtn.classList.remove('hidden');
  });
};
