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
