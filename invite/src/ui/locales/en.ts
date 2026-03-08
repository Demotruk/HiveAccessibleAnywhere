export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'en',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Redeem Your Invitation to Hive',

  // Landing
  landing_title: 'Welcome to Hive',
  landing_desc: 'Redeem your gift card to create a Hive blockchain account.',
  landing_no_card: 'You need a gift card with a QR code and PIN to continue. Scan the QR code on your card to get started.',

  // PIN
  pin_title: 'Enter Your PIN',
  pin_desc: 'Enter the 6-character PIN printed on your gift card.',
  pin_placeholder: 'PIN',
  pin_submit: 'Unlock',
  pin_error: 'Incorrect PIN. Please check and try again.',
  pin_invalid: 'PIN must be 6 characters.',

  // Verifying
  verifying_title: 'Verifying Gift Card',
  verifying_checking: 'Checking authenticity...',
  verifying_failed: 'Verification failed. Please try again later.',
  verifying_expired: 'This gift card has expired.',
  verifying_counterfeit: 'This gift card could not be verified. The signature is invalid.',
  verifying_network: 'Could not reach the network. Check your connection and try again.',

  // Username
  username_title: 'Choose Your Username',
  username_desc: 'Pick a username for your new Hive account. This cannot be changed later.',
  username_placeholder: 'username',
  username_checking: 'Checking...',
  username_available: 'Available!',
  username_taken: 'Already taken.',
  username_continue: 'Continue',

  // Key Backup
  backup_title: 'Save Your Key Backup',
  backup_desc: 'Your account keys have been generated and encrypted with your gift card PIN. Print or screenshot the QR code below to save your backup.',
  backup_pin_warning: 'Keep your gift card or PIN somewhere safe — you will need it together with this QR code to recover your keys.',
  backup_qr_label: 'Encrypted Key Backup',
  backup_qr_info: 'Print or screenshot this QR code now. You can restore your keys by scanning it and entering your gift card PIN.',
  backup_print: 'Print Backup',
  backup_print_title: 'Hive Account Key Backup',
  backup_print_account: 'Account: @%1',
  backup_print_instructions: 'Scan this QR code and enter your gift card PIN to recover your account keys. Store this printout and your gift card in a safe place.',
  backup_master_label: 'Master Password',
  backup_master_info: 'This single password derives all your account keys. You can also save it manually as an extra precaution.',
  backup_copy: 'Copy',
  backup_copied: 'Copied!',
  backup_keys_label: 'Account Keys',
  backup_active_wif: 'Active Key',
  backup_posting_wif: 'Posting Key',
  backup_memo_wif: 'Memo Key',
  backup_owner_wif: 'Owner Key',
  backup_show_keys: 'Show individual keys',
  backup_hide_keys: 'Hide individual keys',
  backup_show_manual: 'Show master password and keys',
  backup_hide_manual: 'Hide master password and keys',
  backup_proceed: 'Create My Account',

  // Claiming
  claiming_title: 'Creating Your Account',
  claiming_progress: 'Setting up @%1 on the Hive blockchain...',
  claiming_failed: 'Account creation failed. Please try again.',
  claiming_retry: 'Retry',

  // Success
  success_title: 'Welcome to Hive!',
  success_welcome: 'Your account @%1 has been created.',
  success_tx: 'Transaction: %1',
  success_next: 'You can now use the Propolis Wallet to manage your account, send transfers, and earn interest on HBD savings.',
  success_wallet_link: 'Open Propolis Wallet',
  success_keys_reminder: 'Log in with your username and active key (or master password). Keep your gift card PIN safe — it protects your key backup.',

  // Errors
  err_network: 'Network error. Check your connection.',
  err_service_down: 'The service is unavailable. Your gift card is still valid — try again later.',
} as const;
