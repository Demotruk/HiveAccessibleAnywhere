/**
 * Hive posting key signature verification.
 *
 * Verifies that a message was signed by the posting key of a given Hive account.
 * Used for Keychain challenge-response authentication.
 *
 * Uses the same fetch+timeout pattern as hive/provider.ts for chain queries.
 */

import { createHash } from 'node:crypto';
import { Signature, PublicKey } from 'hive-tx';

/**
 * Fetch the posting public keys for a Hive account.
 * Returns an array of public key strings from the account's posting authority.
 */
async function resolvePostingKeys(
  username: string,
  hiveNodes: string[],
): Promise<string[]> {
  let lastError: Error | null = null;
  for (const node of hiveNodes) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[username]],
          id: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        result?: Array<{
          posting?: { key_auths?: Array<[string, number]> };
        }>;
        error?: { message: string };
      };
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const account = data.result?.[0];
      if (!account) {
        throw new Error(`Account @${username} not found on chain`);
      }

      const keyAuths = account.posting?.key_auths;
      if (!keyAuths || keyAuths.length === 0) {
        throw new Error(`Account @${username} has no posting key authorities`);
      }

      return keyAuths.map(([key]) => key);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    `Could not resolve posting keys for @${username}: ${lastError?.message || 'all nodes failed'}`,
  );
}

/**
 * Verify that a signature was produced by the posting key of the given account.
 *
 * @param username - Hive account name
 * @param message - The original message that was signed (challenge string)
 * @param signatureHex - The hex-encoded signature from Keychain
 * @param hiveNodes - List of Hive API nodes to query
 * @returns true if the signature is valid for the account's posting key
 */
export async function verifyPostingSignature(
  username: string,
  message: string,
  signatureHex: string,
  hiveNodes: string[],
): Promise<boolean> {
  const postingKeys = await resolvePostingKeys(username, hiveNodes);

  // Hash the message the same way Keychain does
  const msgHash = createHash('sha256').update(message, 'utf-8').digest();

  try {
    const sig = Signature.from(signatureHex);
    const recoveredKey = sig.getPublicKey(msgHash);
    const recoveredKeyStr = recoveredKey.toString();

    return postingKeys.some(key => key === recoveredKeyStr);
  } catch {
    return false;
  }
}
