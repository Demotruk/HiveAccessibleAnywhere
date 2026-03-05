/**
 * Deobfuscation middleware for the proxy server.
 *
 * Detects obfuscated requests (by the X-Api-Version header),
 * decodes the wrapped JSON-RPC payload, processes it through
 * the normal relay, and wraps the response back in the
 * obfuscation format.
 *
 * Protocol (v1):
 *   Request body:  { "q": "<base64(gzip(jsonrpc))>", "sid": "<random>" }
 *   Response body: { "ok": true, "data": { "r": "<base64(gzip(jsonrpc_response))>" } }
 *   Detection:     X-Api-Version: 1 header present
 */

import type { Request, Response, NextFunction } from 'express';
import { createGunzip, gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';

/**
 * Check if a request is obfuscated (has X-Api-Version header).
 */
export function isObfuscated(req: Request): boolean {
  return req.headers['x-api-version'] === '1';
}

/**
 * Decode the obfuscated request body into the original JSON-RPC payload.
 */
function decodePayload(body: { q?: string; sid?: string }): unknown {
  if (!body.q || typeof body.q !== 'string') {
    throw new Error('Missing or invalid payload');
  }

  // base64 → binary
  const compressed = Buffer.from(body.q, 'base64');

  // gzip decompress (synchronous for simplicity — payloads are small)
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gunzip = createGunzip();
    const stream = Readable.from(compressed);
    stream.pipe(gunzip);
    gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gunzip.on('end', () => {
      try {
        const json = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(json));
      } catch (e) {
        reject(new Error('Failed to parse decompressed payload'));
      }
    });
    gunzip.on('error', (e) => reject(e));
  });
}

/**
 * Encode a JSON-RPC response into the obfuscated response format.
 */
function encodeResponse(data: unknown): string {
  const json = JSON.stringify(data);
  const compressed = gzipSync(Buffer.from(json, 'utf-8'));
  const encoded = compressed.toString('base64');
  return JSON.stringify({
    ok: true,
    data: { r: encoded },
  });
}

/**
 * Express middleware that intercepts obfuscated requests on any POST route.
 *
 * If the request has X-Api-Version: 1, it:
 * 1. Decodes the obfuscated body into JSON-RPC
 * 2. Replaces req.body with the decoded payload
 * 3. Intercepts the response to wrap it in the obfuscation format
 * 4. Forwards to the relay handler
 */
export function deobfuscateMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isObfuscated(req)) {
      next();
      return;
    }

    try {
      // Decode the obfuscated body
      const decoded = await decodePayload(req.body);
      req.body = decoded;

      // Intercept the response
      const originalJson = res.json.bind(res);
      res.json = function (body: unknown) {
        const wrapped = encodeResponse(body);
        res.type('application/json');
        res.send(wrapped);
        return res;
      };

      next();
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: 'Invalid request format',
      });
    }
  };
}
