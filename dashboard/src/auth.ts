import type { KeychainResponse } from './types.js';
import { requestChallenge, verifyChallenge } from './api.js';

export function isKeychainAvailable(): boolean {
  return !!window.hive_keychain;
}

export function signChallenge(username: string, challenge: string): Promise<string> {
  return new Promise((resolve, reject) => {
    window.hive_keychain!.requestSignBuffer(
      username,
      challenge,
      'Posting',
      (response: KeychainResponse) => {
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.message || response.error || 'Keychain signing failed'));
        }
      },
    );
  });
}

export async function login(username: string): Promise<string> {
  const challenge = await requestChallenge(username);
  const signature = await signChallenge(username, challenge);
  return verifyChallenge(username, challenge, signature);
}

/**
 * Broadcast a custom_json operation via Keychain.
 * Returns the tx result string from Keychain.
 */
export function broadcastCustomJson(
  username: string,
  id: string,
  keyType: 'Active' | 'Posting',
  json: object,
  displayMsg: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    window.hive_keychain!.requestCustomJson(
      username,
      id,
      keyType,
      JSON.stringify(json),
      displayMsg,
      (response: KeychainResponse) => {
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.message || response.error || 'Custom JSON broadcast failed'));
        }
      },
    );
  });
}

/**
 * Broadcast a raw operation via Keychain (e.g., account_update for delegation).
 * Returns the tx result string.
 */
export function broadcastOperation(
  username: string,
  operations: unknown[][],
  keyType: 'Active' | 'Posting',
): Promise<string> {
  return new Promise((resolve, reject) => {
    window.hive_keychain!.requestBroadcast(
      username,
      operations,
      keyType,
      (response: KeychainResponse) => {
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.message || response.error || 'Broadcast failed'));
        }
      },
    );
  });
}
