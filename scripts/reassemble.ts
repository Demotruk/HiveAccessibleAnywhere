import 'dotenv/config';

/**
 * Reassemble Propolis Wallet from on-chain Hive posts.
 *
 * Uses the root-post-plus-comments model:
 *   1. Fetch root post → read json_metadata.propolis for manifest
 *   2. Use bridge.get_discussion to fetch all comments in one RPC call
 *   3. Walk manifest, match permlinks to comments, strip code fences
 *   4. SHA-256 verify each chunk and the assembled whole
 *   5. Save the result
 *
 * Usage:
 *   npx tsx reassemble.ts [--account haa-service] [--version 1] [--locale en] [--output wallet.html]
 *
 * No keys required — this only reads public blockchain data.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// -- Parse args --

const args = process.argv.slice(2);

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const account = getArg('--account', 'haa-service');
const version = getArg('--version', '1');
const locale = getArg('--locale', 'en');
const outputPath = getArg('--output', `propolis-wallet-${locale}.html`);

// -- Config --

const RPC_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

// -- Types --

interface ManifestEntry {
  permlink: string;
  hash: string;
}

interface PropolisMetadata {
  version: string;
  locale: string;
  hash: string;
  manifest: ManifestEntry[];
}

// -- Helpers --

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

async function rpcCall(method: string, params: unknown): Promise<any> {
  for (const node of RPC_NODES) {
    try {
      const response = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      });
      const data = await response.json() as any;
      if (data.error) {
        console.warn(`  RPC error from ${node}: ${data.error.message}`);
        continue;
      }
      return data.result;
    } catch (e) {
      console.warn(`  RPC failed for ${node}: ${(e as Error).message}`);
      continue;
    }
  }
  throw new Error('All RPC nodes failed');
}

/**
 * Extract content from between code fences.
 */
function stripCodeFences(body: string): string {
  const match = body.match(/```\n([\s\S]*?)\n```/);
  if (match) return match[1];
  // Fallback: strip leading/trailing fences
  return body.replace(/^```\n?/, '').replace(/\n?```$/, '');
}

// -- Main --

async function main() {
  const rootPermlink = `propolis-wallet-v${version}-${locale}`;

  console.log('=== Propolis Wallet Reassembly ===');
  console.log(`Account: @${account}`);
  console.log(`Root post: @${account}/${rootPermlink}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  // Step 1: Fetch the root post to get the manifest from json_metadata
  console.log('Fetching root post...');
  const rootResult = await rpcCall('condenser_api.get_content', [account, rootPermlink]);
  if (!rootResult || !rootResult.body) {
    console.error(`Root post not found: @${account}/${rootPermlink}`);
    process.exit(1);
  }

  let metadata: PropolisMetadata;
  try {
    const jsonMeta = JSON.parse(rootResult.json_metadata);
    metadata = jsonMeta.propolis;
    if (!metadata || !metadata.hash || !metadata.manifest?.length) {
      throw new Error('Missing propolis metadata');
    }
  } catch (e) {
    console.error(`Failed to parse propolis metadata from root post: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log(`Version: ${metadata.version}`);
  console.log(`Locale: ${metadata.locale}`);
  console.log(`Expected SHA-256: ${metadata.hash}`);
  console.log(`Parts: ${metadata.manifest.length}`);
  console.log('');

  // Step 2: Fetch all comments via bridge.get_discussion (single RPC call)
  console.log('Fetching discussion (root + all comments)...');
  const discussion = await rpcCall('bridge.get_discussion', {
    author: account,
    permlink: rootPermlink,
    limit: 100,
  });

  if (!discussion) {
    console.error('Failed to fetch discussion');
    process.exit(1);
  }

  // Build a map of permlink → body for comments by the publisher account only
  const comments: Record<string, string> = {};
  for (const key of Object.keys(discussion)) {
    const post = discussion[key];
    if (post.author === account && post.parent_author === account) {
      comments[post.permlink] = post.body;
    }
  }

  console.log(`Found ${Object.keys(comments).length} comments by @${account}`);
  console.log('');

  // Step 3: Walk manifest, extract chunks, verify each hash
  console.log('Verifying chunks...');
  const chunks: string[] = [];

  for (let i = 0; i < metadata.manifest.length; i++) {
    const entry = metadata.manifest[i];
    const body = comments[entry.permlink];

    if (!body) {
      console.error(`  Missing chunk: ${entry.permlink}`);
      process.exit(1);
    }

    const content = stripCodeFences(body);
    const chunkHash = sha256(content);

    if (chunkHash !== entry.hash) {
      console.error(`  Hash mismatch for ${entry.permlink}:`);
      console.error(`    Expected: ${entry.hash}`);
      console.error(`    Got:      ${chunkHash}`);
      console.error('');
      console.error('WARNING: This chunk may have been tampered with or corrupted.');
      process.exit(1);
    }

    chunks.push(content);
    console.log(`  ${entry.permlink}: ${content.length} bytes ✓`);
  }

  // Step 4: Assemble and verify whole-file hash
  console.log('');
  const assembled = chunks.join('');
  const actualHash = sha256(assembled);
  const size = Buffer.byteLength(assembled, 'utf-8');

  console.log(`Assembled: ${(size / 1024).toFixed(1)} KB`);
  console.log(`SHA-256:   ${actualHash}`);

  if (actualHash === metadata.hash) {
    console.log('Hash:      ✓ VERIFIED');
  } else {
    console.error('Hash:      ✗ MISMATCH');
    console.error(`Expected:  ${metadata.hash}`);
    console.error(`Got:       ${actualHash}`);
    console.error('');
    console.error('WARNING: The assembled file does not match the expected hash.');
    console.error('The file may have been tampered with or corrupted.');
    process.exit(1);
  }

  // Step 5: Save
  const outPath = resolve(outputPath);
  writeFileSync(outPath, assembled, 'utf-8');
  console.log('');
  console.log(`Saved to: ${outPath}`);
  console.log('Open this file in a browser to use the Propolis Wallet.');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
