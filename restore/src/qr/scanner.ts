/**
 * QR code reading from image files and camera.
 * Uses jsQR for decoding QR codes from image data.
 */

import jsQR from 'jsqr';

/**
 * Decode a QR code from an image file (File or Blob).
 * Returns the decoded text or null if no QR found.
 */
export async function decodeQRFromFile(file: File | Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();

  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result?.data ?? null;
}

/**
 * Camera QR scanner. Captures frames from the camera and scans for QR codes.
 * Calls onResult when a QR code is found.
 * Returns a stop function to clean up the camera stream.
 */
export function startCameraScanner(
  videoEl: HTMLVideoElement,
  onResult: (data: string) => void,
): { stop: () => void } {
  let stopped = false;
  let stream: MediaStream | null = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  async function init() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      scanFrame();
    } catch {
      // Camera access denied or unavailable — silently stop
      stopped = true;
    }
  }

  function scanFrame() {
    if (stopped) return;

    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (result?.data) {
        onResult(result.data);
        return; // Stop scanning after first result
      }
    }
    requestAnimationFrame(scanFrame);
  }

  init();

  return {
    stop() {
      stopped = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      videoEl.srcObject = null;
    },
  };
}
