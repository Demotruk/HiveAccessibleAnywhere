import QrScanner from 'qr-scanner';
import { t } from '../locale';

// -- Types --

export type QrResult =
  | { type: 'combined'; account: string; activeWif: string; memoWif?: string }
  | { type: 'wif'; key: string }
  | { type: 'unknown' };

// -- Feature detection --

/** Check if QR scanning is supported (camera API available) */
export function isQrScannerSupported(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}

// -- QR payload parsing --

const B58_CHARS = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

/** Parse a scanned QR code string into a typed result */
export function parseQrPayload(raw: string): QrResult {
  const s = raw.trim();

  // Combined propolis format: propolis://login?a=account&k=activeWif&m=memoWif
  if (s.startsWith('propolis://login')) {
    try {
      const url = new URL(s.replace('propolis://', 'https://'));
      const account = url.searchParams.get('a');
      const activeWif = url.searchParams.get('k');
      const memoWif = url.searchParams.get('m') || undefined;
      if (account && activeWif) {
        return { type: 'combined', account, activeWif, memoWif };
      }
    } catch { /* fall through */ }
  }

  // Plain WIF key: 51 chars, starts with '5', all Base58
  if (s.length === 51 && s[0] === '5' && B58_CHARS.test(s)) {
    return { type: 'wif', key: s };
  }

  return { type: 'unknown' };
}

// -- Scanner overlay UI --

/** Open camera overlay, scan for QR code. Returns decoded string or null if cancelled. */
export function scanQrCode(): Promise<string | null> {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;z-index:10000;width:auto;padding:4px 12px;';

    // Video element
    const video = document.createElement('video');
    video.style.cssText = 'max-width:80vw;max-height:60vh;border-radius:8px;border:2px solid #4ecca3;';

    // Instruction text
    const label = document.createElement('p');
    label.textContent = t.qr_scanning;
    label.style.cssText = 'color:#a0a0b0;font-size:0.85rem;margin-top:12px;';

    overlay.appendChild(closeBtn);
    overlay.appendChild(video);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    let scanner: QrScanner | null = null;

    const cleanup = () => {
      if (scanner) { scanner.destroy(); scanner = null; }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    closeBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Start scanner
    scanner = new QrScanner(video, (result) => {
      const data = result.data;
      cleanup();
      resolve(data);
    }, {
      preferredCamera: 'environment',
      maxScansPerSecond: 5,
      returnDetailedScanResult: true,
      onDecodeError: () => { /* ignore frame-level decode errors */ },
    });

    scanner.start().catch(() => {
      cleanup();
      resolve(null);
    });
  });
}
