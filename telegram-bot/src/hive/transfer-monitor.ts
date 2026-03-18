/**
 * HBD transfer monitor.
 *
 * Polls the operator's Hive account history for incoming transfers
 * with memos matching pending payments (format: "pay-<id>").
 */

import { randomBytes } from 'node:crypto';
import { config as hiveTxConfig } from 'hive-tx';
import type { Bot } from 'grammy';
import type Database from 'better-sqlite3';
import {
  getPendingPaymentByMemo,
  confirmPayment,
  createSharedLink,
  reserveCard,
  getExpiredPayments,
  expirePayment,
  releaseCard,
} from '../db.js';
import type { BotConfig } from '../config.js';

function generateShortCode(): string {
  return randomBytes(6).toString('base64url');
}

const POLL_INTERVAL_MS = 15_000;
const EXPIRY_CHECK_INTERVAL_MS = 5 * 60_000;
const MEMO_PREFIX = 'pay-';

/** High-water mark: last processed account history index */
let lastProcessedIndex = -1;

async function fetchAccountHistory(
  account: string,
  start: number,
  limit: number,
): Promise<Array<[number, { op: [string, Record<string, string>]; trx_id: string }]>> {
  const node = hiveTxConfig.nodes![0];
  const resp = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_account_history',
      params: [account, start, limit],
      id: 1,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await resp.json() as { result?: Array<[number, { op: [string, Record<string, string>]; trx_id: string }]>; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result ?? [];
}

async function pollTransfers(bot: Bot, db: Database.Database, config: BotConfig): Promise<void> {
  try {
    // Skip polling if no payments are pending
    const pending = db.prepare("SELECT 1 FROM payments WHERE status = 'pending' LIMIT 1").get();
    if (!pending) return;

    const history = await fetchAccountHistory(config.hiveAccount, -1, 100);

    for (const [index, entry] of history) {
      if (index <= lastProcessedIndex) continue;

      const [opType, opData] = entry.op;
      if (opType !== 'transfer') continue;
      if (opData.to !== config.hiveAccount) continue;

      const memo = opData.memo?.trim();
      if (!memo || !memo.startsWith(MEMO_PREFIX)) continue;

      const paymentId = memo.slice(MEMO_PREFIX.length);
      const payment = getPendingPaymentByMemo(db, paymentId);
      if (!payment) continue;

      // Verify amount (parse "X.XXX HBD")
      const receivedAmount = parseFloat(opData.amount);
      const expectedAmount = parseFloat(payment.amount_hbd);
      if (isNaN(receivedAmount) || receivedAmount < expectedAmount) {
        console.log(`Payment ${paymentId}: amount ${opData.amount} < expected ${payment.amount_hbd}, ignoring`);
        continue;
      }
      if (!opData.amount.includes('HBD')) {
        console.log(`Payment ${paymentId}: received non-HBD transfer (${opData.amount}), ignoring`);
        continue;
      }

      // Confirm payment and generate a shareable link
      confirmPayment(db, paymentId, entry.trx_id);

      const code = generateShortCode();
      reserveCard(db, payment.card_id!, `share-${code}`);
      createSharedLink(db, code, payment.card_id!, payment.telegram_user_id);

      const botInfo = bot.botInfo;
      const link = `https://t.me/${botInfo.username}?start=gc_${code}`;

      // Send the shareable link to the buyer
      try {
        await bot.api.sendMessage(
          parseInt(payment.telegram_chat_id, 10),
          `Payment confirmed! Here's your gift card link:\n\n${link}\n\n` +
          `Share it with the recipient — they'll receive the card when they tap the link.`,
        );
      } catch {
        // Non-critical
      }
    }

    // Update high-water mark
    if (history.length > 0) {
      const maxIndex = Math.max(...history.map(([idx]) => idx));
      if (maxIndex > lastProcessedIndex) {
        lastProcessedIndex = maxIndex;
      }
    }
  } catch (err) {
    console.error('Transfer monitor poll error:', err);
  }
}

function cleanupExpiredPayments(db: Database.Database): void {
  try {
    const expired = getExpiredPayments(db);
    for (const payment of expired) {
      expirePayment(db, payment.id);
      if (payment.card_id) {
        releaseCard(db, payment.card_id);
      }
      console.log(`Payment ${payment.id} expired, card released`);
    }
  } catch (err) {
    console.error('Expiry cleanup error:', err);
  }
}

export function startTransferMonitor(bot: Bot, db: Database.Database, config: BotConfig): void {
  // Initialize high-water mark to current latest so we don't process old transfers
  fetchAccountHistory(config.hiveAccount, -1, 1)
    .then(history => {
      if (history.length > 0) {
        lastProcessedIndex = history[history.length - 1][0];
        console.log(`Transfer monitor initialized, starting from index ${lastProcessedIndex}`);
      }
    })
    .catch(err => console.error('Failed to initialize transfer monitor:', err));

  // Poll for new transfers
  setInterval(() => pollTransfers(bot, db, config), POLL_INTERVAL_MS);

  // Cleanup expired payments
  setInterval(() => cleanupExpiredPayments(db), EXPIRY_CHECK_INTERVAL_MS);
  // Run once immediately
  cleanupExpiredPayments(db);

  console.log(`Transfer monitor started (polling every ${POLL_INTERVAL_MS / 1000}s)`);
}
