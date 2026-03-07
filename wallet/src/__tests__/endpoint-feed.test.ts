import { describe, it, expect, vi } from 'vitest';

// Mock hive-tx before importing modules that depend on it
vi.mock('hive-tx', () => ({
  config: { nodes: [] },
  Memo: { decode: vi.fn(), encode: vi.fn() },
}));

import { isValidPayload } from '../discovery/endpoint-feed';

describe('isValidPayload', () => {
  it('accepts a valid payload', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: ['https://proxy1.example.com'],
      expires: '2030-01-01T00:00:00Z',
    })).toBe(true);
  });

  it('accepts payload with multiple endpoints', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: ['https://a.example.com', 'https://b.example.com'],
      expires: '2030-12-31T23:59:59Z',
    })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidPayload(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidPayload('string')).toBe(false);
    expect(isValidPayload(42)).toBe(false);
    expect(isValidPayload(undefined)).toBe(false);
  });

  it('rejects missing v', () => {
    expect(isValidPayload({
      endpoints: ['https://a.example.com'],
      expires: '2030-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('rejects non-number v', () => {
    expect(isValidPayload({
      v: '1',
      endpoints: ['https://a.example.com'],
      expires: '2030-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('rejects empty endpoints array', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: [],
      expires: '2030-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('rejects non-array endpoints', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: 'https://a.example.com',
      expires: '2030-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('rejects endpoints with non-string items', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: [123],
      expires: '2030-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('rejects missing expires', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: ['https://a.example.com'],
    })).toBe(false);
  });

  it('rejects non-string expires', () => {
    expect(isValidPayload({
      v: 1,
      endpoints: ['https://a.example.com'],
      expires: 12345,
    })).toBe(false);
  });
});
