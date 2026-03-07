import { describe, it, expect, vi } from 'vitest';

// Mock hive-tx before importing modules that depend on it
vi.mock('hive-tx', () => ({
  PrivateKey: { from: vi.fn() },
  PublicKey: {},
  config: { nodes: [] },
}));

import { parseAsset, formatAsset, matchKeyRole } from '../hive/keys';
import type { HiveAccount } from '../hive/client';

describe('parseAsset', () => {
  it('parses HIVE asset', () => {
    expect(parseAsset('1.234 HIVE')).toEqual({ amount: 1.234, symbol: 'HIVE' });
  });

  it('parses HBD asset', () => {
    expect(parseAsset('100.000 HBD')).toEqual({ amount: 100, symbol: 'HBD' });
  });

  it('parses zero amount', () => {
    expect(parseAsset('0.000 HIVE')).toEqual({ amount: 0, symbol: 'HIVE' });
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseAsset('  5.500 HBD  ')).toEqual({ amount: 5.5, symbol: 'HBD' });
  });

  it('throws on invalid format (no space)', () => {
    expect(() => parseAsset('1.234HIVE')).toThrow('Invalid asset format');
  });

  it('throws on invalid format (extra parts)', () => {
    expect(() => parseAsset('1.234 HIVE extra')).toThrow('Invalid asset format');
  });
});

describe('formatAsset', () => {
  it('formats HIVE with 3 decimal places', () => {
    expect(formatAsset(1.2, 'HIVE')).toBe('1.200 HIVE');
  });

  it('formats HBD with 3 decimal places', () => {
    expect(formatAsset(100, 'HBD')).toBe('100.000 HBD');
  });

  it('rounds to 3 decimal places', () => {
    expect(formatAsset(1.23456, 'HIVE')).toBe('1.235 HIVE');
  });

  it('formats zero', () => {
    expect(formatAsset(0, 'HBD')).toBe('0.000 HBD');
  });
});

describe('matchKeyRole', () => {
  const mockAccount: HiveAccount = {
    name: 'testuser',
    balance: '10.000 HIVE',
    hbd_balance: '5.000 HBD',
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '0.000 HBD',
    savings_withdraw_requests: 0,
    memo_key: 'STM_MEMO_PUB_KEY',
    active: { key_auths: [['STM_ACTIVE_PUB_KEY', 1]] },
    posting: { key_auths: [['STM_POSTING_PUB_KEY', 1]] },
    owner: { key_auths: [['STM_OWNER_PUB_KEY', 1]] },
  };

  it('matches active key', () => {
    const pubKey = { toString: () => 'STM_ACTIVE_PUB_KEY' } as any;
    expect(matchKeyRole(pubKey, mockAccount)).toBe('active');
  });

  it('matches posting key', () => {
    const pubKey = { toString: () => 'STM_POSTING_PUB_KEY' } as any;
    expect(matchKeyRole(pubKey, mockAccount)).toBe('posting');
  });

  it('matches owner key', () => {
    const pubKey = { toString: () => 'STM_OWNER_PUB_KEY' } as any;
    expect(matchKeyRole(pubKey, mockAccount)).toBe('owner');
  });

  it('matches memo key', () => {
    const pubKey = { toString: () => 'STM_MEMO_PUB_KEY' } as any;
    expect(matchKeyRole(pubKey, mockAccount)).toBe('memo');
  });

  it('returns null for unrecognized key', () => {
    const pubKey = { toString: () => 'STM_UNKNOWN_KEY' } as any;
    expect(matchKeyRole(pubKey, mockAccount)).toBeNull();
  });

  it('handles multi-sig active keys', () => {
    const multiSigAccount: HiveAccount = {
      ...mockAccount,
      active: { key_auths: [['STM_KEY_A', 1], ['STM_KEY_B', 1]] },
    };
    const pubKey = { toString: () => 'STM_KEY_B' } as any;
    expect(matchKeyRole(pubKey, multiSigAccount)).toBe('active');
  });
});
