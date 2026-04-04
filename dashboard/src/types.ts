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
  /** Hive usernames the new account will auto-follow on creation (max 20) */
  autoFollow?: string[];
  /** Hive communities to subscribe the new account to on creation (max 10) */
  communities?: string[];
  /** Hive username to record as account referrer */
  referrer?: string;
}

/** POST /api/batches/prepare response */
export interface PrepareResponse {
  batchId: string;
  count: number;
  expiresAt: string;
  merkleRoot: string;
  canonicalString: string;
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

/** Issuer record from GET /api/issuers/me */
export interface IssuerRecord {
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

/** Issuer with batch stats from GET /api/admin/issuers */
export interface IssuerWithStats extends IssuerRecord {
  batch_count: number;
  total_cards: number;
  claimed_cards: number;
}

/** Setup status from GET /api/issuers/me */
export interface SetupStatus {
  delegated: boolean;
  pendingTokens: number;
  serviceAccount?: string;
  operatorAccount?: string;
}

/** User role determined by the server */
export type UserRole = 'admin' | 'issuer' | 'applicant';

/** Hive Keychain API */
export interface HiveKeychain {
  requestSignBuffer(
    username: string,
    message: string,
    role: string,
    callback: (response: KeychainResponse) => void,
  ): void;

  requestCustomJson(
    username: string,
    id: string,
    keyType: string,
    json: string,
    display_msg: string,
    callback: (response: KeychainResponse) => void,
  ): void;

  requestBroadcast(
    username: string,
    operations: unknown[][],
    keyType: string,
    callback: (response: KeychainResponse) => void,
  ): void;

  requestAddAccountAuthority(
    username: string,
    authorizedUsername: string,
    role: 'Posting' | 'Active',
    weight: number,
    callback: (response: KeychainResponse) => void,
  ): void;
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain;
  }
}
