/**
 * Obfuscation mode manager.
 * Controls obfuscated traffic (default: ON). When enabled, both HiveClient
 * and hive-tx's internal fetch calls are obfuscated via a global interceptor.
 */

import { getClient, DirectTransport } from '../hive/client';
import { ObfuscatedTransport, encodeRequest, decodeResponse } from './codec';
import { isPhase2 } from '../phase';

export type ObfuscationMode = 'obfuscated' | 'direct';

const KEY = 'propolis_obfuscation';
const origFetch = globalThis.fetch;
let active = false;

export function getObfuscationMode(): ObfuscationMode {
  return localStorage.getItem(KEY) === 'direct' ? 'direct' : 'obfuscated';
}

export function isObfuscationEnabled(): boolean {
  // Phase 1: obfuscation is always disabled (dead-code-eliminated in Phase 1 builds)
  if (!isPhase2()) return false;
  return getObfuscationMode() === 'obfuscated';
}

export function setObfuscationMode(mode: ObfuscationMode): void {
  localStorage.setItem(KEY, mode);
  applyObfuscation();
}

/** Apply current mode — sets transport + installs/removes fetch interceptor.
 *  In Phase 1 this is a no-op (direct mode forced). */
export function applyObfuscation(): void {
  if (!isPhase2()) return; // Phase 1: no-op
  const cl = getClient();
  if (getObfuscationMode() === 'obfuscated') {
    cl.setTransport(new ObfuscatedTransport());
    installInterceptor();
  } else {
    cl.setTransport(new DirectTransport());
    removeInterceptor();
  }
}

/**
 * Intercept hive-tx's plain JSON-RPC fetch calls and obfuscate them.
 * Already-obfuscated calls (from ObfuscatedTransport) have a "q" body
 * field instead of "jsonrpc", so they pass through untouched.
 */
function installInterceptor(): void {
  if (active) return;
  active = true;

  globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!init?.body || typeof init.body !== 'string') return origFetch(input, init);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(init.body); } catch { return origFetch(input, init); }

    // Only intercept plain JSON-RPC calls
    if (!parsed.jsonrpc) return origFetch(input, init);

    const enc = await encodeRequest(parsed as any);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const base = url.replace(/\/rpc\/?$/, '').replace(/\/+$/, '');

    const res = await origFetch(base + enc.path, {
      method: 'POST', headers: enc.headers, body: enc.body, signal: init.signal,
    });

    if (!res.ok) return res;

    const decoded = await decodeResponse(await res.text());
    return new Response(JSON.stringify(decoded), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
}

function removeInterceptor(): void {
  if (!active) return;
  active = false;
  globalThis.fetch = origFetch;
}
