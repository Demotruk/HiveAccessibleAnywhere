/**
 * QR scan/upload screen — the first screen.
 * User can upload a screenshot of their backup QR or scan with camera.
 */

import type { ScreenFn } from '../../types';
import { decodeQRFromFile, startCameraScanner } from '../../qr/scanner';
import { t } from '../locale';

export const ScanScreen: ScreenFn = (container, state, advance) => {
  container.innerHTML = `<div class="ct center">
    <h1>${t.scan_title}</h1>
    <p class="sm mt mb">${t.scan_desc}</p>

    <div class="scan-area" id="drop-zone">
      <span class="scan-icon">\u{1F4F7}</span>
      <p class="sm">${t.scan_tap}</p>
      <p class="xs mt">${t.scan_formats}</p>
    </div>
    <input type="file" accept="image/*" id="file-input" class="file-input">

    <p class="err hidden" id="err"></p>

    <div class="divider">${t.scan_or}</div>

    <button class="btn-s" id="camera-btn">${t.scan_camera_btn}</button>

    <div id="camera-section" class="hidden">
      <div class="camera-container">
        <video id="camera-video" playsinline muted></video>
        <div class="camera-overlay"></div>
      </div>
      <button class="btn-s" id="camera-stop">${t.scan_camera_stop}</button>
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
        showError(t.scan_no_qr);
      }
    } catch {
      showError(t.scan_read_error);
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
