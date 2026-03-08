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
