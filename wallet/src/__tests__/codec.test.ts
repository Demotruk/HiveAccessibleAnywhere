import { describe, it, expect } from 'vitest';
import { encodeRequest, decodeResponse } from '../obfuscation/codec';
import type { JsonRpcRequest } from '../hive/client';

describe('obfuscation codec', () => {
  const sampleRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'condenser_api.get_accounts',
    params: [['testuser']],
    id: 1,
  };

  describe('encodeRequest', () => {
    it('returns path, body, and headers', async () => {
      const result = await encodeRequest(sampleRequest);
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('headers');
    });

    it('uses one of the predefined API paths', async () => {
      const validPaths = ['/api/comments', '/api/search', '/api/posts', '/api/feed'];
      const result = await encodeRequest(sampleRequest);
      expect(validPaths).toContain(result.path);
    });

    it('body contains q and sid fields', async () => {
      const result = await encodeRequest(sampleRequest);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('q');
      expect(body).toHaveProperty('sid');
      expect(typeof body.q).toBe('string');
      expect(typeof body.sid).toBe('string');
    });

    it('sets X-Api-Version header to 1', async () => {
      const result = await encodeRequest(sampleRequest);
      expect(result.headers['X-Api-Version']).toBe('1');
    });

    it('sets Content-Type to application/json', async () => {
      const result = await encodeRequest(sampleRequest);
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('generates different sid on each call', async () => {
      const r1 = await encodeRequest(sampleRequest);
      const r2 = await encodeRequest(sampleRequest);
      const sid1 = JSON.parse(r1.body).sid;
      const sid2 = JSON.parse(r2.body).sid;
      expect(sid1).not.toBe(sid2);
    });
  });

  describe('encodeRequest + decodeResponse round-trip', async () => {
    // Build a valid obfuscated response by encoding the request's expected result
    // and wrapping it in the response envelope
    it('round-trips a JSON-RPC response through encode/decode', async () => {
      const rpcResponse = {
        jsonrpc: '2.0' as const,
        result: [{ name: 'testuser', balance: '10.000 HIVE' }],
        id: 1,
      };

      // Manually encode the response the same way the proxy would
      const json = JSON.stringify(rpcResponse);
      const blob = new Blob([new TextEncoder().encode(json)]);
      const compressed = await new Response(
        blob.stream().pipeThrough(new CompressionStream('gzip'))
      ).arrayBuffer();
      const bytes = new Uint8Array(compressed);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);

      const envelope = JSON.stringify({ ok: true, data: { r: b64 } });
      const decoded = await decodeResponse(envelope);

      expect(decoded).toEqual(rpcResponse);
    });
  });

  describe('decodeResponse', () => {
    it('throws on error envelope', async () => {
      const envelope = JSON.stringify({ ok: false, error: 'bad request' });
      await expect(decodeResponse(envelope)).rejects.toThrow('bad request');
    });

    it('throws on missing data.r', async () => {
      const envelope = JSON.stringify({ ok: true, data: {} });
      await expect(decodeResponse(envelope)).rejects.toThrow();
    });
  });
});
