/**
 * Traffic obfuscation codec.
 *
 * Encodes JSON-RPC requests as normal-looking REST API traffic
 * and decodes the wrapped responses. The goal is to make Hive
 * RPC traffic indistinguishable from ordinary web API calls
 * when inspected via DPI.
 *
 * Protocol (v1):
 *   Request:  POST to random path (/api/comments, /api/search, etc.)
 *   Body:     { "q": "<base64-encoded-payload>", "sid": "<random>" }
 *   Response: { "ok": true, "data": { "r": "<base64-encoded-response>" } }
 *
 * The payload is: JSON-RPC → gzip (CompressionStream) → base64
 * The "sid" field is a random session-like string for plausibility.
 * A protocol version header (X-Api-Version: 1) is included for
 * forward compatibility.
 */

import type { JsonRpcRequest, JsonRpcResponse, Transport } from '../hive/client';

/** Random REST-like paths to POST to */
const PATHS = [
  '/api/comments',
  '/api/search',
  '/api/posts',
  '/api/feed',
  '/api/notifications',
  '/api/analytics',
  '/api/content',
  '/api/media',
];

/** Generate a random hex string */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/** Pick a random element from an array */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Gzip compress a string, returning a Uint8Array */
async function gzipCompress(data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(data)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Gzip decompress a Uint8Array to a string */
async function gzipDecompress(data: Uint8Array): Promise<string> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

/** Uint8Array to base64 string */
function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/** Base64 string to Uint8Array */
function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

/**
 * Encode a JSON-RPC request into an obfuscated REST-like request.
 * Returns { path, body, headers } ready to send.
 */
export async function encodeRequest(request: JsonRpcRequest): Promise<{
  path: string;
  body: string;
  headers: Record<string, string>;
}> {
  const json = JSON.stringify(request);
  const compressed = await gzipCompress(json);
  const encoded = toBase64(compressed);

  return {
    path: randomPick(PATHS),
    body: JSON.stringify({
      q: encoded,
      sid: randomHex(8),
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Version': '1',
    },
  };
}

/**
 * Decode an obfuscated response back into a JSON-RPC response.
 */
export async function decodeResponse(responseBody: string): Promise<JsonRpcResponse> {
  const wrapper = JSON.parse(responseBody) as {
    ok: boolean;
    data?: { r: string };
    error?: string;
  };

  if (!wrapper.ok || !wrapper.data?.r) {
    throw new Error(wrapper.error || 'Invalid obfuscated response');
  }

  const compressed = fromBase64(wrapper.data.r);
  const json = await gzipDecompress(compressed);
  return JSON.parse(json) as JsonRpcResponse;
}

/**
 * Obfuscated transport for the HiveClient.
 * Wraps JSON-RPC calls in normal-looking REST API traffic.
 */
export class ObfuscatedTransport implements Transport {
  private timeout: number;

  constructor(timeoutMs = 15_000) {
    this.timeout = timeoutMs;
  }

  async send(endpoint: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { path, body, headers } = await encodeRequest(request);
    const url = endpoint.replace(/\/+$/, '') + path;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return await decodeResponse(text);
    } finally {
      clearTimeout(timer);
    }
  }
}
