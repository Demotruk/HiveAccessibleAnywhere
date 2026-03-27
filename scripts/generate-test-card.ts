/**
 * Generate a single test gift card for local invite app testing.
 *
 * Usage:
 *   npx tsx scripts/generate-test-card.ts [--base-url <url>]
 *
 * Default base URL: https://localhost:5176
 *
 * Outputs:
 *   - PIN (to enter in the invite app)
 *   - Full URL (to open in a browser)
 *   - Provider account (whose memo key signed the card)
 *
 * The card uses demotruktest27 as the provider — its memo key is on-chain,
 * so the invite app can verify the signature.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(import.meta.dirname, '.env') });

import {
  generateToken,
  generatePin,
  signCardData,
  encryptPayload,
  merkleRoot,
  generateMerkleProof,
  encodeMerkleProof,
  type GiftCardPayload,
} from '../giftcard/src/crypto/signing.js';

const baseUrl = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'https://localhost:5176';

const provider = 'demotruktest27';
const memoKeyWif = process.env.HAA_TEST_USER1_MEMO_KEY!;

if (!memoKeyWif) {
  console.error('Missing HAA_TEST_USER1_MEMO_KEY in scripts/.env');
  process.exit(1);
}

const token = generateToken();
const pin = generatePin();
const batchId = 'test-local-001';
const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const promiseType = 'account-creation';

const signature = signCardData(token, batchId, provider, expires, promiseType, memoKeyWif);

// Merkle proof (single-token batch)
const root = merkleRoot([token]);
const proof = generateMerkleProof([token], token);
const merkleProof = encodeMerkleProof(proof);

const payload: GiftCardPayload = {
  token,
  provider,
  serviceUrl: 'https://localhost:3200',
  endpoints: [],
  batchId,
  expires,
  signature,
  promiseType,
  merkleProof,
  variant: 'standard',
};

const encryptedBlob = encryptPayload(payload, pin);
const url = `${baseUrl}/invite/#${encryptedBlob}`;

console.log('');
console.log('=== Test Gift Card ===');
console.log(`Provider:  ${provider}`);
console.log(`PIN:       ${pin}`);
console.log(`Expires:   ${expires}`);
console.log(`Token:     ${token.slice(0, 16)}...`);
console.log('');
console.log(`URL:\n${url}`);
console.log('');
