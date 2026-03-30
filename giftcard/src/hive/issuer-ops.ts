/**
 * Hive blockchain operations for issuer onboarding.
 *
 * - Check whether a user has delegated active authority to the service account
 * - Fetch pending claimed account token count
 * - Send approval notification transfer with encrypted memo
 */

import { Transaction, PrivateKey } from 'hive-tx';

interface AccountData {
  name: string;
  pending_claimed_accounts: number;
  active: {
    weight_threshold: number;
    account_auths: [string, number][];
    key_auths: [string, number][];
  };
}

/**
 * Fetch a Hive account's data from the chain.
 */
async function fetchAccount(
  username: string,
  hiveNodes: string[],
): Promise<AccountData> {
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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as {
        result?: AccountData[];
        error?: { message: string };
      };
      if (data.error) throw new Error(`RPC error: ${data.error.message}`);
      if (!data.result?.[0]) throw new Error(`Account @${username} not found`);

      return data.result[0];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(`Could not fetch @${username}: ${lastError?.message || 'all nodes failed'}`);
}

/**
 * Check if the service account's public key is in a user's active authority key_auths.
 */
export async function checkActiveDelegation(
  username: string,
  servicePublicKey: string,
  hiveNodes: string[],
): Promise<boolean> {
  const account = await fetchAccount(username, hiveNodes);
  return account.active.key_auths.some(([key]) => key === servicePublicKey);
}

/**
 * Get account info relevant for issuer setup status.
 */
export async function getIssuerAccountInfo(
  username: string,
  servicePublicKey: string,
  hiveNodes: string[],
): Promise<{
  delegated: boolean;
  pendingTokens: number;
}> {
  const account = await fetchAccount(username, hiveNodes);
  const delegated = account.active.key_auths.some(([key]) => key === servicePublicKey);
  return {
    delegated,
    pendingTokens: account.pending_claimed_accounts ?? 0,
  };
}

/**
 * Send a small HBD transfer with an encrypted memo as an approval notification.
 *
 * The memo is prefixed with '#' to trigger Hive memo encryption (using the
 * sender's memo key + receiver's memo public key).
 */
export async function sendApprovalNotification(
  serviceAccount: string,
  serviceActiveKey: string,
  issuerUsername: string,
  memoText: string,
  hiveNodes: string[],
): Promise<string> {
  const tx = new Transaction();
  await tx.addOperation('transfer' as any, {
    from: serviceAccount,
    to: issuerUsername,
    amount: '0.001 HBD',
    memo: `#${memoText}`,
  } as any);

  const key = PrivateKey.from(serviceActiveKey);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result.tx_id || 'unknown';
}
