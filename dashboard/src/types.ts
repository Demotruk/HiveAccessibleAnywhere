/** Batch summary from GET /api/batches */
export interface Batch {
  batchId: string;
  createdAt: string;
  expiresAt: string;
  count: number;
  promiseType: string;
  declarationTx: string | null;
  merkleRoot: string | null;
  note: string | null;
  status: { active: number; spent: number; revoked: number };
}

/** Card status from GET /api/batches/:id */
export interface Card {
  tokenPrefix: string;
  status: 'active' | 'spent' | 'revoked';
  claimedBy: string | null;
  claimedAt: string | null;
}

/** Full batch detail from GET /api/batches/:id */
export interface BatchDetail extends Omit<Batch, 'status'> {
  cards: Card[];
}

/** POST /api/batches request body */
export interface BatchCreateRequest {
  count: number;
  locale?: string;
  expiryDays?: number;
  design?: string;
  variant?: 'standard' | 'robust';
  note?: string;
}

/** POST /api/batches response */
export interface BatchCreateResponse {
  batchId: string;
  count: number;
  expiresAt: string;
  merkleRoot: string;
  declarationTx: string;
  downloads: { pdf: string; manifest: string };
}

/** Hive Keychain callback response */
export interface KeychainResponse {
  success: boolean;
  result: string;
  error?: string;
  message?: string;
}

/** Hive Keychain API */
export interface HiveKeychain {
  requestSignBuffer(
    username: string,
    message: string,
    role: string,
    callback: (response: KeychainResponse) => void,
  ): void;
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain;
  }
}
