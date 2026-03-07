/** English locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'en',

  // App
  app_title: 'Propolis Wallet',
  nav_balance: 'Balance',
  nav_transfer: 'Transfer',
  nav_savings: 'Savings',
  nav_settings: 'Settings',

  // Common
  loading: 'Loading...',
  amount: 'Amount',
  confirm: 'Confirm',
  cancel: 'Cancel',
  broadcasting: 'Broadcasting...',
  invalid_url: 'Invalid URL.',
  enter_proxy_url: 'Enter a proxy URL.',
  amount_positive: 'Amount must be > 0.',
  username_placeholder: 'username',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'Direct mode exposes Hive traffic. Continue?',
  confirm_logout: 'Logout and clear keys?',

  // Login
  login_title: 'Login',
  login_info: 'Enter your Hive account name and private active key. Your key never leaves this device.',
  account_name: 'Account name',
  private_active_key: 'Private active key',
  private_memo_key: 'Private memo key (optional)',
  memo_key_placeholder: '5K... (for encrypted messages)',
  remember_keys: 'Remember keys',
  remember_warning: 'Keys stored in localStorage. Only use on a trusted device.',
  login_btn: 'Login',
  account_key_required: 'Account and active key required.',
  validating: 'Validating...',
  wrong_key_role: 'This is a %1 key. Active key required.',
  wrong_memo_role: 'Second key is %1, not memo.',

  // QR scanning
  scan_qr: 'Scan QR Code',
  qr_scanning: 'Point camera at QR code',
  qr_filled_all: 'Scanned! Account and keys filled.',
  qr_filled_active: 'Scanned! Active key filled.',
  qr_filled_memo: 'Scanned! Memo key filled.',
  qr_unknown: 'Unrecognized QR code format',
  qr_no_camera: 'Camera access denied',

  // Proxy setup
  proxy_setup: 'Proxy Setup',
  proxy_required: 'Proxy required',
  proxy_desc_reconnect: 'Obfuscation is enabled but no proxy endpoint is configured. Enter a proxy URL to reconnect.',
  proxy_desc_connect: 'Obfuscation is enabled. Enter a proxy endpoint URL to connect.',
  proxy_url: 'Proxy URL',
  connect: 'Connect',
  switch_direct_link: 'Or switch to Direct mode',

  // Memo paste
  paste_memo_prefix: 'Or paste an encrypted memo from a',
  block_explorer: 'block explorer',
  paste_memo_suffix: ':',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'Decrypt & Connect',
  paste_memo_error: 'Paste the encrypted memo.',
  memo_key_required: 'Memo key required to decrypt.',
  private_memo_key_label: 'Private memo key',

  // Memo decode errors
  memo_not_hash: 'Memo must start with #',
  memo_bad_json: 'Decrypted memo is not valid JSON.',
  memo_bad_payload: 'Memo does not contain endpoint data.',
  memo_expired: 'Endpoint data has expired.',

  // Balance
  account_label: 'Account',
  account_not_found: 'Account not found.',
  refresh: 'Refresh',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'HIVE Savings',
  hbd_savings: 'HBD Savings',
  est_interest: 'Est. interest (~20% APR):',
  hbd_yr: 'HBD/yr',
  pending_withdrawals: '%1 pending withdrawal(s)',
  rpc_label: 'RPC:',
  obfuscated: 'obfuscated',
  direct: 'direct',

  // Transfer
  send_transfer: 'Send Transfer',
  recipient: 'Recipient',
  currency: 'Currency',
  memo_optional: 'Memo (optional)',
  public_memo: 'Public memo',
  send: 'Send',
  recipient_required: 'Recipient required.',
  confirm_send: 'Send %1 to @%2?',
  sent_tx: 'Sent! TX: %1... (%2)',

  // Savings
  deposit_heading: 'Deposit to Savings',
  withdraw_heading: 'Withdraw from Savings',
  three_day_wait: '3-day waiting period for security.',
  deposit_btn: 'Deposit to Savings',
  withdraw_btn: 'Withdraw from Savings',
  pending_heading: 'Pending',
  cancel_latest: 'Cancel Latest',
  available_hbd: 'Available: %1 HBD',
  apr_estimate: '~%1 HBD/yr (~20% APR)',
  n_pending: '%1 pending',
  cancelled: 'Cancelled. (%1)',
  confirm_deposit: 'Deposit %1?',
  confirm_withdraw: 'Withdraw (3-day wait) %1?',
  deposited: 'Deposited',
  withdrawal_initiated: 'Withdrawal initiated',
  not_found: 'Not found.',

  // Settings — Privacy
  privacy: 'Privacy',
  mode_label: 'Mode:',
  mode_obfuscated: 'Obfuscated',
  mode_direct: 'Direct',
  traffic_disguised: 'Traffic disguised as normal web requests.',
  traffic_plain: 'Plain JSON-RPC \u2014 visible to network observers.',
  switch_to_direct: 'Switch to Direct',
  switch_to_obfuscated: 'Switch to Obfuscated',

  // Settings — RPC
  rpc_endpoint: 'RPC Endpoint',
  current_label: 'Current:',
  custom_endpoint: 'Custom endpoint',
  set_btn: 'Set',
  reset_btn: 'Reset',
  check_btn: 'Check',
  enter_url: 'Enter a URL.',
  added: 'Added.',
  reset_done: 'Reset.',

  // Settings — Discovery
  discovery: 'Discovery',
  status_label: 'Status:',
  n_found: '%1 found',
  none_found: 'None found',
  checking: 'Checking...',
  expires_label: 'Expires: %1',
  discover: 'Discover',
  check_all: 'Check All',
  no_memo_key: 'No memo key \u2014 discovery disabled.',
  add_memo_hint: 'Add memo key at login to discover proxy endpoints.',
  found_n: 'Found %1',
  none_found_dot: 'None found.',
  done: 'Done.',

  // Settings — Endpoints
  endpoints: 'Endpoints',
  none: 'None.',

  // Settings — Account
  account_heading: 'Account',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'Persistent',
  session: 'Session',
  logout: 'Logout',

  // Settings — About
  about: 'About',
  about_text: 'Propolis Wallet v1.0.0 \u2014 Keys never leave this device.',
} as const;
