/**
 * Image upload to Hive image hosting service.
 *
 * Uploads an image to images.hive.blog (with fallback to images.ecency.com).
 * The upload requires a signature from the user's posting key using the
 * 'ImageSigningChallenge' protocol.
 */

import { PrivateKey } from 'hive-tx';

const IMAGE_HOSTS = [
  'https://images.hive.blog',
  'https://images.ecency.com',
];

/**
 * Compress an image file to JPEG, resizing if necessary.
 * Returns an ArrayBuffer of the compressed image.
 */
export async function compressImage(file: File, maxSize = 1024, quality = 0.85): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Scale down if larger than maxSize on either dimension
  let targetW = width;
  let targetH = height;
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    targetW = Math.round(width * ratio);
    targetH = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return blob.arrayBuffer();
}

/**
 * Upload an image to Hive image hosting.
 *
 * @param imageData Compressed image data as ArrayBuffer
 * @param username Hive account name
 * @param postingWif WIF-encoded posting key for signing
 * @returns URL of the uploaded image
 */
export async function uploadImage(
  imageData: ArrayBuffer,
  username: string,
  postingWif: string,
): Promise<string> {
  // Build the signing challenge: SHA256('ImageSigningChallenge' + imageData)
  const prefix = new TextEncoder().encode('ImageSigningChallenge');
  const combined = new Uint8Array(prefix.length + imageData.byteLength);
  combined.set(prefix);
  combined.set(new Uint8Array(imageData), prefix.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashBytes = new Uint8Array(hashBuffer);

  // Sign the hash with the posting key
  const key = PrivateKey.from(postingWif);
  const signature = key.sign(hashBytes);
  const sigHex = signature.customToString();

  let lastError: Error | undefined;

  for (const host of IMAGE_HOSTS) {
    try {
      const url = `${host}/${username}/${sigHex}`;
      const response = await fetch(url, {
        method: 'POST',
        body: imageData,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Upload failed (${response.status}): ${text}`);
      }

      const result = await response.json() as { url?: string; error?: string };
      if (result.error) {
        throw new Error(result.error);
      }
      if (!result.url) {
        throw new Error('No URL in upload response');
      }

      return result.url;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Image upload failed on all hosts');
}
