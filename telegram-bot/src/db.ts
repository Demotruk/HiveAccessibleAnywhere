/**
 * SQLite database layer for Telegram bot state.
 *
 * Tracks gift card inventory, pending payments, and delivery log.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// -- Types --

export interface CardRow {
  id: number;
  batch_id: string;
  token_prefix: string;
  pdf_path: string;
  invite_url: string | null;
  status: 'available' | 'reserved' | 'delivered';
  loaded_at: string;
  reserved_for: string | null;
  delivered_to: string | null;
  delivered_at: string | null;
}

export interface PaymentRow {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  recipient_user_id: string | null;
  recipient_username: string | null;
  amount_hbd: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  hive_tx_id: string | null;
  card_id: number | null;
}

// -- Initialization --

export function initDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id      TEXT NOT NULL,
      token_prefix  TEXT NOT NULL,
      pdf_path      TEXT NOT NULL,
      invite_url    TEXT,
      status        TEXT NOT NULL DEFAULT 'available',
      loaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
      reserved_for  TEXT,
      delivered_to  TEXT,
      delivered_at  TEXT,
      UNIQUE(batch_id, token_prefix)
    );

    CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
  `);

  // Migrate: add invite_url column if missing (existing databases)
  const cols = db.pragma('table_info(cards)') as { name: string }[];
  if (!cols.some(c => c.name === 'invite_url')) {
    db.exec('ALTER TABLE cards ADD COLUMN invite_url TEXT');
  }

  db.exec(`

    CREATE TABLE IF NOT EXISTS payments (
      id                  TEXT PRIMARY KEY,
      telegram_user_id    TEXT NOT NULL,
      telegram_chat_id    TEXT NOT NULL,
      recipient_user_id   TEXT,
      recipient_username  TEXT,
      amount_hbd          TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at          TEXT NOT NULL,
      confirmed_at        TEXT,
      hive_tx_id          TEXT,
      card_id             INTEGER REFERENCES cards(id)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trusted_users (
      telegram_user_id  TEXT PRIMARY KEY,
      added_by          TEXT NOT NULL,
      added_at          TEXT NOT NULL DEFAULT (datetime('now')),
      note              TEXT
    );
  `);

  return db;
}

// -- Card operations --

export function loadCards(
  db: Database.Database,
  batchId: string,
  cards: Array<{ tokenPrefix: string; pdfPath: string; inviteUrl?: string }>,
): number {
  const insert = db.prepare(`
    INSERT INTO cards (batch_id, token_prefix, pdf_path, invite_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(batch_id, token_prefix) DO UPDATE SET
      invite_url = COALESCE(excluded.invite_url, cards.invite_url),
      pdf_path = excluded.pdf_path
  `);

  let loaded = 0;
  const tx = db.transaction(() => {
    for (const card of cards) {
      const result = insert.run(batchId, card.tokenPrefix, card.pdfPath, card.inviteUrl ?? null);
      if (result.changes > 0) loaded++;
    }
  });
  tx();
  return loaded;
}

export function getAvailableCard(db: Database.Database): CardRow | null {
  return (db.prepare(
    "SELECT * FROM cards WHERE status = 'available' ORDER BY id LIMIT 1"
  ).get() as CardRow) ?? null;
}

export function reserveCard(db: Database.Database, cardId: number, paymentId: string): void {
  db.prepare(
    "UPDATE cards SET status = 'reserved', reserved_for = ? WHERE id = ?"
  ).run(paymentId, cardId);
}

export function markCardDelivered(db: Database.Database, cardId: number, telegramUserId: string): void {
  db.prepare(
    "UPDATE cards SET status = 'delivered', delivered_to = ?, delivered_at = datetime('now') WHERE id = ?"
  ).run(telegramUserId, cardId);
}

export function releaseCard(db: Database.Database, cardId: number): void {
  db.prepare(
    "UPDATE cards SET status = 'available', reserved_for = NULL WHERE id = ?"
  ).run(cardId);
}

export function clearBatch(db: Database.Database, batchId: string): { deleted: number; skipped: number } {
  // Only delete available cards — preserve delivered/reserved for audit trail
  const available = db.prepare(
    "SELECT COUNT(*) as count FROM cards WHERE batch_id = ? AND status = 'available'"
  ).get(batchId) as { count: number };
  const nonAvailable = db.prepare(
    "SELECT COUNT(*) as count FROM cards WHERE batch_id = ? AND status != 'available'"
  ).get(batchId) as { count: number };

  db.prepare("DELETE FROM cards WHERE batch_id = ? AND status = 'available'").run(batchId);

  return { deleted: available.count, skipped: nonAvailable.count };
}

export function getCardCounts(db: Database.Database): { available: number; reserved: number; delivered: number } {
  const rows = db.prepare(
    "SELECT status, COUNT(*) as count FROM cards GROUP BY status"
  ).all() as { status: string; count: number }[];

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;

  return {
    available: counts['available'] ?? 0,
    reserved: counts['reserved'] ?? 0,
    delivered: counts['delivered'] ?? 0,
  };
}

// -- Payment operations --

export function createPayment(
  db: Database.Database,
  payment: {
    id: string;
    telegramUserId: string;
    telegramChatId: string;
    recipientUserId: string | null;
    recipientUsername: string | null;
    amountHbd: string;
    expiresAt: string;
    cardId: number;
  },
): void {
  db.prepare(`
    INSERT INTO payments (id, telegram_user_id, telegram_chat_id, recipient_user_id, recipient_username, amount_hbd, expires_at, card_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.id,
    payment.telegramUserId,
    payment.telegramChatId,
    payment.recipientUserId,
    payment.recipientUsername,
    payment.amountHbd,
    payment.expiresAt,
    payment.cardId,
  );
}

export function getPendingPaymentByMemo(db: Database.Database, memo: string): (PaymentRow & { pdf_path: string; invite_url: string | null }) | null {
  return (db.prepare(`
    SELECT p.*, c.pdf_path, c.invite_url
    FROM payments p
    JOIN cards c ON p.card_id = c.id
    WHERE p.id = ? AND p.status = 'pending'
  `).get(memo) as (PaymentRow & { pdf_path: string; invite_url: string | null })) ?? null;
}

export function confirmPayment(db: Database.Database, paymentId: string, hiveTxId: string): void {
  db.prepare(
    "UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now'), hive_tx_id = ? WHERE id = ?"
  ).run(hiveTxId, paymentId);
}

export function getExpiredPayments(db: Database.Database): PaymentRow[] {
  return db.prepare(
    "SELECT * FROM payments WHERE status = 'pending' AND expires_at <= datetime('now')"
  ).all() as PaymentRow[];
}

export function expirePayment(db: Database.Database, paymentId: string): void {
  db.prepare(
    "UPDATE payments SET status = 'expired' WHERE id = ?"
  ).run(paymentId);
}

// -- Config operations --

export function getConfigValue(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfigValue(db: Database.Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

// -- Trusted user operations --

export function addTrustedUser(db: Database.Database, telegramUserId: string, addedBy: string, note?: string): boolean {
  const result = db.prepare(
    'INSERT OR IGNORE INTO trusted_users (telegram_user_id, added_by, note) VALUES (?, ?, ?)'
  ).run(telegramUserId, addedBy, note ?? null);
  return result.changes > 0;
}

export function removeTrustedUser(db: Database.Database, telegramUserId: string): boolean {
  const result = db.prepare('DELETE FROM trusted_users WHERE telegram_user_id = ?').run(telegramUserId);
  return result.changes > 0;
}

export function isTrustedUser(db: Database.Database, telegramUserId: string): boolean {
  const row = db.prepare('SELECT 1 FROM trusted_users WHERE telegram_user_id = ?').get(telegramUserId);
  return !!row;
}

export function getTrustedUsers(db: Database.Database): Array<{ telegram_user_id: string; added_at: string; note: string | null }> {
  return db.prepare('SELECT telegram_user_id, added_at, note FROM trusted_users ORDER BY added_at').all() as any[];
}
