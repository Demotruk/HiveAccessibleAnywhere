/**
 * Transaction assembly and local signing.
 *
 * All signing happens client-side — private keys never leave the device.
 */

import { Transaction, config as hiveTxConfig } from 'hive-tx';
import { getClient } from './client';
import type { HiveOperation } from './operations';
import type { KeyPair } from './keys';

/**
 * Build, sign, and broadcast a transaction containing the given operations.
 *
 * Uses hive-tx's Transaction class which handles:
 * - Fetching dynamic global properties for the reference block
 * - Setting expiration
 * - Serialization and signing
 * - Broadcasting
 *
 * Retries across all endpoints from HiveClient on failure, since hive-tx
 * only uses a single node internally with no failover.
 */
export async function signAndBroadcast(
  operations: HiveOperation[],
  key: KeyPair,
): Promise<{ tx_id: string; status: string }> {
  const client = getClient();
  const endpoints = client.getEndpoints();
  let lastError: Error | undefined;

  for (let i = 0; i < endpoints.length; i++) {
    hiveTxConfig.nodes = [endpoints[i]];
    try {
      const tx = new Transaction();

      for (const [opName, opBody] of operations) {
        await tx.addOperation(opName as any, opBody as any);
      }

      tx.sign(key.private);
      const result = await tx.broadcast(true);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Broadcast via ${endpoints[i]} failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error('All RPC endpoints failed');
}
