/**
 * Encrypted blob payload contents — matches the server-side GiftCardPayload
 * from giftcard/src/crypto/signing.ts.
 */
export interface GiftCardPayload {
  token: string;
  provider: string;
  serviceUrl: string;
  endpoints: string[];
  batchId: string;
  expires: string;
  signature: string;
  promiseType: string;
  promiseParams?: Record<string, unknown>;
  /** Compact-encoded Merkle inclusion proof */
  merkleProof?: string;
  /** Merkle root of the batch (present for batch-signed cards, absent for legacy per-card) */
  merkleRoot?: string;
  /** Card variant: 'standard' (PeakLock login on peakd.com) or 'robust' (proxy + bootstrap) */
  variant: 'standard' | 'robust';
  /** Wallet locale for robust invites (determines which on-chain wallet to fetch) */
  locale?: string;
  /** Hive usernames the new account will auto-follow on creation (max 20) */
  autoFollow?: string[];
  /** Hive communities to subscribe the new account to on creation (max 10) */
  communities?: string[];
  /** Hive username to record as account referrer (Hive Account Referral open standard) */
  referrer?: string;
  /** Account whose memo key signed this card (multi-tenant: service account) */
  signer?: string;
}

/**
 * Derived key set for a Hive account.
 */
export interface DerivedKeys {
  owner: { wif: string; pub: string };
  active: { wif: string; pub: string };
  posting: { wif: string; pub: string };
  memo: { wif: string; pub: string };
}

/**
 * Application state threaded through all screens.
 */
export interface InviteState {
  encryptedBlob: string | null;
  pin: string | null;
  payload: GiftCardPayload | null;
  masterPassword: string | null;
  username: string | null;
  keys: DerivedKeys | null;
  claimResult: { account: string; tx_id: string } | null;
  /** Whether the user has confirmed saving the bootstrap file (robust only) */
  bootstrapSaved: boolean;
  /** Background warm-up interval ID (cleared when claiming screen starts) */
  _warmupInterval?: ReturnType<typeof setInterval>;
}

export type ScreenName =
  | 'landing'
  | 'pin'
  | 'verifying'
  | 'username'
  | 'backup'
  | 'claiming'
  | 'success';

export type ScreenFn = (
  container: HTMLElement,
  state: InviteState,
  advance: (next: ScreenName) => void,
) => void | Promise<void>;
