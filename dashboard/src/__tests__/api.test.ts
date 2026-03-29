import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setState, resetState } from '../state.js';

// Must mock fetch before importing api module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('__API_BASE__', '');

// Dynamic import to ensure mocks are in place
const { requestChallenge, verifyChallenge, listBatches, createBatch } = await import('../api.js');

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    blob: () => Promise.resolve(new Blob()),
  });
}

describe('api', () => {
  beforeEach(() => {
    resetState();
    mockFetch.mockReset();
  });

  it('requestChallenge sends username and returns challenge', async () => {
    mockFetch.mockReturnValue(jsonResponse({ challenge: 'abc123' }));

    const challenge = await requestChallenge('alice');
    expect(challenge).toBe('abc123');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/auth/challenge');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ username: 'alice' });
  });

  it('verifyChallenge returns JWT token', async () => {
    mockFetch.mockReturnValue(jsonResponse({ token: 'jwt-token' }));

    const token = await verifyChallenge('alice', 'challenge', 'sig');
    expect(token).toBe('jwt-token');
  });

  it('injects Authorization header when JWT is set', async () => {
    setState({ jwt: 'my-jwt' });
    mockFetch.mockReturnValue(jsonResponse({ batches: [] }));

    await listBatches();

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('createBatch sends options and returns response', async () => {
    setState({ jwt: 'token' });
    const mockResult = { batchId: 'b1', count: 5, downloads: { pdf: '/p', manifest: '/m' } };
    mockFetch.mockReturnValue(jsonResponse(mockResult));

    const result = await createBatch({ count: 5, locale: 'en' });
    expect(result.batchId).toBe('b1');
    expect(result.count).toBe(5);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(jsonResponse({ error: 'Not authorized' }, 403));

    await expect(requestChallenge('bob')).rejects.toThrow('Not authorized');
  });
});
