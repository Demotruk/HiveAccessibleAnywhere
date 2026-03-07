import 'dotenv/config';

/**
 * Gift Card Token Management CLI
 *
 * Admin tool for inspecting and managing gift card tokens and batches.
 *
 * Usage:
 *   npx tsx giftcard-manage.ts <command> [options]
 *
 * Commands:
 *   list-batches                             List all batches
 *   list-tokens [--batch <id>] [--status <s>]  List tokens (optionally filtered)
 *   inspect <token>                          Show full details for a token
 *   revoke <token>                           Revoke a single token
 *   revoke-batch <batch-id>                  Revoke all active tokens in a batch
 *   stats                                    Show summary statistics
 *
 * Options:
 *   --db-path <path>   SQLite database path (default: ../giftcard/data/tokens.db)
 */

import { resolve } from 'node:path';
import {
  initDatabase,
  listBatches,
  listTokens,
  getToken,
  revokeToken,
  revokeBatch,
  getStats,
} from '../giftcard/src/db.js';

// -- CLI Arguments --

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || '';
  const positional: string[] = [];
  const parsed: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      parsed[args[i].slice(2)] = args[++i];
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  return { command, positional, parsed };
}

// -- Formatting Helpers --

function formatDate(iso: string): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active': return '[ACTIVE]';
    case 'spent': return '[SPENT] ';
    case 'revoked': return '[REVOKE]';
    default: return `[${status.toUpperCase()}]`;
  }
}

// -- Commands --

function cmdListBatches(dbPath: string) {
  const db = initDatabase(dbPath);
  const batches = listBatches(db);

  if (batches.length === 0) {
    console.log('No batches found.');
    db.close();
    return;
  }

  console.log(`Found ${batches.length} batch(es):\n`);
  console.log('ID                                    Count  Promise              Expires              Note');
  console.log('─'.repeat(110));

  for (const b of batches) {
    const expiry = formatDate(b.expires_at).slice(0, 19);
    const promise = b.promise_type.padEnd(21);
    const note = b.note ? b.note.slice(0, 20) : '';
    console.log(
      `${b.id.padEnd(38)}${String(b.count).padEnd(7)}${promise}${expiry.padEnd(21)}${note}`
    );
  }

  db.close();
}

function cmdListTokens(dbPath: string, batchId?: string, status?: string) {
  const db = initDatabase(dbPath);
  const tokens = listTokens(db, batchId, status);

  if (tokens.length === 0) {
    console.log('No tokens found.');
    db.close();
    return;
  }

  console.log(`Found ${tokens.length} token(s):\n`);
  console.log('Token (prefix)   Status    Batch                                   Expires              Claimed By');
  console.log('─'.repeat(110));

  for (const t of tokens) {
    const prefix = t.token.slice(0, 12) + '...';
    const badge = statusBadge(t.status);
    const expiry = formatDate(t.expires_at).slice(0, 19);
    const claimedBy = t.claimed_by ? `@${t.claimed_by}` : '';
    console.log(
      `${prefix.padEnd(17)}${badge.padEnd(10)}${t.batch_id.padEnd(40)}${expiry.padEnd(21)}${claimedBy}`
    );
  }

  db.close();
}

function cmdInspect(dbPath: string, tokenValue: string) {
  const db = initDatabase(dbPath);
  const token = getToken(db, tokenValue);

  if (!token) {
    console.error(`Token not found: ${tokenValue.slice(0, 12)}...`);
    db.close();
    process.exit(1);
  }

  console.log('=== Token Details ===');
  console.log(`Token:       ${token.token}`);
  console.log(`Batch:       ${token.batch_id}`);
  console.log(`Status:      ${token.status}`);
  console.log(`PIN:         ${token.pin}`);
  console.log(`Signature:   ${token.signature.slice(0, 32)}...`);
  console.log(`Created:     ${formatDate(token.created_at)}`);
  console.log(`Expires:     ${formatDate(token.expires_at)}`);
  if (token.claimed_by) {
    console.log(`Claimed by:  @${token.claimed_by}`);
    console.log(`Claimed at:  ${formatDate(token.claimed_at!)}`);
    console.log(`Claimed IP:  ${token.claimed_ip}`);
    console.log(`TX ID:       ${token.tx_id}`);
  }

  db.close();
}

function cmdRevoke(dbPath: string, tokenValue: string) {
  const db = initDatabase(dbPath);
  const success = revokeToken(db, tokenValue);

  if (success) {
    console.log(`Token revoked: ${tokenValue.slice(0, 12)}...`);
  } else {
    console.error(`Could not revoke token (not found or not active): ${tokenValue.slice(0, 12)}...`);
    db.close();
    process.exit(1);
  }

  db.close();
}

function cmdRevokeBatch(dbPath: string, batchId: string) {
  const db = initDatabase(dbPath);
  const count = revokeBatch(db, batchId);

  if (count > 0) {
    console.log(`Revoked ${count} active token(s) in batch: ${batchId}`);
  } else {
    console.log(`No active tokens found in batch: ${batchId}`);
  }

  db.close();
}

function cmdStats(dbPath: string) {
  const db = initDatabase(dbPath);
  const stats = getStats(db);

  console.log('=== Gift Card Token Statistics ===');
  console.log(`Total:                ${stats.total}`);
  console.log(`Active:               ${stats.active}`);
  console.log(`Spent:                ${stats.spent}`);
  console.log(`Revoked:              ${stats.revoked}`);
  console.log(`Expiring within 30d:  ${stats.expiringWithin30d}`);
  console.log(`Expiring within 60d:  ${stats.expiringWithin60d}`);
  console.log(`Expiring within 90d:  ${stats.expiringWithin90d}`);

  db.close();
}

// -- Main --

function main() {
  const { command, positional, parsed } = parseArgs();
  const dbPath = parsed['db-path'] || resolve(import.meta.dirname, '..', 'giftcard', 'data', 'tokens.db');

  switch (command) {
    case 'list-batches':
      cmdListBatches(dbPath);
      break;

    case 'list-tokens':
      cmdListTokens(dbPath, parsed['batch'], parsed['status']);
      break;

    case 'inspect':
      if (positional.length < 1) {
        console.error('Usage: npx tsx giftcard-manage.ts inspect <token>');
        process.exit(1);
      }
      cmdInspect(dbPath, positional[0]);
      break;

    case 'revoke':
      if (positional.length < 1) {
        console.error('Usage: npx tsx giftcard-manage.ts revoke <token>');
        process.exit(1);
      }
      cmdRevoke(dbPath, positional[0]);
      break;

    case 'revoke-batch':
      if (positional.length < 1) {
        console.error('Usage: npx tsx giftcard-manage.ts revoke-batch <batch-id>');
        process.exit(1);
      }
      cmdRevokeBatch(dbPath, positional[0]);
      break;

    case 'stats':
      cmdStats(dbPath);
      break;

    default:
      console.log('Gift Card Token Management CLI');
      console.log('');
      console.log('Commands:');
      console.log('  list-batches                              List all batches');
      console.log('  list-tokens [--batch <id>] [--status <s>] List tokens');
      console.log('  inspect <token>                           Show token details');
      console.log('  revoke <token>                            Revoke a token');
      console.log('  revoke-batch <batch-id>                   Revoke all active tokens in batch');
      console.log('  stats                                     Show statistics');
      console.log('');
      console.log('Options:');
      console.log('  --db-path <path>  SQLite database path');
      process.exit(command ? 1 : 0);
  }
}

main();
