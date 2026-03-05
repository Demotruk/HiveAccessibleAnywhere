import 'dotenv/config';

/**
 * On-Chain Distribution — Publish wallet HTML to Hive blockchain
 *
 * Reads the built wallet HTML file, computes a SHA-256 hash,
 * splits it into chunks that fit within Hive post body limits,
 * and publishes them as a series of Hive posts with an index post.
 *
 * Usage:
 *   npx tsx distribute-onchain.ts [--dry-run] [--version v1]
 *
 * Environment variables:
 *   HAA_SERVICE_ACCOUNT   - Hive account to publish under
 *   HAA_POSTING_KEY       - Private posting key (WIF) for creating posts
 *
 * Output:
 *   Posts with permlinks:
 *     haa-wallet-v1-part-1
 *     haa-wallet-v1-part-2
 *     ...
 *     haa-wallet-v1-index  (contains part list + SHA-256 hash)
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// -- Config --

const CHUNK_SIZE = 50_000; // ~50KB per post body (well under Hive's limits)
const WALLET_PATH = resolve(import.meta.dirname, '..', 'wallet', 'dist', 'index.html');

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const versionIdx = args.indexOf('--version');
const version = versionIdx >= 0 ? args[versionIdx + 1] : 'v1';

// -- Load environment --

const SERVICE_ACCOUNT = process.env.HAA_SERVICE_ACCOUNT;
const POSTING_KEY = process.env.HAA_POSTING_KEY;

if (!SERVICE_ACCOUNT || !POSTING_KEY) {
  console.error('Missing environment variables.');
  console.error('Required: HAA_SERVICE_ACCOUNT, HAA_POSTING_KEY');
  process.exit(1);
}

// -- Helpers --

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

function splitIntoChunks(data: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

async function publishPost(
  permlink: string,
  title: string,
  body: string,
  parentPermlink: string = 'haa-wallet',
): Promise<{ tx_id: string; status: string }> {
  const tx = new Transaction();
  await tx.addOperation('comment' as any, {
    parent_author: '',
    parent_permlink: parentPermlink,
    author: SERVICE_ACCOUNT,
    permlink,
    title,
    body,
    json_metadata: JSON.stringify({
      app: 'haa-wallet/0.1.0',
      tags: ['haa-wallet'],
    }),
  } as any);

  const key = PrivateKey.from(POSTING_KEY!);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result;
}

// -- Main --

async function main() {
  console.log('=== HAA On-Chain Distribution ===');
  console.log(`Service account: @${SERVICE_ACCOUNT}`);
  console.log(`Version: ${version}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  // Read wallet file
  let walletHtml: string;
  try {
    walletHtml = readFileSync(WALLET_PATH, 'utf-8');
  } catch (e) {
    console.error(`Failed to read wallet file at ${WALLET_PATH}`);
    console.error('Run "npm run build" in wallet/ first.');
    process.exit(1);
  }

  const hash = sha256(walletHtml);
  const size = Buffer.byteLength(walletHtml, 'utf-8');
  console.log(`Wallet file: ${WALLET_PATH}`);
  console.log(`Size: ${(size / 1024).toFixed(1)} KB`);
  console.log(`SHA-256: ${hash}`);
  console.log('');

  // Split into chunks
  const chunks = splitIntoChunks(walletHtml, CHUNK_SIZE);
  console.log(`Split into ${chunks.length} parts (${CHUNK_SIZE} bytes each)`);
  console.log('');

  // Publish each part
  const permlinks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const partNum = i + 1;
    const permlink = `haa-wallet-${version}-part-${partNum}`;
    const title = `HAA Wallet ${version} — Part ${partNum}/${chunks.length}`;
    const body = `\`\`\`\n${chunks[i]}\n\`\`\`\n\n---\nPart ${partNum} of ${chunks.length}. See index post for assembly instructions.`;

    permlinks.push(permlink);

    console.log(`  Part ${partNum}/${chunks.length}: ${permlink} (${chunks[i].length} bytes)`);

    if (dryRun) {
      console.log('    [DRY RUN] Would publish post');
      continue;
    }

    try {
      const result = await publishPost(permlink, title, body);
      console.log(`    Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
      // Wait between posts
      await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Publish index post
  const indexPermlink = `haa-wallet-${version}-index`;
  const indexTitle = `HAA Wallet ${version} — Index`;
  const indexBody = [
    `# HAA Wallet ${version}`,
    '',
    `**SHA-256:** \`${hash}\``,
    `**Size:** ${(size / 1024).toFixed(1)} KB`,
    `**Parts:** ${chunks.length}`,
    '',
    '## Parts',
    '',
    ...permlinks.map((p, i) => `${i + 1}. [@${SERVICE_ACCOUNT}/${p}](https://hive.blog/@${SERVICE_ACCOUNT}/${p})`),
    '',
    '## Assembly Instructions',
    '',
    '1. Open each part post in order',
    '2. Copy the content between the ``` code fences',
    '3. Concatenate all parts in order into a single file',
    '4. Save as `wallet.html`',
    '5. Verify the SHA-256 hash matches: `' + hash + '`',
    '6. Open `wallet.html` in any modern browser',
    '',
    '---',
    `Published by @${SERVICE_ACCOUNT} using HAA distribution tools.`,
  ].join('\n');

  console.log(`  Index: ${indexPermlink}`);

  if (dryRun) {
    console.log('    [DRY RUN] Would publish index post');
  } else {
    try {
      const result = await publishPost(indexPermlink, indexTitle, indexBody);
      console.log(`    Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
    } catch (e) {
      console.error(`    FAILED: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`${chunks.length} part post(s) + 1 index post`);
  console.log(`Index: @${SERVICE_ACCOUNT}/${indexPermlink}`);

  if (dryRun) {
    console.log('');
    console.log('This was a dry run. No posts were published.');
    console.log('Remove --dry-run to publish for real.');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
