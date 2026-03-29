/**
 * Broadcast a batch declaration custom_json to the Hive blockchain.
 *
 * Extracted from scripts/giftcard-generate.ts for use by the giftcard service.
 */

import { Transaction, PrivateKey } from 'hive-tx';

/**
 * Broadcast a batch declaration on-chain.
 *
 * @param providerAccount - The Hive account to list as required_auths (the issuer)
 * @param activeKeyWif - Active key (WIF) to sign the transaction.
 *   In multi-tenant mode, this is the service account's key (with delegated authority).
 * @param batchId - Unique batch identifier
 * @param count - Number of tokens in the batch
 * @param expires - Expiry date (ISO 8601)
 * @param merkleRoot - Merkle root hash of all token hashes
 * @param promiseType - Promise type (e.g. 'account-creation')
 * @param promiseParams - Optional type-specific parameters
 * @returns Transaction ID
 */
export async function declareOnChain(
  providerAccount: string,
  activeKeyWif: string,
  batchId: string,
  count: number,
  expires: string,
  merkleRoot: string,
  promiseType: string,
  promiseParams?: Record<string, unknown>,
): Promise<string> {
  const payload: Record<string, unknown> = {
    batch_id: batchId,
    count,
    expires,
    merkle_root: merkleRoot,
    promise_type: promiseType,
  };
  if (promiseParams && Object.keys(promiseParams).length > 0) {
    payload.promise_params = promiseParams;
  }

  const tx = new Transaction();
  await tx.addOperation('custom_json' as any, {
    required_auths: [providerAccount],
    required_posting_auths: [],
    id: 'propolis_giftcard_batch',
    json: JSON.stringify(payload),
  } as any);

  const key = PrivateKey.from(activeKeyWif);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result.tx_id;
}
