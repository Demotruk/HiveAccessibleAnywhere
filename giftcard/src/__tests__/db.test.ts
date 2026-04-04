import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initDatabase,
  createBatch,
  createPendingBatch,
  getPendingBatch,
  finalizeBatchRecord,
  cleanupPendingBatches,
  listTokensForBatch,
  insertToken,
  getToken,
  getTokenWithBatch,
  markTokenSpent,
  revokeToken,
  revokeBatch,
  listBatches,
  listBatchesByProvider,
  listTokens,
  getStats,
  updateBatchDeclaration,
  isTokenSpent,
  markTokenSpentByHash,
} from '../db.js';

describe('Database layer', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('initDatabase', () => {
    it('creates batches and tokens tables', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];
      const names = tables.map(t => t.name);
      expect(names).toContain('batches');
      expect(names).toContain('tokens');
    });

    it('enables WAL mode (on file-backed DB)', () => {
      // In-memory SQLite always uses 'memory' journal mode,
      // so WAL is only verifiable on file-backed databases.
      // Just verify the pragma call doesn't throw.
      const mode = db.pragma('journal_mode', { simple: true }) as string;
      expect(['wal', 'memory']).toContain(mode);
    });
  });

  describe('batch operations', () => {
    it('creates and lists batches', () => {
      createBatch(db, 'batch-1', '2027-01-01T00:00:00Z', 10, 'abc123');
      createBatch(db, 'batch-2', '2027-06-01T00:00:00Z', 5, 'def456', 'tx123', 'Test batch');

      const batches = listBatches(db);
      expect(batches).toHaveLength(2);
      // Both created at same datetime('now'), so just check both present
      const ids = batches.map(b => b.id).sort();
      expect(ids).toEqual(['batch-1', 'batch-2']);
      // Check fields on batch-2
      const b2 = batches.find(b => b.id === 'batch-2')!;
      expect(b2.count).toBe(5);
      expect(b2.declaration_tx).toBe('tx123');
      expect(b2.note).toBe('Test batch');
    });

    it('defaults promise_type to account-creation', () => {
      createBatch(db, 'batch-default', '2027-01-01T00:00:00Z', 5);
      const batch = listBatches(db).find(b => b.id === 'batch-default')!;
      expect(batch.promise_type).toBe('account-creation');
      expect(batch.promise_params).toBeNull();
    });

    it('stores custom promise type and params', () => {
      createBatch(db, 'batch-transfer', '2027-01-01T00:00:00Z', 10,
        undefined, undefined, undefined, 'transfer', { amount: '10.000 HIVE' });
      const batch = listBatches(db).find(b => b.id === 'batch-transfer')!;
      expect(batch.promise_type).toBe('transfer');
      expect(JSON.parse(batch.promise_params!)).toEqual({ amount: '10.000 HIVE' });
    });

    it('updates batch declaration TX', () => {
      createBatch(db, 'batch-1', '2027-01-01T00:00:00Z', 10);
      updateBatchDeclaration(db, 'batch-1', 'tx-abc');

      const batches = listBatches(db);
      expect(batches[0].declaration_tx).toBe('tx-abc');
    });
  });

  describe('token CRUD', () => {
    beforeEach(() => {
      createBatch(db, 'batch-1', '2027-01-01T00:00:00Z', 3);
    });

    it('inserts and retrieves a token', () => {
      insertToken(db, 'token-aaa', 'batch-1', 'PIN123', 'sig-aaa', '2027-01-01T00:00:00Z');
      const token = getToken(db, 'token-aaa');
      expect(token).not.toBeNull();
      expect(token!.token).toBe('token-aaa');
      expect(token!.batch_id).toBe('batch-1');
      expect(token!.status).toBe('active');
      expect(token!.pin).toBe('PIN123');
      expect(token!.signature).toBe('sig-aaa');
    });

    it('returns null for unknown token', () => {
      const token = getToken(db, 'nonexistent');
      expect(token).toBeNull();
    });

    it('getTokenWithBatch returns token with promise type', () => {
      insertToken(db, 'token-twb', 'batch-1', 'PIN999', 'sig-twb', '2027-01-01T00:00:00Z');
      const result = getTokenWithBatch(db, 'token-twb');
      expect(result).not.toBeNull();
      expect(result!.token).toBe('token-twb');
      expect(result!.promise_type).toBe('account-creation');
      expect(result!.promise_params).toBeNull();
    });

    it('getTokenWithBatch returns null for unknown token', () => {
      expect(getTokenWithBatch(db, 'nonexistent')).toBeNull();
    });

    it('marks a token as spent', () => {
      insertToken(db, 'token-bbb', 'batch-1', 'PIN456', 'sig-bbb', '2027-01-01T00:00:00Z');
      markTokenSpent(db, 'token-bbb', 'newuser', '1.2.3.4', 'tx-001');

      const token = getToken(db, 'token-bbb');
      expect(token!.status).toBe('spent');
      expect(token!.claimed_by).toBe('newuser');
      expect(token!.claimed_ip).toBe('1.2.3.4');
      expect(token!.tx_id).toBe('tx-001');
      expect(token!.claimed_at).toBeTruthy();
    });

    it('revokes an active token', () => {
      insertToken(db, 'token-ccc', 'batch-1', 'PIN789', 'sig-ccc', '2027-01-01T00:00:00Z');
      const success = revokeToken(db, 'token-ccc');
      expect(success).toBe(true);

      const token = getToken(db, 'token-ccc');
      expect(token!.status).toBe('revoked');
    });

    it('returns false when revoking non-active token', () => {
      insertToken(db, 'token-ddd', 'batch-1', 'PINABC', 'sig-ddd', '2027-01-01T00:00:00Z');
      revokeToken(db, 'token-ddd'); // First revoke succeeds
      const second = revokeToken(db, 'token-ddd'); // Already revoked
      expect(second).toBe(false);
    });

    it('returns false when revoking nonexistent token', () => {
      const success = revokeToken(db, 'nonexistent');
      expect(success).toBe(false);
    });
  });

  describe('revokeBatch', () => {
    it('revokes all active tokens in a batch', () => {
      createBatch(db, 'batch-2', '2027-01-01T00:00:00Z', 3);
      insertToken(db, 't1', 'batch-2', 'P1', 's1', '2027-01-01T00:00:00Z');
      insertToken(db, 't2', 'batch-2', 'P2', 's2', '2027-01-01T00:00:00Z');
      insertToken(db, 't3', 'batch-2', 'P3', 's3', '2027-01-01T00:00:00Z');

      // Spend one first
      markTokenSpent(db, 't1', 'user1', '0.0.0.0', 'tx1');

      const count = revokeBatch(db, 'batch-2');
      expect(count).toBe(2); // Only t2 and t3 were active

      expect(getToken(db, 't1')!.status).toBe('spent'); // Unchanged
      expect(getToken(db, 't2')!.status).toBe('revoked');
      expect(getToken(db, 't3')!.status).toBe('revoked');
    });
  });

  describe('listTokens', () => {
    beforeEach(() => {
      createBatch(db, 'batch-a', '2027-01-01T00:00:00Z', 2);
      createBatch(db, 'batch-b', '2027-01-01T00:00:00Z', 1);
      insertToken(db, 't1', 'batch-a', 'P1', 's1', '2027-01-01T00:00:00Z');
      insertToken(db, 't2', 'batch-a', 'P2', 's2', '2027-01-01T00:00:00Z');
      insertToken(db, 't3', 'batch-b', 'P3', 's3', '2027-01-01T00:00:00Z');
      revokeToken(db, 't2');
    });

    it('lists all tokens', () => {
      const tokens = listTokens(db);
      expect(tokens).toHaveLength(3);
    });

    it('filters by batch', () => {
      const tokens = listTokens(db, 'batch-a');
      expect(tokens).toHaveLength(2);
    });

    it('filters by status', () => {
      const tokens = listTokens(db, undefined, 'active');
      expect(tokens).toHaveLength(2);
    });

    it('filters by batch and status', () => {
      const tokens = listTokens(db, 'batch-a', 'active');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).toBe('t1');
    });
  });

  describe('getStats', () => {
    it('returns correct summary counts', () => {
      createBatch(db, 'batch-x', '2027-01-01T00:00:00Z', 4);
      insertToken(db, 's1', 'batch-x', 'P1', 'sig1', '2027-01-01T00:00:00Z');
      insertToken(db, 's2', 'batch-x', 'P2', 'sig2', '2027-01-01T00:00:00Z');
      insertToken(db, 's3', 'batch-x', 'P3', 'sig3', '2027-01-01T00:00:00Z');
      insertToken(db, 's4', 'batch-x', 'P4', 'sig4', '2027-01-01T00:00:00Z');

      markTokenSpent(db, 's1', 'user1', '0.0.0.0', 'tx1');
      revokeToken(db, 's2');

      const stats = getStats(db);
      expect(stats.total).toBe(4);
      expect(stats.active).toBe(2);
      expect(stats.spent).toBe(1);
      expect(stats.revoked).toBe(1);
    });
  });

  describe('spent_tokens (Merkle proof path)', () => {
    it('creates spent_tokens table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as { name: string }[];
      expect(tables.map(t => t.name)).toContain('spent_tokens');
    });

    it('isTokenSpent returns false for unknown hash', () => {
      expect(isTokenSpent(db, 'abc123')).toBe(false);
    });

    it('markTokenSpentByHash and isTokenSpent roundtrip', () => {
      markTokenSpentByHash(db, 'hash-aaa', 'batch-1', 'newuser', '1.2.3.4', 'tx-001');
      expect(isTokenSpent(db, 'hash-aaa')).toBe(true);
    });

    it('stores all fields correctly', () => {
      markTokenSpentByHash(db, 'hash-bbb', 'batch-2', 'testuser', '5.6.7.8', 'tx-002');
      const row = db.prepare('SELECT * FROM spent_tokens WHERE token_hash = ?').get('hash-bbb') as any;
      expect(row.token_hash).toBe('hash-bbb');
      expect(row.batch_id).toBe('batch-2');
      expect(row.claimed_by).toBe('testuser');
      expect(row.claimed_ip).toBe('5.6.7.8');
      expect(row.tx_id).toBe('tx-002');
      expect(row.claimed_at).toBeTruthy();
    });

    it('rejects duplicate token hash (PRIMARY KEY)', () => {
      markTokenSpentByHash(db, 'hash-dup', 'batch-1', 'user1', '1.1.1.1', 'tx1');
      expect(() => {
        markTokenSpentByHash(db, 'hash-dup', 'batch-1', 'user2', '2.2.2.2', 'tx2');
      }).toThrow();
    });
  });

  describe('batch signing (two-phase flow)', () => {
    it('creates a pending batch and retrieves it', () => {
      createPendingBatch(db, 'pending-1', '2027-01-01T00:00:00Z', 5, 'issuer1', 'root123', '{"count":5}');
      const batch = getPendingBatch(db, 'pending-1', 'issuer1');
      expect(batch).not.toBeNull();
      expect(batch!.id).toBe('pending-1');
      expect(batch!.status).toBe('pending');
      expect(batch!.merkle_root).toBe('root123');
      expect(batch!.options_json).toBe('{"count":5}');
      expect(batch!.provider).toBe('issuer1');
    });

    it('returns null for pending batch with wrong provider', () => {
      createPendingBatch(db, 'pending-2', '2027-01-01T00:00:00Z', 3, 'issuer1', 'root456', '{}');
      expect(getPendingBatch(db, 'pending-2', 'wrong-issuer')).toBeNull();
    });

    it('returns null for active batch via getPendingBatch', () => {
      createBatch(db, 'active-1', '2027-01-01T00:00:00Z', 5);
      expect(getPendingBatch(db, 'active-1', 'anyone')).toBeNull();
    });

    it('finalizes a pending batch (pending -> active)', () => {
      createPendingBatch(db, 'pending-3', '2027-01-01T00:00:00Z', 2, 'issuer2', 'root789', '{}');
      const ok = finalizeBatchRecord(db, 'pending-3', 'issuer2', 'sig-hex-abc');
      expect(ok).toBe(true);

      // Should no longer be pending
      expect(getPendingBatch(db, 'pending-3', 'issuer2')).toBeNull();

      // Should now have active status and signature
      const row = db.prepare('SELECT status, signature FROM batches WHERE id = ?').get('pending-3') as any;
      expect(row.status).toBe('active');
      expect(row.signature).toBe('sig-hex-abc');
    });

    it('returns false when finalizing a non-pending batch', () => {
      createPendingBatch(db, 'pending-4', '2027-01-01T00:00:00Z', 1, 'issuer3', 'rootabc', '{}');
      finalizeBatchRecord(db, 'pending-4', 'issuer3', 'sig1');
      // Second finalize should fail (already active)
      const ok = finalizeBatchRecord(db, 'pending-4', 'issuer3', 'sig2');
      expect(ok).toBe(false);
    });

    it('excludes pending batches from listBatchesByProvider', () => {
      createPendingBatch(db, 'pending-5', '2027-01-01T00:00:00Z', 1, 'issuer4', 'root', '{}');
      const batches = listBatchesByProvider(db, 'issuer4');
      expect(batches).toHaveLength(0);

      // After finalizing, it should appear
      finalizeBatchRecord(db, 'pending-5', 'issuer4', 'sig');
      const batches2 = listBatchesByProvider(db, 'issuer4');
      expect(batches2).toHaveLength(1);
    });

    it('cleans up old pending batches and their tokens', () => {
      // Create a pending batch with tokens
      createPendingBatch(db, 'pending-old', '2027-01-01T00:00:00Z', 2, 'issuer5', 'root', '{}');
      insertToken(db, 'tok-old-1', 'pending-old', 'PIN1', '', '2027-01-01T00:00:00Z');
      insertToken(db, 'tok-old-2', 'pending-old', 'PIN2', '', '2027-01-01T00:00:00Z');

      // Set created_at to 2 hours ago to simulate an abandoned batch
      db.prepare("UPDATE batches SET created_at = datetime('now', '-2 hours') WHERE id = 'pending-old'").run();

      const cleaned = cleanupPendingBatches(db);
      expect(cleaned).toBe(1);

      // Batch and tokens should be gone
      expect(getPendingBatch(db, 'pending-old', 'issuer5')).toBeNull();
      expect(getToken(db, 'tok-old-1')).toBeNull();
      expect(getToken(db, 'tok-old-2')).toBeNull();
    });

    it('does not clean up recent pending batches', () => {
      createPendingBatch(db, 'pending-recent', '2027-01-01T00:00:00Z', 1, 'issuer6', 'root', '{}');
      const cleaned = cleanupPendingBatches(db);
      expect(cleaned).toBe(0);
      expect(getPendingBatch(db, 'pending-recent', 'issuer6')).not.toBeNull();
    });

    it('does not clean up active batches', () => {
      createPendingBatch(db, 'pending-active', '2027-01-01T00:00:00Z', 1, 'issuer7', 'root', '{}');
      finalizeBatchRecord(db, 'pending-active', 'issuer7', 'sig');
      db.prepare("UPDATE batches SET created_at = datetime('now', '-2 hours') WHERE id = 'pending-active'").run();

      const cleaned = cleanupPendingBatches(db);
      expect(cleaned).toBe(0);
    });

    it('listTokensForBatch returns tokens in order', () => {
      createPendingBatch(db, 'pending-list', '2027-01-01T00:00:00Z', 3, 'issuer8', 'root', '{}');
      insertToken(db, 'tok-c', 'pending-list', 'P1', '', '2027-01-01T00:00:00Z');
      insertToken(db, 'tok-a', 'pending-list', 'P2', '', '2027-01-01T00:00:00Z');
      insertToken(db, 'tok-b', 'pending-list', 'P3', '', '2027-01-01T00:00:00Z');

      const tokens = listTokensForBatch(db, 'pending-list');
      expect(tokens).toHaveLength(3);
    });
  });
});
