import 'dotenv/config';

/**
 * Gift Card Token Batch Generator
 *
 * Generates a batch of gift card claim tokens with QR codes for the
 * HAA Gift Card Onboarding system. Each token is:
 *   1. Cryptographically random (32 bytes hex)
 *   2. Signed with the provider's memo key for authenticity
 *   3. Encrypted with a 6-char alphanumeric PIN for QR distribution
 *   4. Registered in the SQLite database
 *   5. Declared on-chain with a Merkle root for transparency
 *
 * Usage:
 *   npx tsx giftcard-generate.ts --count 50 [options]
 *
 * Options:
 *   --count <n>           Number of tokens to generate (required)
 *   --expiry-days <n>     Days until expiry (default: 365)
 *   --promise-type <type> Promise type (default: account-creation)
 *   --promise-params <j>  JSON string with type-specific params (default: {})
 *   --note <text>         Batch note for admin reference
 *   --bootstrap-url <url> Bootstrap URL for QR codes (default: GitHub Pages URL)
 *   --service-url <url>   Gift card service URL (required unless --dry-run)
 *   --db-path <path>      SQLite database path (default: ../giftcard/data/tokens.db)
 *   --dry-run             Show what would happen without writing DB or broadcasting
 *   --skip-onchain        Skip on-chain batch declaration (for testing)
 *   --print               Send postcards to default printer after generation
 *
 * Environment variables (from scripts/.env):
 *   GIFTCARD_PROVIDER_ACCOUNT  - Hive account with claimed account tokens
 *   GIFTCARD_ACTIVE_KEY        - Provider's active key (WIF)
 *   GIFTCARD_MEMO_KEY          - Provider's memo key (WIF)
 *   HAA_SERVICE_ACCOUNT        - Feed service account
 *   GIFTCARD_OUTPUT_DIR        - Output directory (default: scripts/giftcard-output)
 *
 * Output:
 *   <GIFTCARD_OUTPUT_DIR>/<batch-id>/
 *     manifest.json        — Full batch manifest (SENSITIVE — contains PINs)
 *     cards/
 *       <token-prefix>-qr.png    — QR code (PNG, 512px)
 *       <token-prefix>-qr.svg    — QR code (SVG, for print)
 *       <token-prefix>-card.txt  — Card details (token prefix, PIN, expiry)
 */

import QRCode from 'qrcode';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import Database from 'better-sqlite3';

// Import from the giftcard service modules
import {
  generateToken,
  generatePin,
  signCardData,
  merkleRoot,
  generateMerkleProof,
  encodeMerkleProof,
  encryptPayload,
  type GiftCardPayload,
} from '../giftcard/src/crypto/signing.js';
import {
  initDatabase,
  createBatch,
  insertToken,
  updateBatchDeclaration,
} from '../giftcard/src/db.js';
import { PDFDocument } from 'pdf-lib';
import { generateInvitePdf } from './generate-invite-pdf.js';

// -- CLI Arguments --

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (key === 'dry-run' || key === 'skip-onchain' || key === 'print') {
        flags.add(key);
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[++i];
      }
    }
  }

  return { parsed, flags };
}

const VALID_LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];

// -- Endpoint Liveness --

async function probeEndpoints(endpoints: string[], minLive = 2): Promise<string[]> {
  const live: string[] = [];
  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'condenser_api.get_config', params: [], id: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) live.push(ep);
        else console.warn(`  Endpoint ${ep}: RPC error — skipping`);
      } else {
        console.warn(`  Endpoint ${ep}: HTTP ${res.status} — skipping`);
      }
    } catch (e) {
      console.warn(`  Endpoint ${ep}: unreachable — skipping`);
    }
  }
  if (live.length < minLive) {
    console.error(`Only ${live.length} live endpoint(s) — need at least ${minLive}. Aborting.`);
    process.exit(1);
  }
  return live;
}

// -- Env Validation --

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// -- On-chain Batch Declaration --

async function declareOnChain(
  providerAccount: string,
  activeKeyWif: string,
  batchId: string,
  count: number,
  expires: string,
  root: string,
  promiseType: string,
  promiseParams?: Record<string, unknown>,
): Promise<string> {
  const payload: Record<string, unknown> = {
    batch_id: batchId,
    count,
    expires,
    merkle_root: root,
    promise_type: promiseType,
  };
  if (promiseParams && Object.keys(promiseParams).length > 0) {
    payload.promise_params = promiseParams;
  }

  const tx = new Transaction();
  await tx.addOperation('custom_json' as any, {
    required_auths: [providerAccount],
    required_posting_auths: [],
    id: 'propolis_giftcard_batch',
    json: JSON.stringify(payload),
  } as any);

  const key = PrivateKey.from(activeKeyWif);
  tx.sign(key);
  const result = await tx.broadcast(true);
  return result.tx_id;
}

// -- Main --

async function main() {
  const { parsed, flags } = parseArgs();
  const dryRun = flags.has('dry-run');
  const skipOnChain = flags.has('skip-onchain');
  const printCards = flags.has('print');

  // Required args
  const count = parseInt(parsed['count'] || '0', 10);
  if (!count || count < 1) {
    console.error('Usage: npx tsx giftcard-generate.ts --count <n> [options]');
    console.error('  --count <n>           Number of tokens to generate (required)');
    console.error('  --variant <type>      Card variant: standard or robust (default: standard)');
    console.error('  --locale <code>       Wallet locale (required for robust): en, zh, ar, fa, ru, tr, vi');
    console.error('  --expiry-days <n>     Days until expiry (default: 365)');
    console.error('  --promise-type <type> Promise type (default: account-creation)');
    console.error('  --promise-params <j>  JSON string with type-specific params');
    console.error('  --note <text>         Batch note');
    console.error('  --bootstrap-url <url> Bootstrap URL for QR codes');
    console.error('  --service-url <url>   Gift card service URL');
    console.error('  --db-path <path>      SQLite database path');
    console.error('  --dry-run             Preview without writing');
    console.error('  --skip-onchain        Skip on-chain declaration');
    console.error('  --print               Send postcards to default printer');
    process.exit(1);
  }

  // Optional args
  const expiryDays = parseInt(parsed['expiry-days'] || '365', 10);
  const promiseType = parsed['promise-type'] || 'account-creation';
  let promiseParams: Record<string, unknown> | undefined;
  if (parsed['promise-params']) {
    try {
      promiseParams = JSON.parse(parsed['promise-params']);
    } catch {
      console.error('Invalid JSON for --promise-params');
      process.exit(1);
    }
  }
  const variant = (parsed['variant'] || 'standard') as 'standard' | 'robust';
  if (variant !== 'standard' && variant !== 'robust') {
    console.error('--variant must be "standard" or "robust"');
    process.exit(1);
  }
  const locale = parsed['locale'] || undefined;
  if (variant === 'robust' && !locale) {
    console.error('--locale is required for robust invites (one of: ' + VALID_LOCALES.join(', ') + ')');
    process.exit(1);
  }
  if (locale && !VALID_LOCALES.includes(locale)) {
    console.error('Invalid --locale. Must be one of: ' + VALID_LOCALES.join(', '));
    process.exit(1);
  }

  const note = parsed['note'] || null;
  const bootstrapUrl = parsed['bootstrap-url'] || 'https://hiveinvite.com';
  const serviceUrl = parsed['service-url'] || '';
  const dbPath = parsed['db-path'] || process.env.GIFTCARD_DB_PATH || resolve(import.meta.dirname, '..', 'giftcard', 'data', 'tokens.db');

  // Env vars
  const providerAccount = requireEnv('GIFTCARD_PROVIDER_ACCOUNT');
  const activeKey = requireEnv('GIFTCARD_ACTIVE_KEY');
  const memoKey = requireEnv('GIFTCARD_MEMO_KEY');
  const haaServiceAccount = requireEnv('HAA_SERVICE_ACCOUNT');

  if (!serviceUrl && !dryRun) {
    console.error('--service-url is required unless using --dry-run');
    process.exit(1);
  }

  // Read endpoint config for card payloads
  let endpoints: string[] = [];
  try {
    const feedConfigPath = resolve(import.meta.dirname, 'feed-config.json');
    const { readFileSync } = await import('node:fs');
    const feedConfig = JSON.parse(readFileSync(feedConfigPath, 'utf-8'));
    endpoints = feedConfig.endpoints || [];
  } catch {
    console.warn('Warning: Could not read feed-config.json — cards will have empty endpoints');
  }

  // Generate batch ID
  const batchId = `batch-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  const expiresIso = expiresAt.toISOString();

  // For robust invites, validate endpoint liveness
  if (variant === 'robust' && endpoints.length > 0 && !dryRun) {
    console.log('Probing endpoint liveness...');
    endpoints = await probeEndpoints(endpoints);
    console.log(`  ${endpoints.length} live endpoint(s)`);
    console.log('');
  }

  console.log('=== HAA Gift Card Batch Generator ===');
  console.log(`Provider:     @${providerAccount}`);
  console.log(`Variant:      ${variant}${locale ? ' (' + locale + ')' : ''}`);
  console.log(`Promise:      ${promiseType}${promiseParams ? ' ' + JSON.stringify(promiseParams) : ''}`);
  console.log(`Count:        ${count}`);
  console.log(`Expiry:       ${expiresIso} (${expiryDays} days)`);
  console.log(`Batch ID:     ${batchId}`);
  console.log(`Service URL:  ${serviceUrl || '(none — dry run)'}`);
  console.log(`Bootstrap:    ${bootstrapUrl}`);
  console.log(`DB Path:      ${dbPath}`);
  console.log(`Endpoints:    ${endpoints.length > 0 ? endpoints.join(', ') : '(none)'}`);
  if (note) console.log(`Note:         ${note}`);
  console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Configure hive-tx
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  // 1. Generate tokens and PINs
  console.log(`Generating ${count} tokens...`);
  const cards: Array<{
    token: string;
    pin: string;
    signature: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const token = generateToken();
    const pin = generatePin();
    const signature = signCardData(token, batchId, providerAccount, expiresIso, promiseType, memoKey);
    cards.push({ token, pin, signature });
  }
  console.log(`  Generated ${cards.length} tokens with PINs and signatures`);

  // 2. Compute Merkle root
  const tokens = cards.map(c => c.token);
  const root = merkleRoot(tokens);
  console.log(`  Merkle root: ${root}`);
  console.log('');

  // 3. Write to database
  let db: Database.Database | null = null;
  if (!dryRun) {
    console.log('Writing to database...');
    db = initDatabase(dbPath);

    createBatch(db, batchId, expiresIso, count, root, undefined, note ?? undefined, promiseType, promiseParams);
    console.log(`  Created batch: ${batchId}`);

    for (const card of cards) {
      insertToken(db, card.token, batchId, card.pin, card.signature, expiresIso);
    }
    console.log(`  Inserted ${cards.length} tokens`);
    console.log('');
  } else {
    console.log('[DRY RUN] Skipping database write');
    console.log('');
  }

  // 4. Declare on-chain
  let declarationTx = '';
  if (!dryRun && !skipOnChain) {
    console.log('Broadcasting on-chain batch declaration...');
    try {
      declarationTx = await declareOnChain(
        providerAccount, activeKey,
        batchId, count, expiresIso, root,
        promiseType, promiseParams,
      );
      console.log(`  Declaration TX: ${declarationTx}`);

      // Update batch record with declaration tx
      if (db) {
        updateBatchDeclaration(db, batchId, declarationTx);
        console.log('  Updated batch record with declaration TX');
      }
    } catch (err) {
      console.error(`  Declaration FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('  Continuing without on-chain declaration...');
    }
    console.log('');
  } else if (dryRun) {
    console.log('[DRY RUN] Would broadcast custom_json:');
    console.log(`  id: propolis_giftcard_batch`);
    console.log(`  json: { batch_id: "${batchId}", count: ${count}, expires: "${expiresIso}", merkle_root: "${root}", promise_type: "${promiseType}" }`);
    console.log('');
  } else {
    console.log('[SKIP] On-chain declaration skipped');
    console.log('');
  }

  // 5. Generate QR codes
  const outputBase = process.env.GIFTCARD_OUTPUT_DIR
    ? resolve(process.env.GIFTCARD_OUTPUT_DIR)
    : resolve(import.meta.dirname, 'giftcard-output');
  const outputDir = resolve(outputBase, batchId);
  const cardsDir = resolve(outputDir, 'cards');
  mkdirSync(cardsDir, { recursive: true });

  // Load Hive logo for invite PDFs
  const logoPath = resolve(import.meta.dirname, '..', 'hive-branding', 'logo', 'png', 'logo_transparent@2.png');
  let logoPngBytes: Uint8Array | undefined;
  if (existsSync(logoPath)) {
    logoPngBytes = new Uint8Array(readFileSync(logoPath));
    console.log(`Loaded Hive logo: ${logoPath}`);
  } else {
    console.warn('Warning: Hive logo not found — PDFs will use text fallback');
  }

  console.log('Generating QR codes...');
  const QR_OPTIONS = {
    errorCorrectionLevel: 'H' as const,
    margin: 2,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  };

  const manifestEntries: Array<{
    tokenPrefix: string;
    pin: string;
    expires: string;
    qrPng: string;
    qrSvg: string;
    invitePdf: string;
    inviteUrl: string;
  }> = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const prefix = card.token.slice(0, 8);

    // Build encrypted payload (includes compact Merkle proof for on-chain validation)
    const merkleProof = encodeMerkleProof(generateMerkleProof(tokens, card.token));
    const payload: GiftCardPayload = {
      token: card.token,
      provider: providerAccount,
      serviceUrl: serviceUrl || 'https://example.com',
      endpoints,
      batchId,
      expires: expiresIso,
      signature: card.signature,
      promiseType,
      ...(promiseParams && Object.keys(promiseParams).length > 0 ? { promiseParams } : {}),
      merkleProof,
      variant,
      ...(locale ? { locale } : {}),
    };

    const encryptedBlob = encryptPayload(payload, card.pin);

    // QR URL: invite app with encrypted blob in fragment
    const qrUrl = `${bootstrapUrl}/invite/#${encryptedBlob}`;

    // Generate QR codes
    const svg = await QRCode.toString(qrUrl, { ...QR_OPTIONS, type: 'svg' });
    const svgPath = resolve(cardsDir, `${prefix}-qr.svg`);
    writeFileSync(svgPath, svg);

    const png = await QRCode.toBuffer(qrUrl, { ...QR_OPTIONS, type: 'png' });
    const pngPath = resolve(cardsDir, `${prefix}-qr.png`);
    writeFileSync(pngPath, png);

    // Card details text file (for printing alongside QR)
    const cardTxt = [
      `Token:   ${prefix}...`,
      `PIN:     ${card.pin}`,
      `Expires: ${expiresIso.split('T')[0]}`,
      `Batch:   ${batchId}`,
    ].join('\n');
    writeFileSync(resolve(cardsDir, `${prefix}-card.txt`), cardTxt);

    // Printable invite postcard PDF (A6 landscape, 2-page)
    const pdfBytes = await generateInvitePdf({
      qrPngBytes: new Uint8Array(png),
      pin: card.pin,
      issuer: providerAccount,
      expires: expiresIso.split('T')[0],
      logoPngBytes,
    });
    const pdfPath = resolve(cardsDir, `${prefix}-invite.pdf`);
    writeFileSync(pdfPath, pdfBytes);

    manifestEntries.push({
      tokenPrefix: prefix,
      pin: card.pin,
      expires: expiresIso,
      qrPng: `cards/${prefix}-qr.png`,
      qrSvg: `cards/${prefix}-qr.svg`,
      invitePdf: `cards/${prefix}-invite.pdf`,
      inviteUrl: qrUrl,
    });

    // Debug: log QR details for each card
    const format = encryptedBlob.startsWith('c1:') ? 'compressed (c1)' : 'legacy';
    console.log(`  [${i + 1}/${cards.length}] ${prefix}  blob=${encryptedBlob.length}ch (${format})  url=${qrUrl.length}ch  png=${png.length}B`);
  }
  console.log(`  Generated ${cards.length} QR code pairs (PNG + SVG) + invite PDFs`);
  console.log('');

  // 6. Merge all invite PDFs into one combined document
  console.log('Merging invite PDFs...');
  const combinedPdf = await PDFDocument.create();
  for (const entry of manifestEntries) {
    const pdfPath = resolve(outputDir, entry.invitePdf);
    const pdfBytes = readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(pdfBytes);
    const pages = await combinedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of pages) combinedPdf.addPage(page);
  }
  const combinedBytes = await combinedPdf.save();
  const combinedPath = resolve(outputDir, 'all-invites.pdf');
  writeFileSync(combinedPath, combinedBytes);
  console.log(`  Combined PDF: ${combinedPath} (${cards.length} cards, ${(combinedBytes.length / 1024).toFixed(0)} KB)`);
  console.log('');

  // 7. Print if requested
  if (printCards) {
    const { execSync } = await import('node:child_process');
    const absPath = resolve(combinedPath);
    try {
      if (process.platform === 'darwin') {
        // macOS: send directly to default printer via CUPS
        console.log('Sending postcards to default printer...');
        execSync(`lp "${absPath}"`);
        console.log('  Sent to printer.');
      } else if (process.platform === 'linux') {
        // Linux: send directly to default printer via CUPS
        console.log('Sending postcards to default printer...');
        execSync(`lpr "${absPath}"`);
        console.log('  Sent to printer.');
      } else {
        // Windows: no reliable silent-print for PDFs without third-party software.
        // Open in default viewer so the user can Ctrl+P.
        console.log('Opening postcards for printing...');
        execSync(`start "" "${absPath}"`, { shell: 'cmd.exe' });
        console.log(`  Opened: ${absPath}`);
        console.log('  Press Ctrl+P in the viewer to print.');
      }
    } catch (err) {
      console.error(`  Could not print: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  Print manually: ${combinedPath}`);
    }
    console.log('');
  }

  // 8. Write manifest
  const manifest = {
    batchId,
    provider: providerAccount,
    variant,
    locale: locale || null,
    promiseType,
    promiseParams: promiseParams || null,
    count,
    createdAt: now.toISOString(),
    expiresAt: expiresIso,
    merkleRoot: root,
    declarationTx: declarationTx || null,
    serviceUrl: serviceUrl || null,
    bootstrapUrl,
    note: note || null,
    cards: manifestEntries,
  };

  const manifestPath = resolve(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${manifestPath}`);
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log(`Batch:          ${batchId}`);
  console.log(`Cards:          ${count}`);
  console.log(`Expires:        ${expiresIso.split('T')[0]}`);
  console.log(`Merkle root:    ${root.slice(0, 16)}...`);
  if (declarationTx) console.log(`Declaration TX: ${declarationTx.slice(0, 16)}...`);
  console.log(`Output:         ${outputDir}`);
  console.log('');
  console.log('⚠️  The manifest contains PINs — store securely and do not commit to git.');

  // Close database
  if (db) db.close();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
