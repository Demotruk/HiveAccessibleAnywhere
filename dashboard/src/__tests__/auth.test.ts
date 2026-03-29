/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isKeychainAvailable, signChallenge } from '../auth.js';

describe('auth', () => {
  beforeEach(() => {
    delete (window as any).hive_keychain;
  });

  it('isKeychainAvailable returns false when not present', () => {
    expect(isKeychainAvailable()).toBe(false);
  });

  it('isKeychainAvailable returns true when present', () => {
    (window as any).hive_keychain = { requestSignBuffer: vi.fn() };
    expect(isKeychainAvailable()).toBe(true);
  });

  it('signChallenge resolves with signature on success', async () => {
    const mockKeychain = {
      requestSignBuffer: vi.fn((_user: string, _msg: string, _role: string, cb: Function) => {
        cb({ success: true, result: 'hex-signature' });
      }),
    };
    (window as any).hive_keychain = mockKeychain;

    const sig = await signChallenge('alice', 'challenge123');
    expect(sig).toBe('hex-signature');
    expect(mockKeychain.requestSignBuffer).toHaveBeenCalledWith(
      'alice', 'challenge123', 'Posting', expect.any(Function),
    );
  });

  it('signChallenge rejects on failure', async () => {
    (window as any).hive_keychain = {
      requestSignBuffer: vi.fn((_u: string, _m: string, _r: string, cb: Function) => {
        cb({ success: false, result: '', error: 'User cancelled' });
      }),
    };

    await expect(signChallenge('alice', 'ch')).rejects.toThrow('User cancelled');
  });
});
