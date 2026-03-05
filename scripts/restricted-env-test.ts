import 'dotenv/config';

/**
 * Simulated Restricted Environment Test
 *
 * Validates the core HAA thesis: a wallet can operate through an
 * obfuscated proxy even when all direct Hive RPC access is blocked.
 *
 * How it works:
 *   1. Monkey-patches global `fetch` to block requests to known Hive
 *      RPC hostnames — simulating a network firewall / DPI block
 *   2. Allows requests to localhost (the proxy) only
 *   3. Verifies that direct RPC calls fail (the block works)
 *   4. Verifies that proxy relay and obfuscated relay still work
 *   5. Broadcasts a real transfer through the proxy (hive-tx routed
 *      through the proxy endpoint)
 *   6. Inspects obfuscated traffic to verify no Hive-identifiable
 *      signatures leak in the request body or headers
 *
 * Prerequisites:
 *   - Proxy server running on localhost:3100 (cd proxy && npm run dev)
 *   - .env file with test account credentials
 *
 * Usage:
 *   npx tsx restricted-env-test.ts [--skip-broadcast]
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import { gzipSync, gunzipSync } from 'node:zlib';

// -- Config --

const args = process.argv.slice(2);
const skipBroadcast = args.includes('--skip-broadcast');

const TEST_USER1 = process.env.HAA_TEST_USER1;
const TEST_USER1_ACTIVE_KEY = process.env.HAA_TEST_USER1_ACTIVE_KEY;
const TEST_USER2 = process.env.HAA_TEST_USER2;

const PROXY_URL = process.env.HAA_PROXY_URL || 'http://localhost:3100';

// Known Hive RPC node hostnames that would be blocked in a restricted network
const BLOCKED_HOSTS = [
  'api.hive.blog',
  'api.deathwing.me',
  'hive-api.arcange.eu',
  'api.openhive.network',
  'anyx.io',
  'hived.emre.sh',
  'rpc.ausbit.dev',
  'rpc.mahdiyari.info',
  'techcoderx.com',
  'hive.roelandp.nl',
];

// -- Fetch firewall --

/** Track intercepted requests for traffic analysis */
interface InterceptedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

const interceptedRequests: InterceptedRequest[] = [];
let firewallEnabled = false;
let captureTraffic = false;

const originalFetch = globalThis.fetch;

/**
 * Patched fetch that blocks requests to known Hive RPC hostnames.
 * Simulates a network-level firewall that would exist in restricted regions.
 */
function restrictedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = '';
  }

  // Capture traffic for analysis
  if (captureTraffic && init?.body) {
    interceptedRequests.push({
      url,
      method: init.method || 'GET',
      headers: Object.fromEntries(
        init.headers instanceof Headers
          ? init.headers.entries()
          : Object.entries(init.headers || {}),
      ),
      body: typeof init.body === 'string' ? init.body : null,
    });
  }

  // Block Hive RPC nodes when firewall is enabled
  if (firewallEnabled && BLOCKED_HOSTS.includes(hostname)) {
    return Promise.reject(
      new Error(`[FIREWALL] Connection to ${hostname} blocked — simulating restricted network`),
    );
  }

  return originalFetch(input, init);
}

// -- Helpers --

let passed = 0;
let failed = 0;
let skipped = 0;

function log(msg: string) { console.log(msg); }
function pass(test: string) { passed++; console.log(`  ✓ ${test}`); }
function fail(test: string, err: string) { failed++; console.error(`  ✗ ${test}: ${err}`); }
function skip(test: string) { skipped++; console.log(`  ○ ${test} (skipped)`); }

async function rpcCall(node: string, method: string, params: unknown[]): Promise<any> {
  const res = await globalThis.fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`RPC: ${data.error.message}`);
  return data.result;
}

/**
 * Make an obfuscated RPC call through the proxy.
 * Mimics what the wallet's ObfuscatedTransport does.
 */
async function obfuscatedRpcCall(proxyUrl: string, method: string, params: unknown[]): Promise<any> {
  const rpc = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
  const compressed = gzipSync(Buffer.from(rpc));
  const b64 = compressed.toString('base64');
  const paths = ['/api/comments', '/api/search', '/api/posts', '/api/feed'];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const sid = Math.random().toString(36).slice(2, 18);

  const body = JSON.stringify({ q: b64, sid });
  const res = await globalThis.fetch(`${proxyUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Version': '1',
    },
    body,
  });

  const wrapper = await res.json() as any;
  if (!wrapper.ok || !wrapper.data?.r) {
    throw new Error(wrapper.error || 'Invalid obfuscated response');
  }

  const decoded = gunzipSync(Buffer.from(wrapper.data.r, 'base64')).toString();
  const result = JSON.parse(decoded);
  if (result.error) throw new Error(`RPC: ${result.error.message}`);
  return result.result;
}

// -- Tests --

async function testFirewallBlocks() {
  log('\n── Test 1: Firewall Blocks Direct RPC ──');
  try {
    await rpcCall('https://api.hive.blog', 'condenser_api.get_dynamic_global_properties', []);
    fail('Firewall', 'Direct RPC call succeeded — firewall not working!');
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('[FIREWALL]')) {
      pass('Direct RPC correctly blocked by firewall');
    } else {
      fail('Firewall', `Unexpected error: ${msg}`);
    }
  }
}

async function testFirewallBlocksMultipleNodes() {
  log('\n── Test 2: All Known Hive Nodes Blocked ──');
  const testNodes = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://hive-api.arcange.eu',
  ];
  let allBlocked = true;
  for (const node of testNodes) {
    try {
      await rpcCall(node, 'condenser_api.get_dynamic_global_properties', []);
      fail(`Block ${new URL(node).hostname}`, 'Should have been blocked');
      allBlocked = false;
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes('[FIREWALL]')) {
        fail(`Block ${new URL(node).hostname}`, `Wrong error: ${msg}`);
        allBlocked = false;
      }
    }
  }
  if (allBlocked) {
    pass(`All ${testNodes.length} Hive RPC nodes blocked by firewall`);
  }
}

async function testProxyRelayWorks() {
  log('\n── Test 3: Proxy Relay Works (Through Firewall) ──');
  try {
    const result = await rpcCall(`${PROXY_URL}/rpc`, 'condenser_api.get_dynamic_global_properties', []);
    if (result.head_block_number > 0) {
      pass(`Proxy relay works — block #${result.head_block_number}`);
    } else {
      fail('Proxy relay', 'No block data');
    }
  } catch (e) {
    fail('Proxy relay', `${(e as Error).message} (is the proxy running on ${PROXY_URL}?)`);
  }
}

async function testObfuscatedRelayWorks() {
  log('\n── Test 4: Obfuscated Relay Works (Through Firewall) ──');
  try {
    const result = await obfuscatedRpcCall(PROXY_URL, 'condenser_api.get_dynamic_global_properties', []);
    if (result.head_block_number > 0) {
      pass(`Obfuscated relay works — block #${result.head_block_number}`);
    } else {
      fail('Obfuscated relay', 'No block data');
    }
  } catch (e) {
    fail('Obfuscated relay', `${(e as Error).message} (is the proxy running on ${PROXY_URL}?)`);
  }
}

async function testAccountQueryThroughProxy() {
  log('\n── Test 5: Account Query Through Obfuscated Proxy ──');
  if (!TEST_USER1) { skip('Account query — no test user configured'); return; }

  try {
    const result = await obfuscatedRpcCall(
      PROXY_URL,
      'condenser_api.get_accounts',
      [[TEST_USER1]],
    );
    if (result.length > 0 && result[0].name === TEST_USER1) {
      pass(`Queried @${TEST_USER1} via obfuscated proxy — HIVE: ${result[0].balance}, HBD: ${result[0].hbd_balance}`);
    } else {
      fail('Account query', 'Account not found through proxy');
    }
  } catch (e) {
    fail('Account query', (e as Error).message);
  }
}

async function testTransferThroughProxy() {
  log('\n── Test 6: Transfer Through Proxy (Restricted Environment) ──');
  if (!TEST_USER1 || !TEST_USER2 || !TEST_USER1_ACTIVE_KEY) {
    skip('Transfer — missing user credentials'); return;
  }
  if (skipBroadcast) { skip('Transfer — --skip-broadcast'); return; }

  try {
    // hive-tx is configured to use the proxy's /rpc endpoint
    // (set in main() before firewall is enabled)
    // This means tx.addOperation() fetches ref block through proxy
    // and tx.broadcast() sends the signed tx through proxy
    const tx = new Transaction();
    await tx.addOperation('transfer' as any, {
      from: TEST_USER1,
      to: TEST_USER2,
      amount: '0.001 HIVE',
      memo: 'HAA restricted env test',
    } as any);
    tx.sign(PrivateKey.from(TEST_USER1_ACTIVE_KEY));
    const result = await tx.broadcast(true);
    pass(`Transfer broadcast through proxy: TX ${result.tx_id?.slice(0, 12)}... (${result.status})`);
  } catch (e) {
    fail('Transfer through proxy', (e as Error).message);
  }
}

async function testTrafficAnalysis() {
  log('\n── Test 7: Traffic Signature Analysis ──');

  // Clear captured requests and enable capture
  interceptedRequests.length = 0;
  captureTraffic = true;

  try {
    // Make several obfuscated requests
    await obfuscatedRpcCall(PROXY_URL, 'condenser_api.get_dynamic_global_properties', []);
    await obfuscatedRpcCall(PROXY_URL, 'condenser_api.get_accounts', [['haa-service']]);

    captureTraffic = false;

    // Analyse intercepted traffic for Hive-identifiable signatures
    const hiveSignatures = [
      'condenser_api',
      'get_dynamic_global_properties',
      'get_accounts',
      'broadcast_transaction',
      'hive',
      'jsonrpc',
      'head_block',
    ];

    let leaksFound = 0;
    for (const req of interceptedRequests) {
      if (!req.body) continue;

      // Check request body for Hive method names / JSON-RPC signatures
      for (const sig of hiveSignatures) {
        if (req.body.toLowerCase().includes(sig.toLowerCase())) {
          fail('Traffic analysis', `Leaked "${sig}" in request body to ${req.url}`);
          leaksFound++;
        }
      }

      // Check URL path — shouldn't contain any Hive-specific paths
      if (req.url.includes('/rpc') || req.url.includes('/hive')) {
        fail('Traffic analysis', `URL path "${req.url}" looks Hive-specific`);
        leaksFound++;
      }

      // Check headers — shouldn't contain Hive-specific headers
      const headerStr = JSON.stringify(req.headers).toLowerCase();
      if (headerStr.includes('hive') || headerStr.includes('blockchain')) {
        fail('Traffic analysis', 'Headers contain Hive-specific values');
        leaksFound++;
      }
    }

    if (leaksFound === 0) {
      pass(`No Hive signatures found in ${interceptedRequests.length} intercepted request(s)`);

      // Report what the traffic looks like
      for (const req of interceptedRequests) {
        const body = req.body ? JSON.parse(req.body) : null;
        const urlPath = new URL(req.url).pathname;
        log(`    → POST ${urlPath} — body keys: [${body ? Object.keys(body).join(', ') : 'none'}]`);
      }
    }
  } catch (e) {
    captureTraffic = false;
    fail('Traffic analysis', (e as Error).message);
  }
}

async function testVerifyDirectRpcStillBlocked() {
  log('\n── Test 8: Confirm Firewall Still Active ──');
  try {
    await rpcCall('https://api.hive.blog', 'condenser_api.get_dynamic_global_properties', []);
    fail('Final firewall check', 'Direct RPC should still be blocked');
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('[FIREWALL]')) {
      pass('Firewall still active — direct Hive access remains blocked');
    } else {
      fail('Final firewall check', `Unexpected error: ${msg}`);
    }
  }
}

// -- Main --

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   HAA Restricted Environment Test Suite      ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║   Simulates blocked Hive RPC access and     ║');
  console.log('║   validates wallet works through obfuscated  ║');
  console.log('║   proxy only.                                ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (skipBroadcast) {
    log('\nMode: READ-ONLY (--skip-broadcast)');
  } else {
    log('\nMode: FULL (will broadcast transactions through proxy)');
  }

  // Configure hive-tx to use the PROXY endpoint (not direct Hive nodes)
  // This is what the wallet does when configured with a proxy endpoint
  hiveTxConfig.nodes = [`${PROXY_URL}/rpc`];

  log(`\nhive-tx nodes: ${hiveTxConfig.nodes[0]}`);
  log(`Blocked hosts: ${BLOCKED_HOSTS.length} Hive RPC nodes`);

  // Install the fetch firewall
  log('\n🔒 Activating network firewall...');
  globalThis.fetch = restrictedFetch as typeof fetch;
  firewallEnabled = true;
  log('   All direct Hive RPC connections are now blocked.\n');

  await testFirewallBlocks();
  await testFirewallBlocksMultipleNodes();
  await testProxyRelayWorks();
  await testObfuscatedRelayWorks();
  await testAccountQueryThroughProxy();
  await testTransferThroughProxy();
  await testTrafficAnalysis();
  await testVerifyDirectRpcStillBlocked();

  // Restore original fetch
  globalThis.fetch = originalFetch;
  firewallEnabled = false;

  console.log('\n══════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('══════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. The PoC may not be fully validated.');
    process.exit(1);
  } else {
    console.log('\n✅ Core PoC thesis validated:');
    console.log('   The wallet can operate through an obfuscated proxy');
    console.log('   even when all direct Hive RPC access is blocked.');
    console.log('   Traffic analysis shows no Hive-identifiable signatures.');
  }
}

main().catch(e => {
  // Restore original fetch on error
  globalThis.fetch = originalFetch;
  console.error('Fatal error:', e);
  process.exit(1);
});
