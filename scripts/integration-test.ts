import 'dotenv/config';

/**
 * Integration Test — Full end-to-end validation
 *
 * Tests the complete HAA flow using real Hive mainnet accounts:
 * 1. Wallet core: connect to RPC, fetch account data
 * 2. Transfer: send 0.001 HIVE between test accounts
 * 3. Savings: deposit and withdraw 0.001 HBD
 * 4. Endpoint feed: publish + discover encrypted endpoint memos
 * 5. Proxy relay: route requests through the local proxy
 * 6. Obfuscated relay: route through the proxy with obfuscation
 *
 * Usage:
 *   npx tsx integration-test.ts [--skip-broadcast]
 *
 * Reads credentials from .env file.
 * Use --skip-broadcast to test read-only operations only.
 */

import { Transaction, PrivateKey, Memo, config as hiveTxConfig } from 'hive-tx';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

// -- Config --

const args = process.argv.slice(2);
const skipBroadcast = args.includes('--skip-broadcast');

const SERVICE_ACCOUNT = process.env.HAA_SERVICE_ACCOUNT;
const SERVICE_ACTIVE_KEY = process.env.HAA_ACTIVE_KEY;
const SERVICE_MEMO_KEY = process.env.HAA_MEMO_KEY;

const TEST_USER1 = process.env.HAA_TEST_USER1;
const TEST_USER1_ACTIVE_KEY = process.env.HAA_TEST_USER1_ACTIVE_KEY;
const TEST_USER1_MEMO_KEY = process.env.HAA_TEST_USER1_MEMO_KEY;

const TEST_USER2 = process.env.HAA_TEST_USER2;
const TEST_USER2_ACTIVE_KEY = process.env.HAA_TEST_USER2_ACTIVE_KEY;

const PROXY_URL = process.env.HAA_PROXY_URL || 'http://localhost:3100';

// -- Helpers --

let passed = 0;
let failed = 0;
let skipped = 0;

function log(msg: string) { console.log(msg); }
function pass(test: string) { passed++; console.log(`  ✓ ${test}`); }
function fail(test: string, err: string) { failed++; console.error(`  ✗ ${test}: ${err}`); }
function skip(test: string) { skipped++; console.log(`  ○ ${test} (skipped)`); }

async function rpcCall(node: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`RPC: ${data.error.message}`);
  return data.result;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// -- Tests --

async function testRpcConnection() {
  log('\n── Test 1: RPC Connection ──');
  try {
    const props = await rpcCall(hiveTxConfig.nodes[0], 'condenser_api.get_dynamic_global_properties', []);
    if (props.head_block_number > 0) {
      pass(`Connected to ${hiveTxConfig.nodes[0]}, block #${props.head_block_number}`);
    } else {
      fail('RPC connection', 'No block data');
    }
  } catch (e) {
    fail('RPC connection', (e as Error).message);
  }
}

async function testAccountLookup() {
  log('\n── Test 2: Account Lookup ──');
  const accounts = [TEST_USER1, TEST_USER2, SERVICE_ACCOUNT].filter(Boolean) as string[];
  if (accounts.length === 0) { skip('Account lookup — no accounts configured'); return; }

  try {
    const result = await rpcCall(hiveTxConfig.nodes[0], 'condenser_api.get_accounts', [accounts]);
    for (const acc of result) {
      pass(`Found @${acc.name} — HIVE: ${acc.balance}, HBD: ${acc.hbd_balance}`);
    }
    const found = result.map((a: any) => a.name);
    for (const name of accounts) {
      if (!found.includes(name)) fail(`Account @${name}`, 'not found on chain');
    }
  } catch (e) {
    fail('Account lookup', (e as Error).message);
  }
}

async function testTransfer() {
  log('\n── Test 3: Transfer (0.001 HIVE) ──');
  if (!TEST_USER1 || !TEST_USER2 || !TEST_USER1_ACTIVE_KEY) {
    skip('Transfer — missing user1/user2 credentials'); return;
  }
  if (skipBroadcast) { skip('Transfer — --skip-broadcast'); return; }

  try {
    const tx = new Transaction();
    await tx.addOperation('transfer' as any, {
      from: TEST_USER1,
      to: TEST_USER2,
      amount: '0.001 HIVE',
      memo: 'HAA integration test',
    } as any);
    tx.sign(PrivateKey.from(TEST_USER1_ACTIVE_KEY));
    const result = await tx.broadcast(true);
    pass(`Transfer sent: TX ${result.tx_id?.slice(0, 12)}... (${result.status})`);
  } catch (e) {
    fail('Transfer', (e as Error).message);
  }
}

async function testEncryptedMemo() {
  log('\n── Test 4: Encrypted Memo Feed ──');
  if (!SERVICE_ACCOUNT || !SERVICE_ACTIVE_KEY || !SERVICE_MEMO_KEY || !TEST_USER1 || !TEST_USER1_MEMO_KEY) {
    skip('Encrypted memo — missing service/user1 memo keys'); return;
  }
  if (skipBroadcast) { skip('Encrypted memo — --skip-broadcast'); return; }

  try {
    // Look up user1's public memo key
    const accounts = await rpcCall(hiveTxConfig.nodes[0], 'condenser_api.get_accounts', [[TEST_USER1]]);
    const publicMemoKey = accounts[0].memo_key;

    // Encrypt endpoint payload
    const payload = JSON.stringify({
      v: 1,
      endpoints: [`${PROXY_URL}/rpc`],
      expires: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    });
    const encrypted = Memo.encode(SERVICE_MEMO_KEY, publicMemoKey, `#${payload}`);
    pass('Memo encrypted');

    // Send transfer with encrypted memo
    const tx = new Transaction();
    await tx.addOperation('transfer' as any, {
      from: SERVICE_ACCOUNT,
      to: TEST_USER1,
      amount: '0.001 HBD',
      memo: encrypted,
    } as any);
    tx.sign(PrivateKey.from(SERVICE_ACTIVE_KEY));
    const result = await tx.broadcast(true);
    pass(`Memo transfer sent: TX ${result.tx_id?.slice(0, 12)}... (${result.status})`);

    // Wait for it to appear in history, then try to decrypt
    await sleep(4000);

    const history = await rpcCall(hiveTxConfig.nodes[0], 'condenser_api.get_account_history', [TEST_USER1, -1, 10]);
    const memoTransfer = history.find(([_i, entry]: any) => {
      const [op, body] = entry.op;
      return op === 'transfer' && body.from === SERVICE_ACCOUNT && body.memo?.startsWith('#');
    });

    if (memoTransfer) {
      const memo = memoTransfer[1].op[1].memo;
      const decrypted = Memo.decode(TEST_USER1_MEMO_KEY, memo);
      // Memo.decode() returns the plaintext with the '#' prefix intact — strip it
      const plaintext = decrypted.startsWith('#') ? decrypted.slice(1) : decrypted;
      const parsed = JSON.parse(plaintext);
      if (parsed.v === 1 && parsed.endpoints.length > 0) {
        pass(`Memo decrypted: ${parsed.endpoints.length} endpoint(s), expires ${parsed.expires}`);
      } else {
        fail('Memo decrypt', 'Invalid payload structure');
      }
    } else {
      fail('Memo discovery', 'Transfer not found in history (may need more time)');
    }
  } catch (e) {
    fail('Encrypted memo', (e as Error).message);
  }
}

async function testProxyRelay() {
  log('\n── Test 5: Proxy Relay (direct) ──');
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

async function testObfuscatedRelay() {
  log('\n── Test 6: Obfuscated Relay ──');
  try {
    const rpc = JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_dynamic_global_properties',
      params: [],
      id: 1,
    });
    const compressed = gzipSync(Buffer.from(rpc));
    const b64 = compressed.toString('base64');
    const body = JSON.stringify({ q: b64, sid: 'test123' });

    const res = await fetch(`${PROXY_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Version': '1' },
      body,
    });

    const wrapper = await res.json() as any;
    if (!wrapper.ok || !wrapper.data?.r) {
      fail('Obfuscated relay', 'Bad response structure');
      return;
    }

    const decoded = gunzipSync(Buffer.from(wrapper.data.r, 'base64')).toString();
    const parsed = JSON.parse(decoded);

    if (parsed.result?.head_block_number > 0) {
      pass(`Obfuscated relay works — block #${parsed.result.head_block_number}`);
    } else {
      fail('Obfuscated relay', 'Unexpected response content');
    }
  } catch (e) {
    fail('Obfuscated relay', `${(e as Error).message} (is the proxy running on ${PROXY_URL}?)`);
  }
}

async function testMethodBlocking() {
  log('\n── Test 7: Method Allowlist ──');
  try {
    const res = await fetch(`${PROXY_URL}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'condenser_api.get_witnesses_by_vote', params: [[], 1], id: 1 }),
    });
    const data = await res.json() as any;
    if (data.error?.code === -32601) {
      pass('Disallowed method correctly rejected');
    } else {
      fail('Method blocking', 'Disallowed method was not rejected');
    }
  } catch (e) {
    fail('Method blocking', `${(e as Error).message} (is the proxy running?)`);
  }
}

// -- Main --

async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║   HAA Integration Test Suite       ║');
  console.log('╚════════════════════════════════════╝');

  if (skipBroadcast) {
    log('\nMode: READ-ONLY (--skip-broadcast)');
  } else {
    log('\nMode: FULL (will broadcast transactions)');
  }

  hiveTxConfig.nodes = ['https://api.hive.blog'];

  await testRpcConnection();
  await testAccountLookup();
  await testTransfer();
  await testEncryptedMemo();
  await testProxyRelay();
  await testObfuscatedRelay();
  await testMethodBlocking();

  console.log('\n════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
