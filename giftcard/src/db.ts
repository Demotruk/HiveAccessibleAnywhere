/**
 * SQLite database layer for gift card token storage.
 *
 * Uses better-sqlite3 for synchronous, embedded SQLite access.
 * WAL mode is enabled for better concurrent read performance.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// -- Types --

export interface BatchRow {
  id: string;
  created_at: string;
  expires_at: string;
  count: number;
  merkle_root: string | null;
  declaration_tx: string | null;
  note: string | null;
  promise_type: string;
  promise_params: string | null;
}

export interface TokenRow {
  token: string;
  batch_id: string;
  status: 'active' | 'spent' | 'revoked';
  pin: string;
  signature: string;
  created_at: string;
  expires_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_ip: string | null;
  tx_id: string | null;
}

// -- Initialization --

/**
 * Initialize the SQLite database, creating tables if they don't exist.
 */
export function initDatabase(dbPath: string): Database.Database {
  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id              TEXT PRIMARY KEY,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at      TEXT NOT NULL,
      count           INTEGER NOT NULL,
      merkle_root     TEXT,
      declaration_tx  TEXT,
      note            TEXT,
      promise_type    TEXT NOT NULL DEFAULT 'account-creation',
      promise_params  TEXT
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token       TEXT PRIMARY KEY,
      batch_id    TEXT NOT NULL REFERENCES batches(id),
      status      TEXT NOT NULL DEFAULT 'active',
      pin         TEXT NOT NULL,
      signature   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      claimed_by  TEXT,
      claimed_at  TEXT,
      claimed_ip  TEXT,
      tx_id       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_batch ON tokens(batch_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
  `);

  return db;
}

// -- Batch operations --

/**
 * Create a new batch record.
 */
export function createBatch(
  db: Database.Database,
  id: string,
  expiresAt: string,
  count: number,
  merkleRoot?: string,
  declarationTx?: string,
  note?: string,
  promiseType: string = 'account-creation',
  promiseParams?: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO batches (id, expires_at, count, merkle_root, declaration_tx, note, promise_type, promise_params)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, expiresAt, count,
    merkleRoot ?? null, declarationTx ?? null, note ?? null,
    promiseType, promiseParams ? JSON.stringify(promiseParams) : null,
  );
}

/**
 * Update a batch's declaration transaction ID.
 */
export function updateBatchDeclaration(
  db: Database.Database,
  batchId: string,
  declarationTx: string,
): void {
  db.prepare('UPDATE batches SET declaration_tx = ? WHERE id = ?')
    .run(declarationTx, batchId);
}

/**
 * List all batches.
 */
export function listBatches(db: Database.Database): BatchRow[] {
  return db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all() as BatchRow[];
}

// -- Token operations --

/**
 * Insert a new token record.
 */
export function insertToken(
  db: Database.Database,
  token: string,
  batchId: string,
  pin: string,
  signature: string,
  expiresAt: string,
): void {
  db.prepare(`
    INSERT INTO tokens (token, batch_id, pin, signature, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, batchId, pin, signature, expiresAt);
}

/**
 * Look up a token by its value.
 */
export function getToken(db: Database.Database, token: string): TokenRow | null {
  const row = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token);
  return (row as TokenRow) ?? null;
}

/**
 * Token with its batch's promise type and params, for claim dispatch.
 */
export interface TokenWithPromise extends TokenRow {
  promise_type: string;
  promise_params: string | null;
}

/**
 * Look up a token joined with its batch's promise type.
 */
export function getTokenWithBatch(db: Database.Database, token: string): TokenWithPromise | null {
  const row = db.prepare(`
    SELECT t.*, b.promise_type, b.promise_params
    FROM tokens t
    JOIN batches b ON t.batch_id = b.id
    WHERE t.token = ?
  `).get(token);
  return (row as TokenWithPromise) ?? null;
}

/**
 * Mark a token as spent after successful account creation.
 */
export function markTokenSpent(
  db: Database.Database,
  token: string,
  claimedBy: string,
  ip: string,
  txId: string,
): void {
  db.prepare(`
    UPDATE tokens
    SET status = 'spent',
        claimed_by = ?,
        claimed_at = datetime('now'),
        claimed_ip = ?,
        tx_id = ?
    WHERE token = ?
  `).run(claimedBy, ip, txId, token);
}

/**
 * Revoke a single token.
 */
export function revokeToken(db: Database.Database, token: string): boolean {
  const result = db.prepare(
    "UPDATE tokens SET status = 'revoked' WHERE token = ? AND status = 'active'"
  ).run(token);
  return result.changes > 0;
}

/**
 * Revoke all active tokens in a batch.
 */
export function revokeBatch(db: Database.Database, batchId: string): number {
  const result = db.prepare(
    "UPDATE tokens SET status = 'revoked' WHERE batch_id = ? AND status = 'active'"
  ).run(batchId);
  return result.changes;
}

/**
 * List tokens, optionally filtered by batch and/or status.
 */
export function listTokens(
  db: Database.Database,
  batchId?: string,
  status?: string,
): TokenRow[] {
  const conditions: string[] = [];
  const params: string[] = [];

  if (batchId) {
    conditions.push('batch_id = ?');
    params.push(batchId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM tokens ${where} ORDER BY created_at DESC`).all(...params) as TokenRow[];
}

/**
 * Get summary statistics.
 */
export function getStats(db: Database.Database): {
  total: number;
  active: number;
  spent: number;
  revoked: number;
  expiringWithin30d: number;
  expiringWithin60d: number;
  expiringWithin90d: number;
} {
  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM tokens GROUP BY status
  `).all() as { status: string; count: number }[];

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.status] = row.count;

  const total = Object.values(countMap).reduce((a, b) => a + b, 0);

  const expiringQuery = db.prepare(`
    SELECT COUNT(*) as count FROM tokens
    WHERE status = 'active' AND expires_at <= datetime('now', ?)
  `);

  return {
    total,
    active: countMap['active'] ?? 0,
    spent: countMap['spent'] ?? 0,
    revoked: countMap['revoked'] ?? 0,
    expiringWithin30d: (expiringQuery.get('+30 days') as { count: number }).count,
    expiringWithin60d: (expiringQuery.get('+60 days') as { count: number }).count,
    expiringWithin90d: (expiringQuery.get('+90 days') as { count: number }).count,
  };
}
