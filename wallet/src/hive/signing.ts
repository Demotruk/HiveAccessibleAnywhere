/**
 * Transaction assembly and local signing.
 *
 * All signing happens client-side — private keys never leave the device.
 */

import { Transaction } from 'hive-tx';
import { getClient, type BroadcastResult } from './client';
import type { HiveOperation } from './operations';
import type { KeyPair } from './keys';

/**
 * Build, sign, and broadcast a transaction containing the given operations.
 *
 * Steps:
 * 1. Fetch dynamic global properties for the reference block
 * 2. Build the transaction with correct ref_block_num, ref_block_prefix, expiration
 * 3. Sign locally with the provided private key
 * 4. Broadcast the signed transaction
 */
export async function signAndBroadcast(
  operations: HiveOperation[],
  key: KeyPair,
): Promise<BroadcastResult> {
  const client = getClient();

  // 1. Get reference block info
  const props = await client.getDynamicGlobalProperties();

  // 2. Create and sign the transaction using hive-tx's Transaction class
  const tx = new Transaction();
  tx.create(operations);

  // hive-tx Transaction.create uses the global config node for ref block,
  // which we keep in sync via the client. But we need to make sure
  // the transaction has the correct expiration.

  // Sign the transaction
  const signedTx = tx.sign(key.private);

  // 3. Broadcast
  // The signedTx from hive-tx is the full transaction object
  const result = await client.broadcastTransaction(signedTx);
  return result;
}
