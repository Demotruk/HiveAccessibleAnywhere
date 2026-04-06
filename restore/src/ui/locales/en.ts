export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'en',
  html_dir: 'ltr' as const,

  // Scan screen
  scan_title: 'Restore Backup',
  scan_desc: 'Upload your backup QR screenshot or scan it with your camera.',
  scan_tap: 'Tap to select image or drag & drop',
  scan_formats: 'Supports PNG, JPG, or any image with a QR code',
  scan_or: 'or',
  scan_camera_btn: '\u{1F4F7} Scan with Camera',
  scan_camera_stop: 'Stop Camera',
  scan_no_qr: 'No QR code found in this image. Try a clearer screenshot.',
  scan_read_error: 'Could not read the image. Try a different file.',

  // PIN entry screen
  pin_title: 'Enter PIN',
  pin_desc: 'Enter the 6-character PIN from your gift card to decrypt the backup.',
  pin_placeholder: '------',
  pin_crypto_error: 'Web Crypto not available \u2014 HTTPS required.',
  pin_wrong: 'Wrong PIN or invalid backup data. Check your PIN and try again.',

  // Result screen
  result_title: '\u2705 Backup Restored',
  result_desc: 'Your keys have been decrypted successfully.',
  result_account: 'Account',
  result_copy: 'Copy',
  result_copied: 'Copied!',
  result_master_label: 'Master Password',
  result_master_copy: 'Copy Master Password',
  result_master_show: 'Press to show master password',
  result_master_info: 'This password derives all four keys below. Store it securely.',
  result_keys_label: 'Private Keys (WIF)',
  result_key_copy: 'Copy %1 key',
  result_key_show: 'Press to show',
  result_keychain_label: 'Import to Hive Keychain',
  result_keychain_show: 'Press to show Keychain import QR',
  result_keychain_info: 'Scan with the Hive Keychain mobile app to import this account.',
  result_keychain_error: 'Could not generate QR code.',
  result_warning: '\u26A0\uFE0F Keep these keys private. Anyone with your keys controls your account.',
  result_start_over: 'Restore Another Backup',

  // Key roles
  key_owner: 'owner',
  key_active: 'active',
  key_posting: 'posting',
  key_memo: 'memo',
} as const;
