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
 * Decrypted backup data from the invite app QR.
 */
export interface BackupData {
  username: string;
  masterPassword: string;
}

/**
 * Application state threaded through all screens.
 */
export interface RestoreState {
  encryptedData: string | null;
  backupData: BackupData | null;
  keys: DerivedKeys | null;
}

export type ScreenName = 'scan' | 'pin' | 'result';

export type ScreenFn = (
  container: HTMLElement,
  state: RestoreState,
  advance: (next: ScreenName) => void,
) => void | Promise<void>;
