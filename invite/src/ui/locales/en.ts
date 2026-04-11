export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'en',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Redeem Your Invitation to Hive',

  // Landing
  landing_title: 'Welcome to <span class="hive-brand">Hive</span>',
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
  username_suggestions: 'Try one of these:',
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
  claiming_timeout: 'The request timed out. Your gift card is still valid — tap Retry.',
  claiming_retry: 'Retry',

  // Success
  success_title: 'Welcome to <span class="hive-brand">Hive</span>!',
  success_welcome: 'Your account @%1 has been created.',
  success_tx: 'Transaction: %1',
  success_peakd_heading: 'Log into Peakd',
  success_peakd_intro: 'Peakd is the most popular Hive front end. Let\'s get you logged in — it only takes a moment.',
  success_step_login: 'Your posting key will be copied to your clipboard. On Peakd, paste it and choose a 5-digit PIN. That\'s it — you\'re in!',
  success_peakd_btn: 'Copy Key & Log into Peakd',
  success_peakd_note: 'PeakLock stores your key securely in your browser. Your posting key lets you interact on Hive (vote, comment, post) but cannot move funds.',
  success_keys_reminder: 'Keep your gift card PIN safe — it protects your key backup. You can restore your keys anytime by scanning the backup QR code.',

  // Robust Success — Phase 1 (Confirmation)
  robust_title: 'Welcome to <span class="hive-brand">Hive</span>!',
  robust_created: 'Your account @%1 has been created.',
  robust_tx: 'Transaction: %1',

  // Robust Success — Phase 2 (Bootstrap Save)
  robust_save_heading: 'Save Your Wallet File',
  robust_save_desc: 'This file lets you access your wallet anytime. It is encrypted with your gift card PIN — keep your card safe.',
  robust_save_download: 'Download Wallet File',
  robust_save_generating: 'Generating wallet file...',
  robust_save_checkbox: 'I have saved my wallet file',
  robust_save_continue: 'Continue',
  robust_save_filename: 'propolis-wallet-%1.html',

  // Robust Success — Phase 3 (Wallet Loading)
  robust_loading_title: 'Loading Wallet',
  robust_loading_chunk: 'Fetching wallet: chunk %1 of %2',
  robust_loading_verifying: 'Verifying integrity...',
  robust_loading_ready: 'Ready!',
  robust_loading_estimate: 'Usually takes 10\u201320 seconds',
  robust_enrollment_confirmed: 'Endpoint enrollment confirmed.',
  robust_enrollment_timeout: 'Endpoint enrollment is still processing. Your wallet will work normally \u2014 fresh endpoints will arrive within a few hours.',

  // Robust Errors
  robust_err_fetch: 'Could not fetch wallet from blockchain. Check your connection and try again.',
  robust_err_hash: 'Wallet integrity check failed. Please try again.',
  robust_err_retry: 'Retry',

  // Profile Setup
  profile_title: 'Set Up Your Profile',
  profile_desc: 'Add a photo and some details about yourself.',
  profile_photo_btn: 'Add Photo',
  profile_photo_change: 'Change Photo',
  profile_display_name: 'Display Name',
  profile_display_name_placeholder: 'Your name',
  profile_about: 'About',
  profile_about_placeholder: 'A short bio (optional)',
  profile_location: 'Location',
  profile_location_placeholder: 'Where are you? (optional)',
  profile_website: 'Website',
  profile_website_placeholder: 'https:// (optional)',
  profile_continue: 'Continue',
  profile_uploading: 'Uploading photo...',
  profile_saving: 'Saving profile...',
  profile_upload_failed: 'Photo upload failed. Please try again.',
  profile_save_failed: 'Could not save profile. Please try again.',
  profile_name_required: 'Display name is required.',
  profile_photo_required: 'A photo is required.',

  // Introduction Post
  intro_title: 'Introduce Yourself',
  intro_desc: 'Write a short introduction to the Hive community.',
  intro_post_title: 'Post Title',
  intro_default_title: 'Hello Hive!',
  intro_about_me: 'About Me',
  intro_about_me_placeholder: 'Tell the community a little about yourself...',
  intro_interests: 'What interests you?',
  intro_interests_placeholder: 'What do you want to explore on Hive? (optional)',
  intro_thank_you: 'Thank You',
  intro_default_thanks: 'Thank you to @%1 for inviting me to Hive!',
  intro_publish: 'Publish',
  intro_publishing: 'Publishing your post...',
  intro_publish_failed: 'Could not publish your post. Please try again.',
  intro_about_required: 'Please write something about yourself.',

  // Errors
  err_network: 'Network error. Check your connection.',
  err_service_down: 'The service is unavailable. Your gift card is still valid — try again later.',
} as const;
