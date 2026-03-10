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
  backup_title: 'Important — Take a Screenshot Now',
  backup_desc: 'This QR code is the backup for your account keys. Without it, you could lose access to your account permanently.',
  backup_pin_warning: 'Keep your gift card or PIN somewhere safe — you will need it together with this QR code to recover your keys.',
  backup_qr_label: 'Encrypted Key Backup',
  backup_qr_info: 'Screenshot or print this QR code before continuing. You can restore your keys by scanning it and entering your gift card PIN.',
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
  claiming_connecting: 'Connecting to account service...',
  claiming_progress: 'Setting up @%1 on the Hive blockchain...',
  claiming_failed: 'Account creation failed. Please try again.',
  claiming_retry: 'Retry',

  // Success
  success_title: 'Welcome to Hive!',
  success_welcome: 'Your account @%1 has been created.',
  success_tx: 'Transaction: %1',
  success_peakd_heading: 'Log into Peakd',
  success_peakd_intro: 'Peakd is the most popular Hive front end. Let\'s get you logged in — it only takes a moment.',
  success_step_copy: 'Copy your username and posting key below, then click the button to open HiveSigner:',
  success_username_label: 'Username',
  success_posting_label: 'Posting Key',
  success_copy: 'Copy',
  success_copied: 'Copied!',
  success_step_login: 'On HiveSigner, paste your username and posting key, then click Login. You\'ll be redirected to Peakd, logged in.',
  success_hivesigner_btn: 'Log into Peakd via HiveSigner',
  success_hivesigner_note: 'HiveSigner is an open-source login service. Your posting key lets you interact on Hive (vote, comment, post) but cannot move funds.',
  success_keys_reminder: 'Keep your gift card PIN safe — it protects your key backup. You can restore your keys anytime by scanning the backup QR code.',

  // Errors
  err_network: 'Network error. Check your connection.',
  err_service_down: 'The service is unavailable. Your gift card is still valid — try again later.',
} as const;
