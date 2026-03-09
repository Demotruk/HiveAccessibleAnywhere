/**
 * Key backup screen.
 *
 * Generates master password, derives all 4 key pairs, encrypts the backup
 * with the gift card PIN and presents it as a QR code for the user to
 * screenshot. Also stores in localStorage as a convenience.
 * Manual backup options (copy master password, individual keys) available
 * as a secondary toggle.
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';
import { generateMasterPassword, deriveKeys } from '../../crypto/keygen';
import { encryptWithPin } from '../../crypto/encrypt';
import QRCode from 'qrcode';

/**
 * Open a print-friendly window containing just the encrypted backup QR code,
 * the account username, and instructions to keep the PIN safe.
 */
function printBackup(qrDataUrl: string, username: string): void {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t.backup_print_title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       text-align:center;padding:40px 20px;color:#000}
  h1{font-size:1.4rem;margin-bottom:8px}
  .account{font-size:1.1rem;margin-bottom:16px;font-weight:600}
  img{max-width:280px;margin:16px auto}
  .instructions{font-size:.9rem;max-width:400px;margin:16px auto;line-height:1.5}
  @media print{body{padding:20px}}
</style></head><body>
  <h1>${t.backup_print_title}</h1>
  <p class="account">${fmt(t.backup_print_account, username)}</p>
  <img src="${qrDataUrl}" alt="Encrypted key backup QR code">
  <p class="instructions">${t.backup_print_instructions}</p>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.addEventListener('afterprint', () => w.close());
    // Small delay to ensure content is rendered before print dialog
    setTimeout(() => w.print(), 250);
  }
}

/** localStorage key for the encrypted key backup */
const BACKUP_STORAGE_KEY = 'propolis_key_backup';

export const KeyBackupScreen: ScreenFn = async (container, state, advance) => {
  // Generate keys if not already done
  if (!state.masterPassword) {
    state.masterPassword = generateMasterPassword();
  }
  if (!state.keys) {
    state.keys = deriveKeys(state.username!, state.masterPassword);
  }

  // Encrypt backup with the gift card PIN
  const backupData = JSON.stringify({
    username: state.username,
    masterPassword: state.masterPassword,
  });
  const encryptedBackup = await encryptWithPin(backupData, state.pin!);

  // Also store in localStorage as a convenience (non-critical)
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, encryptedBackup);
  } catch { /* ignore storage errors */ }

  container.innerHTML = `<div class="ct">
    <div class="screenshot-banner">
      <h1>${t.backup_title}</h1>
      <p>${t.backup_desc}</p>
    </div>

    <div class="card qr-backup">
      <label>${t.backup_qr_label}</label>
      <img id="qr-encrypted" alt="Encrypted key backup QR code" style="display:none">
      <p class="xs mt">${t.backup_qr_info}</p>
    </div>

    <button class="btn-ok" id="print-btn">${t.backup_print}</button>

    <div class="card pin-reminder">
      <p class="sm">${t.backup_pin_warning}</p>
    </div>

    <button class="toggle-link" id="toggle-manual">${t.backup_show_manual}</button>
    <div id="manual-backup" class="hidden">
      <div class="card">
        <label>${t.backup_master_label}</label>
        <div class="copy-row">
          <div class="mono-box" id="master">${state.masterPassword}</div>
          <button class="copy-btn btn-s" id="copy-btn">${t.backup_copy}</button>
        </div>
        <p class="xs mt">${t.backup_master_info}</p>
      </div>

      <div class="card">
        <button class="toggle-link" id="toggle-keys">${t.backup_show_keys}</button>
        <div id="keys-detail" class="hidden">
          <div class="key-row">
            <div class="key-role">${t.backup_owner_wif}</div>
            <div class="key-wif">${state.keys.owner.wif}</div>
          </div>
          <div class="key-row">
            <div class="key-role">${t.backup_active_wif}</div>
            <div class="key-wif">${state.keys.active.wif}</div>
          </div>
          <div class="key-row">
            <div class="key-role">${t.backup_posting_wif}</div>
            <div class="key-wif">${state.keys.posting.wif}</div>
          </div>
          <div class="key-row">
            <div class="key-role">${t.backup_memo_wif}</div>
            <div class="key-wif">${state.keys.memo.wif}</div>
          </div>
        </div>
      </div>
    </div>

    <button id="proceed">${t.backup_proceed}</button>
  </div>`;

  // Generate encrypted backup QR code immediately
  const qrEncrypted = container.querySelector('#qr-encrypted') as HTMLImageElement;
  const printBtn = container.querySelector('#print-btn') as HTMLButtonElement;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(encryptedBackup, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrEncrypted.src = qrDataUrl;
    qrEncrypted.style.display = 'block';
  } catch {
    // QR generation failed — show the encrypted text as fallback
    qrEncrypted.insertAdjacentHTML('afterend',
      `<div class="mono-box" style="font-size:.65rem">${encryptedBackup}</div>`);
    printBtn.style.display = 'none';
  }

  // Print backup
  printBtn.addEventListener('click', () => {
    if (qrDataUrl) printBackup(qrDataUrl, state.username!);
  });

  const toggleManual = container.querySelector('#toggle-manual') as HTMLButtonElement;
  const manualBackup = container.querySelector('#manual-backup') as HTMLElement;
  const toggleKeys = container.querySelector('#toggle-keys') as HTMLButtonElement;
  const keysDetail = container.querySelector('#keys-detail') as HTMLElement;
  const proceedBtn = container.querySelector('#proceed') as HTMLButtonElement;

  // Toggle manual backup section
  toggleManual.addEventListener('click', () => {
    const showing = !manualBackup.classList.contains('hidden');
    manualBackup.classList.toggle('hidden');
    toggleManual.textContent = showing ? t.backup_show_manual : t.backup_hide_manual;
  });

  // Copy master password
  const copyBtn = container.querySelector('#copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(state.masterPassword!);
        (copyBtn as HTMLButtonElement).textContent = t.backup_copied;
        setTimeout(() => { (copyBtn as HTMLButtonElement).textContent = t.backup_copy; }, 2000);
      } catch {
        const masterEl = container.querySelector('#master')!;
        const range = document.createRange();
        range.selectNodeContents(masterEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }

  // Toggle individual keys
  if (toggleKeys) {
    toggleKeys.addEventListener('click', () => {
      const showing = !keysDetail.classList.contains('hidden');
      keysDetail.classList.toggle('hidden');
      toggleKeys.textContent = showing ? t.backup_show_keys : t.backup_hide_keys;
    });
  }

  proceedBtn.addEventListener('click', () => advance('claiming'));
};
