/**
 * Mock Hive Keychain for development.
 *
 * IMPORTANT: This file is ONLY imported when import.meta.env.DEV is true.
 * Vite dead-code-eliminates the import in production builds, so this
 * module never appears in dist/.
 *
 * Behavior:
 * - requestSignBuffer: returns a fake hex signature (accepted by mock-server)
 * - requestCustomJson: logs the broadcast and returns a fake tx result
 * - requestBroadcast: logs the operation and returns a fake tx result
 */

import type { KeychainResponse } from './types.js';

console.log('[DEV] Mock Hive Keychain installed — all signatures auto-accepted');

window.hive_keychain = {
  requestSignBuffer(
    _username: string,
    _message: string,
    _role: string,
    callback: (response: KeychainResponse) => void,
  ) {
    console.log(`[MOCK KEYCHAIN] requestSignBuffer for @${_username} (${_role})`);
    setTimeout(() => {
      callback({
        success: true,
        result: 'mock-signature-' + Date.now().toString(16),
      });
    }, 300);
  },

  requestCustomJson(
    _username: string,
    id: string,
    keyType: string,
    jsonStr: string,
    displayMsg: string,
    callback: (response: KeychainResponse) => void,
  ) {
    console.log(`[MOCK KEYCHAIN] requestCustomJson id=${id} keyType=${keyType}`);
    console.log(`[MOCK KEYCHAIN]   display: ${displayMsg}`);
    console.log(`[MOCK KEYCHAIN]   json: ${jsonStr}`);
    setTimeout(() => {
      callback({
        success: true,
        result: 'mock-tx-' + Date.now().toString(16),
      });
    }, 500);
  },

  requestBroadcast(
    _username: string,
    operations: unknown[][],
    keyType: string,
    callback: (response: KeychainResponse) => void,
  ) {
    console.log(`[MOCK KEYCHAIN] requestBroadcast keyType=${keyType}`);
    console.log(`[MOCK KEYCHAIN]   ops:`, JSON.stringify(operations).slice(0, 200));
    setTimeout(() => {
      callback({
        success: true,
        result: 'mock-tx-' + Date.now().toString(16),
      });
    }, 500);
  },
};
