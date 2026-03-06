import 'dotenv/config';

/**
 * Publish bootstrap HTML as a Hive post.
 *
 * This makes the bootstrap loader discoverable on-chain — users can find it
 * on any Hive frontend (peakd.com, hive.blog, ecency.com), copy the HTML,
 * save it as a file, and open it in a browser to load the full wallet.
 *
 * Usage:
 *   npx tsx publish-bootstrap.ts [--locale en] [--version 1] [--dry-run]
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const version = getArg('--version', '1');
const locale = getArg('--locale', 'en');

// -- Load environment --

const ACCOUNT = process.env.PROPOLIS_ACCOUNT || process.env.HAA_SERVICE_ACCOUNT;
const POSTING_KEY = process.env.PROPOLIS_POSTING_KEY || process.env.HAA_POSTING_KEY;

if (!ACCOUNT || !POSTING_KEY) {
  console.error('Missing environment variables: PROPOLIS_ACCOUNT, PROPOLIS_POSTING_KEY');
  process.exit(1);
}

// -- Config --

const DIST_DIR = resolve(import.meta.dirname, '..', 'wallet', 'dist');

// -- Main --

async function main() {
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  const bootstrapPath = resolve(DIST_DIR, `propolis-bootstrap-${locale}.html`);
  let bootstrapHtml: string;
  try {
    bootstrapHtml = readFileSync(bootstrapPath, 'utf-8');
  } catch {
    console.error(`Bootstrap file not found: ${bootstrapPath}`);
    console.error('Run the distribute script first to generate bootstrap files.');
    process.exit(1);
  }

  const permlink = `propolis-bootstrap-v${version}-${locale}`;
  const title = `Propolis Wallet — Bootstrap Loader (${locale.toUpperCase()})`;

  const body = [
    `# Propolis Wallet — Bootstrap Loader`,
    '',
    `This post contains a self-bootstrapping HTML loader for the **Propolis Wallet**.`,
    '',
    `## How to use`,
    '',
    `1. Copy the HTML code below`,
    `2. Save it as a \`.html\` file (e.g. \`propolis.html\`)`,
    `3. Open the file in any modern browser (Chrome, Firefox, Safari)`,
    `4. The loader will fetch the full wallet from the Hive blockchain, verify its integrity via SHA-256, and load it automatically`,
    '',
    `## What this does`,
    '',
    `- Fetches the Propolis Wallet application from [@${ACCOUNT}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${ACCOUNT}/propolis-wallet-v${version}-${locale}) and its comments`,
    `- Verifies every chunk against its SHA-256 hash before executing anything`,
    `- Only loads code published by \`@${ACCOUNT}\` — comments from other accounts are ignored`,
    `- Caches the wallet locally (via IndexedDB) for faster subsequent loads`,
    `- The entire wallet runs locally in your browser — your keys never leave your device`,
    '',
    `## Bootstrap HTML`,
    '',
    '```html',
    bootstrapHtml,
    '```',
    '',
    '---',
    `*Published by @${ACCOUNT} — [MIT License](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  ].join('\n');

  console.log(`Publishing bootstrap post: @${ACCOUNT}/${permlink}`);
  console.log(`Title: ${title}`);
  console.log(`Body size: ${(Buffer.byteLength(body, 'utf-8') / 1024).toFixed(1)} KB`);

  if (dryRun) {
    console.log('[DRY RUN] Would publish post');
    console.log(`\nPreview:\n${body.slice(0, 500)}...`);
    return;
  }

  const tx = new Transaction();
  await tx.addOperation('comment' as any, {
    parent_author: '',
    parent_permlink: 'propolis-wallet',
    author: ACCOUNT,
    permlink,
    title,
    body,
    json_metadata: JSON.stringify({
      app: 'propolis-wallet/1.0.0',
      tags: ['propolis-wallet', 'hive-wallet', 'bootstrap', 'open-source'],
      format: 'markdown',
    }),
  } as any);

  const key = PrivateKey.from(POSTING_KEY!);
  tx.sign(key);
  const result = await tx.broadcast(true);
  console.log(`Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
  console.log(`\nView at:`);
  console.log(`  https://peakd.com/@${ACCOUNT}/${permlink}`);
  console.log(`  https://hive.blog/@${ACCOUNT}/${permlink}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
