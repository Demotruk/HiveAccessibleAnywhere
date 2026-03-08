import { describe, it, expect } from 'vitest';
import { PrivateKey } from 'hive-tx';
import {
  generateToken,
  generatePin,
  encryptPayload,
  decryptPayload,
  merkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  encodeMerkleProof,
  decodeMerkleProof,
  hashToken,
  signCardData,
  verifyCardSignature,
  type GiftCardPayload,
} from '../crypto/signing.js';

describe('Token generation', () => {
  it('generates a 64-char hex token (32 bytes)', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('PIN generation', () => {
  it('generates a 6-character PIN', () => {
    const pin = generatePin();
    expect(pin).toHaveLength(6);
  });

  it('uses only non-ambiguous characters', () => {
    // No 0, O, 1, I, L
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 50; i++) {
      const pin = generatePin();
      for (const ch of pin) {
        expect(validChars).toContain(ch);
      }
    }
  });

  it('generates unique PINs (high probability)', () => {
    const pins = new Set<string>();
    for (let i = 0; i < 50; i++) {
      pins.add(generatePin());
    }
    // With 31^6 = ~887M possibilities, 50 should all be unique
    expect(pins.size).toBe(50);
  });
});

describe('PIN encryption / decryption', () => {
  const testPayload: GiftCardPayload = {
    token: 'a'.repeat(64),
    provider: 'testprovider',
    serviceUrl: 'https://example.com',
    endpoints: ['https://proxy1.example.com', 'https://proxy2.example.com'],
    batchId: 'batch-test-001',
    expires: '2027-01-01T00:00:00Z',
    signature: 'sig-placeholder',
    promiseType: 'account-creation',
  };

  it('roundtrips encrypt/decrypt with correct PIN', () => {
    const pin = 'ABC123';
    const blob = encryptPayload(testPayload, pin);
    const decrypted = decryptPayload(blob, pin);

    expect(decrypted.token).toBe(testPayload.token);
    expect(decrypted.provider).toBe(testPayload.provider);
    expect(decrypted.serviceUrl).toBe(testPayload.serviceUrl);
    expect(decrypted.endpoints).toEqual(testPayload.endpoints);
    expect(decrypted.batchId).toBe(testPayload.batchId);
    expect(decrypted.expires).toBe(testPayload.expires);
    expect(decrypted.signature).toBe(testPayload.signature);
    expect(decrypted.promiseType).toBe(testPayload.promiseType);
  });

  it('roundtrips promiseParams through encrypt/decrypt', () => {
    const payloadWithParams: GiftCardPayload = {
      ...testPayload,
      promiseType: 'transfer',
      promiseParams: { amount: '10.000 HIVE' },
    };
    const blob = encryptPayload(payloadWithParams, 'TESTPN');
    const decrypted = decryptPayload(blob, 'TESTPN');
    expect(decrypted.promiseType).toBe('transfer');
    expect(decrypted.promiseParams).toEqual({ amount: '10.000 HIVE' });
  });

  it('produces base64url-encoded output (no +, /, or =)', () => {
    const blob = encryptPayload(testPayload, 'TESTPIN');
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('throws on wrong PIN', () => {
    const blob = encryptPayload(testPayload, 'RIGHT1');
    expect(() => decryptPayload(blob, 'WRONG1')).toThrow();
  });

  it('throws on corrupted data', () => {
    const blob = encryptPayload(testPayload, 'PIN123');
    const corrupted = blob.slice(0, -4) + 'XXXX';
    expect(() => decryptPayload(corrupted, 'PIN123')).toThrow();
  });

  it('throws on too-short data', () => {
    expect(() => decryptPayload('short', 'PIN')).toThrow('too short');
  });

  it('produces different ciphertexts for same input (random salt/iv)', () => {
    const blob1 = encryptPayload(testPayload, 'SAMEPIN');
    const blob2 = encryptPayload(testPayload, 'SAMEPIN');
    expect(blob1).not.toBe(blob2); // Different salt and IV each time
  });
});

describe('Merkle tree', () => {
  it('returns empty string for empty token list', () => {
    expect(merkleRoot([])).toBe('');
  });

  it('returns consistent hash for single token', () => {
    const root1 = merkleRoot(['token-aaa']);
    const root2 = merkleRoot(['token-aaa']);
    expect(root1).toBe(root2);
    expect(root1).toHaveLength(64); // SHA-256 hex
  });

  it('returns consistent hash regardless of input order', () => {
    const root1 = merkleRoot(['token-a', 'token-b', 'token-c']);
    const root2 = merkleRoot(['token-c', 'token-a', 'token-b']);
    expect(root1).toBe(root2); // Sorted internally
  });

  it('produces different roots for different token sets', () => {
    const root1 = merkleRoot(['token-a', 'token-b']);
    const root2 = merkleRoot(['token-a', 'token-c']);
    expect(root1).not.toBe(root2);
  });

  it('handles odd number of tokens', () => {
    const root = merkleRoot(['t1', 't2', 't3']);
    expect(root).toHaveLength(64);
  });

  it('handles power-of-two number of tokens', () => {
    const root = merkleRoot(['t1', 't2', 't3', 't4']);
    expect(root).toHaveLength(64);
  });
});

describe('Merkle proofs', () => {
  it('generates valid proof for a single token', () => {
    const tokens = ['single-token'];
    const root = merkleRoot(tokens);
    const proof = generateMerkleProof(tokens, 'single-token');
    expect(proof).toHaveLength(0); // Root IS the token hash
    expect(verifyMerkleProof(hashToken('single-token').toString('hex'), proof, root)).toBe(true);
  });

  it('generates valid proof for two tokens', () => {
    const tokens = ['token-a', 'token-b'];
    const root = merkleRoot(tokens);
    for (const token of tokens) {
      const proof = generateMerkleProof(tokens, token);
      expect(proof).toHaveLength(1);
      expect(verifyMerkleProof(hashToken(token).toString('hex'), proof, root)).toBe(true);
    }
  });

  it('generates valid proof for odd number of tokens', () => {
    const tokens = ['t1', 't2', 't3'];
    const root = merkleRoot(tokens);
    for (const token of tokens) {
      const proof = generateMerkleProof(tokens, token);
      expect(verifyMerkleProof(hashToken(token).toString('hex'), proof, root)).toBe(true);
    }
  });

  it('generates valid proof for power-of-two tokens', () => {
    const tokens = ['a', 'b', 'c', 'd'];
    const root = merkleRoot(tokens);
    for (const token of tokens) {
      const proof = generateMerkleProof(tokens, token);
      expect(verifyMerkleProof(hashToken(token).toString('hex'), proof, root)).toBe(true);
    }
  });

  it('generates valid proof for 5, 7, and 10 tokens', () => {
    for (const count of [5, 7, 10]) {
      const tokens = Array.from({ length: count }, (_, i) => `token-${i}`);
      const root = merkleRoot(tokens);
      for (const token of tokens) {
        const proof = generateMerkleProof(tokens, token);
        expect(verifyMerkleProof(hashToken(token).toString('hex'), proof, root)).toBe(true);
      }
    }
  });

  it('proof is order-independent (tokens sorted internally)', () => {
    const tokens = ['z-token', 'a-token', 'm-token'];
    const shuffled = ['m-token', 'z-token', 'a-token'];
    const proof1 = generateMerkleProof(tokens, 'a-token');
    const proof2 = generateMerkleProof(shuffled, 'a-token');
    expect(proof1).toEqual(proof2);
  });

  it('proof fails against wrong root', () => {
    const tokens = ['t1', 't2', 't3'];
    const proof = generateMerkleProof(tokens, 't1');
    const wrongRoot = merkleRoot(['x1', 'x2', 'x3']);
    expect(verifyMerkleProof(hashToken('t1').toString('hex'), proof, wrongRoot)).toBe(false);
  });

  it('throws for token not in the set', () => {
    const tokens = ['t1', 't2', 't3'];
    expect(() => generateMerkleProof(tokens, 'not-here')).toThrow('not found');
  });

  it('throws for empty token list', () => {
    expect(() => generateMerkleProof([], 'any')).toThrow('empty');
  });

  it('roundtrips through encrypt/decrypt preserving compact merkleProof', () => {
    const tokens = ['tok-a', 'tok-b', 'tok-c'];
    const proof = generateMerkleProof(tokens, 'tok-b');
    const compact = encodeMerkleProof(proof);
    const payload: GiftCardPayload = {
      token: 'a'.repeat(64),
      provider: 'testprovider',
      serviceUrl: 'https://example.com',
      endpoints: [],
      batchId: 'batch-test',
      expires: '2027-01-01T00:00:00Z',
      signature: 'sig',
      promiseType: 'account-creation',
      merkleProof: compact,
    };
    const blob = encryptPayload(payload, 'TESTPN');
    const decrypted = decryptPayload(blob, 'TESTPN');
    expect(decrypted.merkleProof).toBe(compact);
    // Decoded proof should match original
    expect(decodeMerkleProof(decrypted.merkleProof!)).toEqual(proof);
  });

  it('encode/decode roundtrips correctly', () => {
    const tokens = Array.from({ length: 10 }, (_, i) => `token-${i}`);
    for (const token of tokens) {
      const proof = generateMerkleProof(tokens, token);
      const compact = encodeMerkleProof(proof);
      const decoded = decodeMerkleProof(compact);
      expect(decoded).toEqual(proof);
    }
  });
});

describe('Authenticity signing', () => {
  // Use a known hive-tx test key pair
  // These are a valid Hive key pair for testing
  const testWif = '5JRaypasxMx1L97ZUX7YuC5Psb5EAbF821kkAGtBj7xCJFQcbLg';
  // The corresponding public key can be derived, but for the test we just need roundtrip

  it('sign and verify roundtrips correctly', () => {
    const token = generateToken();
    const batchId = 'test-batch-123';
    const provider = 'testprovider';
    const expires = '2027-01-01T00:00:00Z';
    const promiseType = 'account-creation';

    const signature = signCardData(token, batchId, provider, expires, promiseType, testWif);
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe('string');

    // Derive the public key from the private key to verify
    const privKey = PrivateKey.from(testWif);
    const pubKey = privKey.createPublic().toString();

    const valid = verifyCardSignature(token, batchId, provider, expires, promiseType, signature, pubKey);
    expect(valid).toBe(true);
  });

  it('rejects signature with wrong data', () => {
    const token = generateToken();
    const batchId = 'test-batch-456';
    const provider = 'testprovider';
    const expires = '2027-01-01T00:00:00Z';
    const promiseType = 'account-creation';

    const signature = signCardData(token, batchId, provider, expires, promiseType, testWif);

    const privKey = PrivateKey.from(testWif);
    const pubKey = privKey.createPublic().toString();

    // Tamper with the data
    const valid = verifyCardSignature(token, batchId, 'wrongprovider', expires, promiseType, signature, pubKey);
    expect(valid).toBe(false);
  });

  it('rejects signature with wrong key', () => {
    const token = generateToken();
    const batchId = 'test-batch-789';
    const provider = 'testprovider';
    const expires = '2027-01-01T00:00:00Z';
    const promiseType = 'account-creation';

    const signature = signCardData(token, batchId, provider, expires, promiseType, testWif);

    // Use a different key pair
    const otherWif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
    const otherKey = PrivateKey.from(otherWif);
    const otherPubKey = otherKey.createPublic().toString();

    const valid = verifyCardSignature(token, batchId, provider, expires, promiseType, signature, otherPubKey);
    expect(valid).toBe(false);
  });

  it('different promise types produce different signatures', () => {
    const token = generateToken();
    const batchId = 'test-batch-pt';
    const provider = 'testprovider';
    const expires = '2027-01-01T00:00:00Z';

    const sig1 = signCardData(token, batchId, provider, expires, 'account-creation', testWif);
    const sig2 = signCardData(token, batchId, provider, expires, 'transfer', testWif);
    expect(sig1).not.toBe(sig2);
  });
});
