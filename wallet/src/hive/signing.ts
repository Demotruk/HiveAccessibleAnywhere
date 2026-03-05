/**
 * Transaction assembly and local signing.
 *
 * All signing happens client-side — private keys never leave the device.
 */

import { Transaction } from 'hive-tx';
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
 * Note: hive-tx uses its internal config.node for RPC calls, which we keep
 * in sync via the HiveClient singleton (see client.ts).
 */
export async function signAndBroadcast(
  operations: HiveOperation[],
  key: KeyPair,
): Promise<{ tx_id: string; status: string }> {
  const tx = new Transaction();

  // addOperation is async — it fetches dynamic global properties
  // on the first call to set up the reference block
  for (const [opName, opBody] of operations) {
    await tx.addOperation(opName, opBody);
  }

  // Sign locally — private key never leaves the device
  tx.sign(key.private);

  // Broadcast and wait for confirmation
  const result = await tx.broadcast(true);
  return result;
}
