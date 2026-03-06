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

// -- Localized post content --

interface PostStrings {
  title: string;
  heading: string;
  intro: string;
  howToUseHeading: string;
  steps: string[];
  whatThisDoesHeading: string;
  bullets: (account: string, version: string, locale: string) => string[];
  bootstrapHeading: string;
  footer: (account: string) => string;
}

const POST_STRINGS: Record<string, PostStrings> = {
  en: {
    title: 'Propolis Wallet — Bootstrap Loader (EN)',
    heading: '# Propolis Wallet — Bootstrap Loader',
    intro: 'This post contains a self-bootstrapping HTML loader for the **Propolis Wallet**.',
    howToUseHeading: '## How to use',
    steps: [
      '1. Copy the HTML code below',
      '2. Save it as a `.html` file (e.g. `propolis.html`)',
      '3. Open the file in any modern browser (Chrome, Firefox, Safari)',
      '4. The loader will fetch the full wallet from the Hive blockchain, verify its integrity via SHA-256, and load it automatically',
    ],
    whatThisDoesHeading: '## What this does',
    bullets: (account, version, locale) => [
      `- Fetches the Propolis Wallet application from [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) and its comments`,
      `- Verifies every chunk against its SHA-256 hash before executing anything`,
      `- Only loads code published by \`@${account}\` — comments from other accounts are ignored`,
      `- Caches the wallet locally (via IndexedDB) for faster subsequent loads`,
      `- The entire wallet runs locally in your browser — your keys never leave your device`,
    ],
    bootstrapHeading: '## Bootstrap HTML',
    footer: (account) => `*Published by @${account} — [MIT License](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  zh: {
    title: 'Propolis 钱包 — 引导加载器 (ZH)',
    heading: '# Propolis 钱包 — 引导加载器',
    intro: '本帖包含 **Propolis 钱包** 的自引导 HTML 加载器。',
    howToUseHeading: '## 使用方法',
    steps: [
      '1. 复制下方的 HTML 代码',
      '2. 将其保存为 `.html` 文件（例如 `propolis.html`）',
      '3. 用任意现代浏览器打开该文件（Chrome、Firefox、Safari）',
      '4. 加载器将从 Hive 区块链获取完整钱包，通过 SHA-256 验证其完整性，并自动加载',
    ],
    whatThisDoesHeading: '## 工作原理',
    bullets: (account, version, locale) => [
      `- 从 [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) 及其评论中获取 Propolis 钱包应用`,
      `- 在执行任何代码之前，逐块验证 SHA-256 哈希值`,
      `- 仅加载由 \`@${account}\` 发布的代码——其他账户的评论将被忽略`,
      `- 通过 IndexedDB 在本地缓存钱包，加快后续加载速度`,
      `- 整个钱包在您的浏览器中本地运行——您的密钥永远不会离开您的设备`,
    ],
    bootstrapHeading: '## 引导 HTML',
    footer: (account) => `*由 @${account} 发布 — [MIT 许可证](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
};

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

  const strings = POST_STRINGS[locale] || POST_STRINGS['en'];
  const permlink = `propolis-bootstrap-v${version}-${locale}`;
  const title = strings.title;

  const body = [
    strings.heading,
    '',
    strings.intro,
    '',
    strings.howToUseHeading,
    '',
    ...strings.steps,
    '',
    strings.whatThisDoesHeading,
    '',
    ...strings.bullets(ACCOUNT!, version, locale),
    '',
    strings.bootstrapHeading,
    '',
    '```html',
    bootstrapHtml,
    '```',
    '',
    '---',
    strings.footer(ACCOUNT!),
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
