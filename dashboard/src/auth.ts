import type { KeychainResponse } from './types.js';
import { requestChallenge, verifyChallenge, requestChallengeExternal, verifyChallengeExternal } from './api.js';

/** Timeout for Keychain callbacks — some versions never fire on cancel. */
const KEYCHAIN_TIMEOUT_MS = 60_000;

export function isKeychainAvailable(): boolean {
  return !!window.hive_keychain;
}

/**
 * Wrap a Keychain call with a timeout guard. If the callback never fires
 * (e.g. user closes the popup), the promise rejects after KEYCHAIN_TIMEOUT_MS.
 */
function withKeychainTimeout<T>(
  invoke: (cb: (response: KeychainResponse) => void) => void,
  extractResult: (response: KeychainResponse) => T,
  failureLabel: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Keychain did not respond — request may have been cancelled'));
      }
    }, KEYCHAIN_TIMEOUT_MS);

    invoke((response: KeychainResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (response.success) {
        resolve(extractResult(response));
      } else {
        reject(new Error(response.message || response.error || failureLabel));
      }
    });
  });
}

export function signChallenge(username: string, challenge: string): Promise<string> {
  return withKeychainTimeout(
    (cb) => window.hive_keychain!.requestSignBuffer(username, challenge, 'Posting', cb),
    (r) => r.result,
    'Keychain signing failed',
  );
}

export async function login(username: string): Promise<string> {
  const challenge = await requestChallenge(username);
  const signature = await signChallenge(username, challenge);
  return verifyChallenge(username, challenge, signature);
}

/**
 * Authenticate with an external gift card service.
 * Returns the JWT on success, or null on failure (degraded mode).
 */
export async function loginExternal(username: string, serviceUrl: string): Promise<string | null> {
  try {
    const challenge = await requestChallengeExternal(username, serviceUrl);
    const signature = await signChallenge(username, challenge);
    return await verifyChallengeExternal(username, challenge, signature, serviceUrl);
  } catch {
    return null;
  }
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
  return withKeychainTimeout(
    (cb) => window.hive_keychain!.requestCustomJson(
      username, id, keyType, JSON.stringify(json), displayMsg, cb,
    ),
    (r) => r.result,
    'Custom JSON broadcast failed',
  );
}

/**
 * Request to add an account to the user's active or posting authority via Keychain.
 * Keychain handles fetching current authority and merging — no manual account_update needed.
 */
export function addAccountAuthority(
  username: string,
  authorizedAccount: string,
  role: 'Posting' | 'Active',
  weight: number = 1,
): Promise<string> {
  return withKeychainTimeout(
    (cb) => window.hive_keychain!.requestAddAccountAuthority(
      username, authorizedAccount, role, weight, cb,
    ),
    (r) => r.result,
    'Add account authority failed',
  );
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
  return withKeychainTimeout(
    (cb) => window.hive_keychain!.requestBroadcast(username, operations, keyType, cb),
    (r) => r.result,
    'Broadcast failed',
  );
}
