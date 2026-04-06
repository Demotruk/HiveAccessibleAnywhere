/**
 * PIN entry screen — prompts for the 6-character PIN to decrypt the backup.
 */

import type { ScreenFn } from '../../types';
import { decryptWithPin } from '../../crypto/decrypt';
import { PrivateKey } from 'hive-tx';
import type { BackupData, DerivedKeys } from '../../types';
import { t } from '../locale';

type KeyRole = 'owner' | 'active' | 'posting' | 'memo';

function deriveKeys(username: string, password: string): DerivedKeys {
  function derive(role: KeyRole) {
    const priv = PrivateKey.fromLogin(username, password, role);
    return { wif: priv.toString(), pub: priv.createPublic().toString() };
  }
  return {
    owner: derive('owner'),
    active: derive('active'),
    posting: derive('posting'),
    memo: derive('memo'),
  };
}

export const PinEntryScreen: ScreenFn = (container, state, advance) => {
  container.innerHTML = `<div class="ct center" style="padding-top:15vh">
    <h1>${t.pin_title}</h1>
    <p class="sm mt mb">${t.pin_desc}</p>
    <input type="text" id="pin" class="pin-input" maxlength="6"
           placeholder="${t.pin_placeholder}" autocomplete="off"
           autocapitalize="characters" spellcheck="false">
    <p class="err hidden" id="err"></p>
    <div class="spinner hidden" id="spinner"></div>
  </div>`;

  const pinInput = container.querySelector('#pin') as HTMLInputElement;
  const errEl = container.querySelector('#err') as HTMLElement;
  const spinnerEl = container.querySelector('#spinner') as HTMLElement;
  let submitting = false;

  // Restrict to valid PIN characters and auto-uppercase
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    errEl.classList.add('hidden');
  });

  // Auto-submit when 6 chars entered
  pinInput.addEventListener('input', () => {
    if (pinInput.value.length === 6) doSubmit();
  });

  const doSubmit = async () => {
    const pin = pinInput.value;
    if (pin.length !== 6 || submitting) return;

    submitting = true;
    errEl.classList.add('hidden');
    spinnerEl.classList.remove('hidden');

    try {
      if (!crypto?.subtle) {
        errEl.textContent = t.pin_crypto_error;
        errEl.classList.remove('hidden');
        spinnerEl.classList.add('hidden');
        submitting = false;
        return;
      }

      const plaintext = await decryptWithPin(state.encryptedData!, pin);
      const backupData: BackupData = JSON.parse(plaintext);

      if (!backupData.username || !backupData.masterPassword) {
        throw new Error('Invalid backup format');
      }

      state.backupData = backupData;
      state.keys = deriveKeys(backupData.username, backupData.masterPassword);
      advance('result');
    } catch {
      errEl.textContent = t.pin_wrong;
      errEl.classList.remove('hidden');
      spinnerEl.classList.add('hidden');
      submitting = false;
      pinInput.value = '';
      pinInput.focus();
    }
  };

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && pinInput.value.length === 6) doSubmit();
  });

  pinInput.focus();
};
