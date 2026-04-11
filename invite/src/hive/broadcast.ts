/**
 * Hive transaction broadcasting for the invite app.
 *
 * Signs and broadcasts operations using hive-tx. Tries proxy endpoints
 * first (if provided), then falls back to public Hive API nodes.
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';

const PUBLIC_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

/**
 * Sign and broadcast one or more operations to the Hive blockchain.
 *
 * @param operations Array of [operationName, operationBody] tuples
 * @param wif WIF-encoded private key to sign with
 * @param endpoints Optional proxy/custom endpoints to try first
 * @returns Broadcast result with tx_id
 */
export async function signAndBroadcast(
  operations: [string, Record<string, unknown>][],
  wif: string,
  endpoints: string[] = [],
): Promise<{ tx_id: string }> {
  const nodes = endpoints.length > 0
    ? [...endpoints, ...PUBLIC_NODES]
    : PUBLIC_NODES;

  let lastError: Error | undefined;

  for (const node of nodes) {
    hiveTxConfig.nodes = [node];
    try {
      const tx = new Transaction();
      for (const [opName, opBody] of operations) {
        await tx.addOperation(opName as any, opBody as any);
      }
      const key = PrivateKey.from(wif);
      tx.sign(key);
      const result = await tx.broadcast(true);
      return { tx_id: result.tx_id };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('All RPC endpoints failed');
}
