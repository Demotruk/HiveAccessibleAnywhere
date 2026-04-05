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
 * Check if the service account has active authority over a user's account.
 * Checks both key_auths (direct public key) and account_auths (account name delegation).
 */
export async function checkActiveDelegation(
  username: string,
  servicePublicKey: string,
  serviceAccountName: string | undefined,
  hiveNodes: string[],
): Promise<boolean> {
  const account = await fetchAccount(username, hiveNodes);
  const keyMatch = account.active.key_auths.some(([key]) => key === servicePublicKey);
  const accountMatch = serviceAccountName
    ? account.active.account_auths.some(([name]) => name === serviceAccountName)
    : false;
  return keyMatch || accountMatch;
}

/**
 * Get account info relevant for issuer setup status.
 * Checks both key_auths and account_auths for delegation.
 */
export async function getIssuerAccountInfo(
  username: string,
  servicePublicKey: string,
  serviceAccountName: string | undefined,
  hiveNodes: string[],
): Promise<{
  delegated: boolean;
  pendingTokens: number;
}> {
  const account = await fetchAccount(username, hiveNodes);
  const keyMatch = account.active.key_auths.some(([key]) => key === servicePublicKey);
  const accountMatch = serviceAccountName
    ? account.active.account_auths.some(([name]) => name === serviceAccountName)
    : false;
  return {
    delegated: keyMatch || accountMatch,
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
  currency: 'HIVE' | 'HBD' = 'HBD',
): Promise<string> {
  const tx = new Transaction();
  await tx.addOperation('transfer' as any, {
    from: serviceAccount,
    to: issuerUsername,
    amount: `0.001 ${currency}`,
    memo: `#${memoText}`,
  } as any);

  const key = PrivateKey.from(serviceActiveKey);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result.tx_id || 'unknown';
}
