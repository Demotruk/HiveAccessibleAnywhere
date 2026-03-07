import { describe, it, expect } from 'vitest';
import { parseQrPayload } from '../ui/components/qr-scanner';

describe('parseQrPayload', () => {
  // -- Combined propolis format --

  it('parses combined format with all fields', () => {
    const raw = 'propolis://login?a=alice&k=5JactiveKey123456789012345678901234567890123&m=5JmemoKey1234567890123456789012345678901234567';
    const result = parseQrPayload(raw);
    expect(result).toEqual({
      type: 'combined',
      account: 'alice',
      activeWif: '5JactiveKey123456789012345678901234567890123',
      memoWif: '5JmemoKey1234567890123456789012345678901234567',
    });
  });

  it('parses combined format without memo key', () => {
    const raw = 'propolis://login?a=bob&k=5JactiveKey123456789012345678901234567890123';
    const result = parseQrPayload(raw);
    expect(result).toEqual({
      type: 'combined',
      account: 'bob',
      activeWif: '5JactiveKey123456789012345678901234567890123',
      memoWif: undefined,
    });
  });

  it('returns unknown for combined format missing account', () => {
    const raw = 'propolis://login?k=5JactiveKey123456789012345678901234567890123';
    expect(parseQrPayload(raw).type).toBe('unknown');
  });

  it('returns unknown for combined format missing active key', () => {
    const raw = 'propolis://login?a=alice';
    expect(parseQrPayload(raw).type).toBe('unknown');
  });

  it('trims whitespace before parsing', () => {
    const raw = '  propolis://login?a=alice&k=5Jkey12345678901234567890123456789012345678901  ';
    const result = parseQrPayload(raw);
    expect(result.type).toBe('combined');
  });

  // -- Plain WIF keys --

  it('parses a valid WIF key (51 chars, starts with 5, base58)', () => {
    const wif = '5JL3kZxfUdyDngtokLTauRYeS9aZfmi1VG85QmojznV2wsbb71J';
    const result = parseQrPayload(wif);
    expect(result).toEqual({ type: 'wif', key: wif });
  });

  it('rejects WIF that does not start with 5', () => {
    const wif = '6JL3kZxfUdyDngtokLTauRYeS9aZfmi1VG85QmojznV2wsbb71J';
    expect(parseQrPayload(wif).type).toBe('unknown');
  });

  it('rejects WIF with wrong length', () => {
    expect(parseQrPayload('5JL3kZxfUdyDngtok').type).toBe('unknown');
  });

  it('rejects WIF with non-base58 characters (0, O, I, l)', () => {
    // Contains '0' which is not in base58
    const bad = '50L3kZxfUdyDngtokLTauRYeS9aZfmi1VG85QmojznV2wsbb71J';
    expect(parseQrPayload(bad).type).toBe('unknown');
  });

  // -- Unknown formats --

  it('returns unknown for random text', () => {
    expect(parseQrPayload('hello world').type).toBe('unknown');
  });

  it('returns unknown for a URL', () => {
    expect(parseQrPayload('https://example.com').type).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(parseQrPayload('').type).toBe('unknown');
  });
});
