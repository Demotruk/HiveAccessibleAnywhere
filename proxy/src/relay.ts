/**
 * JSON-RPC relay to upstream Hive nodes.
 *
 * Validates requests against an allowlist of safe methods,
 * forwards to upstream Hive API nodes, and returns the response.
 * The proxy never sees private keys — it only relays signed
 * transactions and public blockchain data.
 */

import type { Request, Response } from 'express';

/** Methods the proxy is allowed to relay */
const ALLOWED_METHODS = new Set([
  'condenser_api.get_accounts',
  'condenser_api.get_dynamic_global_properties',
  'condenser_api.broadcast_transaction',
  'condenser_api.broadcast_transaction_synchronous',
  'condenser_api.get_account_history',
  'condenser_api.get_block',
  'transaction_status_api.find_transaction',
]);

/** Upstream Hive RPC nodes to relay to */
const UPSTREAM_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

let currentUpstream = 0;

/** Get the next upstream node (round-robin) */
function getUpstream(): string {
  const node = UPSTREAM_NODES[currentUpstream % UPSTREAM_NODES.length];
  currentUpstream++;
  return node;
}

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: unknown;
  id: unknown;
}

/**
 * Relay handler for the /rpc endpoint.
 * Validates the JSON-RPC request, forwards to upstream, returns the response.
 */
export async function relayHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as JsonRpcRequest;

  // Validate JSON-RPC structure
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: body?.id ?? null,
    });
    return;
  }

  // Check method allowlist
  if (!ALLOWED_METHODS.has(body.method)) {
    res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not allowed' },
      id: body.id,
    });
    return;
  }

  // Try upstream nodes with failover
  const maxAttempts = UPSTREAM_NODES.length;
  let lastError: string | undefined;

  for (let i = 0; i < maxAttempts; i++) {
    const upstream = getUpstream();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);

      const upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: body.method,
          params: body.params ?? [],
          id: body.id,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!upstreamRes.ok) {
        lastError = `Upstream ${upstream} returned HTTP ${upstreamRes.status}`;
        continue;
      }

      const data = await upstreamRes.json();
      res.json(data);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`Upstream ${upstream} failed: ${lastError}`);
    }
  }

  // All upstreams failed
  res.status(502).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: `All upstream nodes failed: ${lastError}` },
    id: body.id,
  });
}

/**
 * Get the list of allowed methods (for health/info endpoints).
 */
export function getAllowedMethods(): string[] {
  return [...ALLOWED_METHODS];
}
