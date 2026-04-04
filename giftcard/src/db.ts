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
  provider: string | null;
  pdf_data: Buffer | null;
  manifest_data: string | null;
  status: 'pending' | 'active';
  signature: string | null;
  options_json: string | null;
}

export interface IssuerRow {
  username: string;
  status: 'pending' | 'approved' | 'active';
  description: string | null;
  contact: string | null;
  applied_at: string;
  apply_tx_id: string | null;
  approved_at: string | null;
  approve_tx_id: string | null;
  delegation_verified_at: string | null;
  service_url: string | null;
}

export interface IssuerWithStats extends IssuerRow {
  batch_count: number;
  total_cards: number;
  claimed_cards: number;
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

    CREATE TABLE IF NOT EXISTS spent_tokens (
      token_hash   TEXT PRIMARY KEY,
      batch_id     TEXT NOT NULL,
      claimed_by   TEXT NOT NULL,
      claimed_at   TEXT NOT NULL DEFAULT (datetime('now')),
      claimed_ip   TEXT,
      tx_id        TEXT,
      provider     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_spent_tokens_batch ON spent_tokens(batch_id);
  `);

  // -- Migrations for existing databases --
  migrateSpentTokensProvider(db);
  migrateBatchesForDashboard(db);
  migrateIssuersTable(db);
  migrateBatchSigning(db);

  return db;
}

/**
 * Add the `provider` column to spent_tokens if it doesn't exist.
 * Safe to run on both new and existing databases.
 */
function migrateSpentTokensProvider(db: Database.Database): void {
  const columns = db.pragma('table_info(spent_tokens)') as Array<{ name: string }>;
  const hasProvider = columns.some(c => c.name === 'provider');
  if (!hasProvider) {
    db.exec('ALTER TABLE spent_tokens ADD COLUMN provider TEXT');
    console.log('[DB] Migrated spent_tokens: added provider column');
  }
}

/**
 * Add dashboard columns to batches table if they don't exist.
 */
function migrateBatchesForDashboard(db: Database.Database): void {
  const columns = db.pragma('table_info(batches)') as Array<{ name: string }>;
  const colNames = new Set(columns.map(c => c.name));
  if (!colNames.has('provider')) {
    db.exec('ALTER TABLE batches ADD COLUMN provider TEXT');
    console.log('[DB] Migrated batches: added provider column');
  }
  if (!colNames.has('pdf_data')) {
    db.exec('ALTER TABLE batches ADD COLUMN pdf_data BLOB');
    console.log('[DB] Migrated batches: added pdf_data column');
  }
  if (!colNames.has('manifest_data')) {
    db.exec('ALTER TABLE batches ADD COLUMN manifest_data TEXT');
    console.log('[DB] Migrated batches: added manifest_data column');
  }
}

/**
 * Create the issuers table if it doesn't exist.
 */
function migrateIssuersTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS issuers (
      username                TEXT PRIMARY KEY,
      status                  TEXT NOT NULL DEFAULT 'pending',
      description             TEXT,
      contact                 TEXT,
      applied_at              TEXT NOT NULL DEFAULT (datetime('now')),
      apply_tx_id             TEXT,
      approved_at             TEXT,
      approve_tx_id           TEXT,
      delegation_verified_at  TEXT,
      service_url             TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_issuers_status ON issuers(status);
  `);

  // Migration: add service_url column to existing issuers tables
  const cols = db.pragma('table_info(issuers)') as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'service_url')) {
    db.exec('ALTER TABLE issuers ADD COLUMN service_url TEXT');
    console.log('[DB] Migrated issuers: added service_url column');
  }
}

/**
 * Add batch-signing columns to batches table if they don't exist.
 * - status: 'pending' or 'active' (default 'active' for existing rows)
 * - signature: batch-level signature hex string
 * - options_json: serialized generation options for the finalize step
 */
function migrateBatchSigning(db: Database.Database): void {
  const columns = db.pragma('table_info(batches)') as Array<{ name: string }>;
  const colNames = new Set(columns.map(c => c.name));
  if (!colNames.has('status')) {
    db.exec("ALTER TABLE batches ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    console.log('[DB] Migrated batches: added status column');
  }
  if (!colNames.has('signature')) {
    db.exec('ALTER TABLE batches ADD COLUMN signature TEXT');
    console.log('[DB] Migrated batches: added signature column');
  }
  if (!colNames.has('options_json')) {
    db.exec('ALTER TABLE batches ADD COLUMN options_json TEXT');
    console.log('[DB] Migrated batches: added options_json column');
  }
}

// -- Issuer operations --

/**
 * Create an issuer application. Returns false if already exists.
 */
export function createIssuerApplication(
  db: Database.Database,
  username: string,
  description: string,
  contact?: string,
  applyTxId?: string,
): boolean {
  try {
    db.prepare(`
      INSERT INTO issuers (username, status, description, contact, apply_tx_id)
      VALUES (?, 'pending', ?, ?, ?)
    `).run(username, description, contact ?? null, applyTxId ?? null);
    return true;
  } catch (err: unknown) {
    // UNIQUE constraint = already exists
    if (err instanceof Error && err.message.includes('UNIQUE')) return false;
    throw err;
  }
}

/**
 * Get an issuer record by username.
 */
export function getIssuer(db: Database.Database, username: string): IssuerRow | null {
  return (db.prepare('SELECT * FROM issuers WHERE username = ?').get(username) as IssuerRow | undefined) ?? null;
}

/**
 * List issuers filtered by status.
 */
export function listIssuersByStatus(db: Database.Database, status: string): IssuerRow[] {
  return db.prepare('SELECT * FROM issuers WHERE status = ? ORDER BY applied_at DESC').all(status) as IssuerRow[];
}

/**
 * List all issuers with batch statistics.
 */
export function listAllIssuers(db: Database.Database): IssuerWithStats[] {
  return db.prepare(`
    SELECT
      i.*,
      COALESCE(bs.batch_count, 0) AS batch_count,
      COALESCE(bs.total_cards, 0) AS total_cards,
      COALESCE(bs.claimed_cards, 0) AS claimed_cards
    FROM issuers i
    LEFT JOIN (
      SELECT
        b.provider,
        COUNT(DISTINCT b.id) AS batch_count,
        SUM(b.count) AS total_cards,
        COUNT(CASE WHEN t.status = 'spent' THEN 1 END) AS claimed_cards
      FROM batches b
      LEFT JOIN tokens t ON t.batch_id = b.id
      WHERE b.provider IS NOT NULL
      GROUP BY b.provider
    ) bs ON bs.provider = i.username
    ORDER BY i.applied_at DESC
  `).all() as IssuerWithStats[];
}

/**
 * Update an issuer's status and optional fields.
 */
export function updateIssuerStatus(
  db: Database.Database,
  username: string,
  status: IssuerRow['status'],
  extra?: { approved_at?: string; approve_tx_id?: string; delegation_verified_at?: string; service_url?: string | null },
): boolean {
  const sets = ['status = ?'];
  const params: (string | null)[] = [status];

  if (extra?.approved_at) { sets.push('approved_at = ?'); params.push(extra.approved_at); }
  if (extra?.approve_tx_id) { sets.push('approve_tx_id = ?'); params.push(extra.approve_tx_id); }
  if (extra?.delegation_verified_at) { sets.push('delegation_verified_at = ?'); params.push(extra.delegation_verified_at); }
  if (extra?.service_url !== undefined) { sets.push('service_url = ?'); params.push(extra.service_url ?? null); }

  params.push(username);
  const result = db.prepare(`UPDATE issuers SET ${sets.join(', ')} WHERE username = ?`).run(...params);
  return result.changes > 0;
}

/**
 * Update an issuer's external service URL.
 */
export function updateIssuerServiceUrl(
  db: Database.Database,
  username: string,
  serviceUrl: string | null,
): boolean {
  const result = db.prepare('UPDATE issuers SET service_url = ? WHERE username = ?').run(serviceUrl, username);
  return result.changes > 0;
}

/**
 * Check if a username is an active issuer in the database.
 */
export function isIssuerActive(db: Database.Database, username: string): boolean {
  const row = db.prepare("SELECT 1 FROM issuers WHERE username = ? AND status = 'active'").get(username);
  return !!row;
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

// -- Spent token tracking (for Merkle proof validation path) --

/**
 * Check if a token hash has already been spent.
 * Used by the Merkle proof validation path where tokens are not pre-loaded in the DB.
 */
export function isTokenSpent(db: Database.Database, tokenHash: string): boolean {
  const row = db.prepare('SELECT 1 FROM spent_tokens WHERE token_hash = ?').get(tokenHash);
  return !!row;
}

/**
 * Record a token as spent after successful claim via Merkle proof validation.
 * Stores only the SHA-256 hash of the token (not the raw token) for privacy.
 * In multi-tenant mode, also records which provider the token belongs to.
 */
export function markTokenSpentByHash(
  db: Database.Database,
  tokenHash: string,
  batchId: string,
  claimedBy: string,
  ip: string,
  txId: string,
  provider?: string,
): void {
  db.prepare(`
    INSERT INTO spent_tokens (token_hash, batch_id, claimed_by, claimed_ip, tx_id, provider)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tokenHash, batchId, claimedBy, ip, txId, provider ?? null);
}

// -- Dashboard query functions --

/**
 * Create a batch record with provider (issuer) attribution.
 */
export function createBatchWithProvider(
  db: Database.Database,
  id: string,
  expiresAt: string,
  count: number,
  provider: string,
  merkleRoot?: string,
  declarationTx?: string,
  note?: string,
  promiseType: string = 'account-creation',
  promiseParams?: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO batches (id, expires_at, count, merkle_root, declaration_tx, note, promise_type, promise_params, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, expiresAt, count,
    merkleRoot ?? null, declarationTx ?? null, note ?? null,
    promiseType, promiseParams ? JSON.stringify(promiseParams) : null,
    provider,
  );
}

/**
 * List active batches belonging to a specific provider (issuer).
 * Pending (unfinalized) batches are excluded from the listing.
 */
export function listBatchesByProvider(db: Database.Database, provider: string): BatchRow[] {
  return db.prepare(
    "SELECT * FROM batches WHERE provider = ? AND status = 'active' ORDER BY created_at DESC",
  ).all(provider) as BatchRow[];
}

/**
 * Get a batch by ID, scoped to a specific provider for security.
 */
export function getBatchByIdForProvider(
  db: Database.Database,
  batchId: string,
  provider: string,
): BatchRow | null {
  return (db.prepare(
    'SELECT * FROM batches WHERE id = ? AND provider = ?',
  ).get(batchId, provider) as BatchRow | undefined) ?? null;
}

/**
 * Store generated PDF and manifest data for a batch.
 */
export function updateBatchArtifacts(
  db: Database.Database,
  batchId: string,
  pdfData: Buffer,
  manifestData: string,
): void {
  db.prepare(
    'UPDATE batches SET pdf_data = ?, manifest_data = ? WHERE id = ?',
  ).run(pdfData, manifestData, batchId);
}

/**
 * Retrieve the combined PDF for a batch, scoped to provider.
 */
export function getBatchPdf(
  db: Database.Database,
  batchId: string,
  provider: string,
): Buffer | null {
  const row = db.prepare(
    'SELECT pdf_data FROM batches WHERE id = ? AND provider = ?',
  ).get(batchId, provider) as { pdf_data: Buffer | null } | undefined;
  return row?.pdf_data ?? null;
}

/**
 * Retrieve the manifest JSON for a batch, scoped to provider.
 */
export function getBatchManifest(
  db: Database.Database,
  batchId: string,
  provider: string,
): string | null {
  const row = db.prepare(
    'SELECT manifest_data FROM batches WHERE id = ? AND provider = ?',
  ).get(batchId, provider) as { manifest_data: string | null } | undefined;
  return row?.manifest_data ?? null;
}

// -- Batch signing (two-phase flow) --

/**
 * Create a pending batch for the two-phase signing flow.
 * Tokens are generated and stored, but the batch is not yet finalized
 * (no signature, no PDFs, no on-chain declaration).
 */
export function createPendingBatch(
  db: Database.Database,
  id: string,
  expiresAt: string,
  count: number,
  provider: string,
  merkleRoot: string,
  optionsJson: string,
  note?: string,
  promiseType: string = 'account-creation',
  promiseParams?: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO batches (id, expires_at, count, merkle_root, note, promise_type, promise_params, provider, status, options_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id, expiresAt, count, merkleRoot, note ?? null,
    promiseType, promiseParams ? JSON.stringify(promiseParams) : null,
    provider, optionsJson,
  );
}

/**
 * Retrieve a pending batch by ID, scoped to provider.
 */
export function getPendingBatch(
  db: Database.Database,
  batchId: string,
  provider: string,
): BatchRow | null {
  return (db.prepare(
    "SELECT * FROM batches WHERE id = ? AND provider = ? AND status = 'pending'",
  ).get(batchId, provider) as BatchRow | undefined) ?? null;
}

/**
 * Finalize a pending batch: store the signature and transition to active.
 * Returns true if the update was applied (batch existed and was pending).
 */
export function finalizeBatchRecord(
  db: Database.Database,
  batchId: string,
  provider: string,
  signature: string,
): boolean {
  const result = db.prepare(
    "UPDATE batches SET status = 'active', signature = ? WHERE id = ? AND provider = ? AND status = 'pending'",
  ).run(signature, batchId, provider);
  return result.changes > 0;
}

/**
 * Delete pending batches (and their tokens) that were not finalized
 * within the cleanup window. Safe to call periodically.
 *
 * Uses SQLite's datetime() for comparison to avoid format mismatches
 * between SQLite's datetime('now') and JavaScript's Date.toISOString().
 */
export function cleanupPendingBatches(db: Database.Database, maxAgeMinutes: number = 60): number {
  const modifier = `-${maxAgeMinutes} minutes`;
  db.prepare(
    "DELETE FROM tokens WHERE batch_id IN (SELECT id FROM batches WHERE status = 'pending' AND created_at < datetime('now', ?))",
  ).run(modifier);
  const result = db.prepare(
    "DELETE FROM batches WHERE status = 'pending' AND created_at < datetime('now', ?)",
  ).run(modifier);
  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} abandoned pending batch(es)`);
  }
  return result.changes;
}

/**
 * List tokens for a batch (needed by finalize to generate payloads).
 */
export function listTokensForBatch(db: Database.Database, batchId: string): TokenRow[] {
  return db.prepare('SELECT * FROM tokens WHERE batch_id = ? ORDER BY created_at ASC').all(batchId) as TokenRow[];
}
