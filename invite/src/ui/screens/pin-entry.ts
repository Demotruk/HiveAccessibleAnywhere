/**
 * PIN entry screen — prompts user for the 6-character PIN from their gift card.
 * On submit, decrypts the URL fragment payload.
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';
import { decryptPayload } from '../../crypto/decrypt';

export const PinEntryScreen: ScreenFn = (container, state, advance) => {
  container.innerHTML = `<div class="ct">
    <h1>${t.pin_title}</h1>
    <p class="sm mt mb">${t.pin_desc}</p>
    <input type="text" id="pin" class="pin-input" maxlength="6"
           placeholder="${t.pin_placeholder}" autocomplete="off"
           autocapitalize="characters" spellcheck="false">
    <button id="submit" disabled>${t.pin_submit}</button>
    <p class="err hidden" id="err"></p>
  </div>`;

  const pinInput = container.querySelector('#pin') as HTMLInputElement;
  const submitBtn = container.querySelector('#submit') as HTMLButtonElement;
  const errEl = container.querySelector('#err') as HTMLElement;

  // Restrict to valid PIN characters and auto-uppercase
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    submitBtn.disabled = pinInput.value.length !== 6;
    errEl.classList.add('hidden');
  });

  // Auto-submit when 6 chars entered
  pinInput.addEventListener('input', () => {
    if (pinInput.value.length === 6) {
      submitBtn.click();
    }
  });

  const doSubmit = async () => {
    const pin = pinInput.value;
    if (pin.length !== 6) {
      errEl.textContent = t.pin_invalid;
      errEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    errEl.classList.add('hidden');

    try {
      if (!crypto?.subtle) {
        errEl.textContent = 'Web Crypto not available — HTTPS required. This page must be served over HTTPS or localhost.';
        errEl.classList.remove('hidden');
        submitBtn.disabled = false;
        return;
      }
      const payload = await decryptPayload(state.encryptedBlob!, pin);
      state.pin = pin;
      state.payload = payload;

      // Wake up the giftcard service as early as possible —
      // Fly.io cold start can take 10-30s, so start now before
      // the user goes through verification + username + key backup.
      // Use POST /validate (not GET /health) to exercise the full app
      // pipeline — health checks alone may not wake a stopped Fly machine.
      fetch(`${payload.serviceUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"token":"wake"}',
      }).catch(() => {});

      advance('verifying');
    } catch {
      errEl.textContent = t.pin_error;
      errEl.classList.remove('hidden');
      submitBtn.disabled = false;
      pinInput.value = '';
      pinInput.focus();
    }
  };

  submitBtn.addEventListener('click', doSubmit);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && pinInput.value.length === 6) doSubmit();
  });

  pinInput.focus();
};
