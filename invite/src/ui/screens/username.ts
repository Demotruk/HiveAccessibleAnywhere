/**
 * Username selection screen.
 * Client-side format validation + debounced on-chain availability check.
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';
import { isValidUsername } from '../../hive/username';
import { HiveClient } from '../../hive/client';

const PUBLIC_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

export const UsernameScreen: ScreenFn = (container, state, advance) => {
  container.innerHTML = `<div class="ct">
    <h1>${t.username_title}</h1>
    <p class="sm mt mb">${t.username_desc}</p>
    <label>${t.username_placeholder}</label>
    <input type="text" id="username" placeholder="${t.username_placeholder}"
           autocomplete="off" autocapitalize="none" spellcheck="false"
           maxlength="16">
    <p class="avail hidden" id="avail"></p>
    <button id="submit" disabled>${t.username_continue}</button>
    <p class="err hidden" id="err"></p>
  </div>`;

  const usernameInput = container.querySelector('#username') as HTMLInputElement;
  const availEl = container.querySelector('#avail') as HTMLElement;
  const submitBtn = container.querySelector('#submit') as HTMLButtonElement;
  const errEl = container.querySelector('#err') as HTMLElement;

  const endpoints = [...state.payload!.endpoints, ...PUBLIC_NODES];
  const client = new HiveClient(endpoints);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastChecked = '';
  let isAvailable = false;

  const showAvail = (msg: string, cls: 'ok' | 'err' | 'checking') => {
    availEl.textContent = msg;
    availEl.className = `avail ${cls}`;
    availEl.classList.remove('hidden');
  };

  const hideAvail = () => {
    availEl.classList.add('hidden');
  };

  const checkAvailability = async (name: string) => {
    if (name !== usernameInput.value.trim().toLowerCase()) return;

    showAvail(t.username_checking, 'checking');

    try {
      const accounts = await client.getAccounts([name]);
      if (name !== usernameInput.value.trim().toLowerCase()) return;

      if (!accounts || accounts.length === 0) {
        isAvailable = true;
        showAvail(t.username_available, 'ok');
        submitBtn.disabled = false;
      } else {
        isAvailable = false;
        showAvail(t.username_taken, 'err');
        submitBtn.disabled = true;
      }
    } catch {
      isAvailable = false;
      showAvail(t.err_network, 'err');
      submitBtn.disabled = true;
    }
  };

  usernameInput.addEventListener('input', () => {
    const name = usernameInput.value.trim().toLowerCase();
    usernameInput.value = name;
    submitBtn.disabled = true;
    isAvailable = false;
    errEl.classList.add('hidden');

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!name) {
      hideAvail();
      return;
    }

    // Client-side format validation (instant)
    const formatError = isValidUsername(name);
    if (formatError) {
      showAvail(formatError, 'err');
      return;
    }

    // Debounced on-chain availability check
    if (name !== lastChecked) {
      debounceTimer = setTimeout(() => {
        lastChecked = name;
        checkAvailability(name);
      }, 500);
    }
  });

  submitBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim().toLowerCase();
    if (!name || !isAvailable) return;

    state.username = name;
    advance('backup');
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !submitBtn.disabled) submitBtn.click();
  });

  usernameInput.focus();
};
