import 'dotenv/config';

/**
 * Reassemble wallet HTML from on-chain Hive posts.
 *
 * Reads the index post, fetches each part, concatenates them,
 * verifies the SHA-256 hash, and saves the result.
 *
 * Usage:
 *   npx tsx reassemble.ts [--account haa-service] [--version v1] [--output wallet.html]
 *
 * No keys required — this only reads public blockchain data.
 */

import { config as hiveTxConfig } from 'hive-tx';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// -- Parse args --

const args = process.argv.slice(2);

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : defaultVal;
}

const account = getArg('--account', 'haa-service');
const version = getArg('--version', 'v1');
const outputPath = getArg('--output', 'wallet.html');

// -- Helpers --

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(hiveTxConfig.nodes[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await response.json() as any;
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return data.result;
}

async function getPostContent(author: string, permlink: string): Promise<string> {
  const result = await rpcCall('condenser_api.get_content', [author, permlink]);
  if (!result || !result.body) {
    throw new Error(`Post not found: @${author}/${permlink}`);
  }
  return result.body;
}

/**
 * Extract code content from a post body.
 * Looks for content between ``` code fences.
 */
function extractCode(body: string): string {
  const match = body.match(/```\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error('No code block found in post');
  }
  return match[1];
}

/**
 * Parse the index post to extract the hash and part permlinks.
 */
function parseIndex(body: string): { hash: string; parts: string[] } {
  // Extract SHA-256
  const hashMatch = body.match(/\*\*SHA-256:\*\*\s*`([a-f0-9]{64})`/);
  if (!hashMatch) {
    throw new Error('SHA-256 hash not found in index post');
  }

  // Extract part permlinks — look for links to part posts
  const parts: string[] = [];
  const linkRegex = new RegExp(`@${account}/([\\w-]+)`, 'g');
  let m;
  while ((m = linkRegex.exec(body)) !== null) {
    const permlink = m[1];
    if (permlink.includes('-part-')) {
      parts.push(permlink);
    }
  }

  if (parts.length === 0) {
    throw new Error('No part links found in index post');
  }

  return { hash: hashMatch[1], parts };
}

// -- Main --

async function main() {
  console.log('=== HAA Wallet Reassembly ===');
  console.log(`Account: @${account}`);
  console.log(`Version: ${version}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  // Fetch index post
  const indexPermlink = `haa-wallet-${version}-index`;
  console.log(`Fetching index: @${account}/${indexPermlink}...`);
  const indexBody = await getPostContent(account, indexPermlink);
  const { hash: expectedHash, parts } = parseIndex(indexBody);

  console.log(`Expected SHA-256: ${expectedHash}`);
  console.log(`Parts to fetch: ${parts.length}`);
  console.log('');

  // Fetch each part
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const permlink = parts[i];
    console.log(`  Fetching part ${i + 1}/${parts.length}: ${permlink}...`);
    const body = await getPostContent(account, permlink);
    const code = extractCode(body);
    chunks.push(code);
    console.log(`    ${code.length} bytes`);

    // Small delay to be nice to the RPC node
    if (i < parts.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Concatenate
  const assembled = chunks.join('');
  const actualHash = sha256(assembled);
  const size = Buffer.byteLength(assembled, 'utf-8');

  console.log('');
  console.log(`Assembled: ${(size / 1024).toFixed(1)} KB`);
  console.log(`SHA-256:   ${actualHash}`);

  // Verify hash
  if (actualHash === expectedHash) {
    console.log('Hash:      ✓ VERIFIED');
  } else {
    console.error('Hash:      ✗ MISMATCH');
    console.error(`Expected:  ${expectedHash}`);
    console.error(`Got:       ${actualHash}`);
    console.error('');
    console.error('WARNING: The assembled file does not match the expected hash.');
    console.error('The file may have been tampered with or corrupted.');
    process.exit(1);
  }

  // Save
  const outPath = resolve(outputPath);
  writeFileSync(outPath, assembled, 'utf-8');
  console.log('');
  console.log(`Saved to: ${outPath}`);
  console.log('Open this file in a browser to use the HAA Wallet.');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
