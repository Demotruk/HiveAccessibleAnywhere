/**
 * Traffic obfuscation codec (protocol v1).
 *
 * JSON-RPC -> gzip (CompressionStream) -> base64, wrapped in REST-like POST.
 * Request:  { "q": "<b64>", "sid": "<rand>" } to random /api/:path
 * Response: { "ok": true, "data": { "r": "<b64>" } }
 * Header:   X-Api-Version: 1
 */

import type { JsonRpcRequest, JsonRpcResponse, Transport } from '../hive/client';

const PATHS = ['/api/comments','/api/search','/api/posts','/api/feed'];

function rHex(n: number): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

async function gz(data: string): Promise<Uint8Array> {
  const s = new Blob([new TextEncoder().encode(data)]).stream().pipeThrough(new CompressionStream('gzip'));
  const r = s.getReader(); const ch: Uint8Array[] = [];
  for (;;) { const { done, value } = await r.read(); if (done) break; ch.push(value); }
  const t = ch.reduce((s, c) => s + c.length, 0), out = new Uint8Array(t);
  let o = 0; for (const c of ch) { out.set(c, o); o += c.length; }
  return out;
}

async function ugz(data: Uint8Array): Promise<string> {
  const s = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const r = s.getReader(), d = new TextDecoder(); let out = '';
  for (;;) { const { done, value } = await r.read(); if (done) break; out += d.decode(value, { stream: true }); }
  return out + d.decode();
}

function toB64(d: Uint8Array): string {
  let b = ''; for (let i = 0; i < d.length; i++) b += String.fromCharCode(d[i]);
  return btoa(b);
}

function fromB64(s: string): Uint8Array {
  const b = atob(s), r = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) r[i] = b.charCodeAt(i);
  return r;
}

/** Encode a JSON-RPC request into an obfuscated REST-like request. */
export async function encodeRequest(request: JsonRpcRequest): Promise<{
  path: string; body: string; headers: Record<string, string>;
}> {
  const encoded = toB64(await gz(JSON.stringify(request)));
  return {
    path: PATHS[Math.floor(Math.random() * PATHS.length)],
    body: JSON.stringify({ q: encoded, sid: rHex(8) }),
    headers: { 'Content-Type': 'application/json', 'X-Api-Version': '1' },
  };
}

/** Decode an obfuscated response back into a JSON-RPC response. */
export async function decodeResponse(responseBody: string): Promise<JsonRpcResponse> {
  const w = JSON.parse(responseBody) as { ok: boolean; data?: { r: string }; error?: string };
  if (!w.ok || !w.data?.r) throw new Error(w.error || 'Invalid obfuscated response');
  return JSON.parse(await ugz(fromB64(w.data.r))) as JsonRpcResponse;
}

/** Obfuscated transport for the HiveClient. */
export class ObfuscatedTransport implements Transport {
  private timeout: number;
  constructor(timeoutMs = 15_000) { this.timeout = timeoutMs; }

  async send(endpoint: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { path, body, headers } = await encodeRequest(request);
    // Strip /rpc suffix — proxy expects obfuscated requests at /api/:path
    const url = endpoint.replace(/\/rpc\/?$/, '').replace(/\/+$/, '') + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      const res = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await decodeResponse(await res.text());
    } finally { clearTimeout(timer); }
  }
}
