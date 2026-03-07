import { describe, it, expect, vi } from 'vitest';
import { decryptMemo, encryptMemo } from '../hive/memo';

// Mock hive-tx Memo module
vi.mock('hive-tx', () => ({
  Memo: {
    decode: vi.fn((privateKey: string, encrypted: string) => {
      // Simulate hive-tx behavior: returns plaintext with '#' prefix
      if (privateKey === 'VALID_KEY' && encrypted === '#encrypted_data') {
        return '#decrypted payload';
      }
      throw new Error('Could not decrypt memo');
    }),
    encode: vi.fn((senderKey: string, recipientPub: string, memo: string) => {
      // Simulate: returns encrypted string
      return '#encrypted_' + memo.replace('#', '');
    }),
  },
}));

describe('decryptMemo', () => {
  it('decrypts an encrypted memo and strips # prefix', () => {
    const result = decryptMemo('#encrypted_data', 'VALID_KEY');
    expect(result).toBe('decrypted payload');
  });

  it('returns unencrypted memo as-is', () => {
    const result = decryptMemo('plain text memo', 'any_key');
    expect(result).toBe('plain text memo');
  });

  it('throws on decryption failure', () => {
    expect(() => decryptMemo('#bad_data', 'WRONG_KEY')).toThrow();
  });
});

describe('encryptMemo', () => {
  it('encrypts a memo with # prefix', () => {
    const result = encryptMemo('hello', 'sender_key', 'STM_RECIPIENT_PUB');
    expect(result).toBe('#encrypted_hello');
  });
});
