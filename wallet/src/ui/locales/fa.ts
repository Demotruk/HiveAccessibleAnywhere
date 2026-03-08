/** Persian (Farsi) locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'fa',
  html_dir: 'rtl' as const,

  // App
  app_title: 'کیف پول Propolis',
  nav_balance: 'موجودی',
  nav_transfer: 'انتقال',
  nav_savings: 'پس‌انداز',
  nav_settings: 'تنظیمات',

  // Common
  loading: 'در حال بارگذاری…',
  amount: 'مبلغ',
  confirm: 'تأیید',
  cancel: 'لغو',
  broadcasting: 'در حال ارسال…',
  invalid_url: 'URL نامعتبر.',
  https_required: 'URL پراکسی باید از HTTPS استفاده کند.',
  enter_proxy_url: 'URL پراکسی را وارد کنید.',
  amount_positive: 'مبلغ باید بیشتر از صفر باشد.',
  username_placeholder: 'نام کاربری',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'حالت مستقیم ترافیک Hive را آشکار می‌کند. ادامه می‌دهید؟',
  confirm_logout: 'خروج و پاک کردن کلیدها؟',

  // Login
  login_title: 'ورود',
  login_info: 'نام حساب Hive و کلید خصوصی Active خود را وارد کنید. کلید شما هرگز از این دستگاه خارج نمی‌شود.',
  account_name: 'نام حساب',
  private_active_key: 'کلید خصوصی Active',
  private_memo_key: 'کلید خصوصی Memo (اختیاری)',
  memo_key_placeholder: '5K... (برای پیام‌های رمزنگاری‌شده)',
  remember_keys: 'ذخیره کلیدها',
  remember_warning: 'کلیدها در localStorage ذخیره می‌شوند. فقط در دستگاه مورد اعتماد استفاده کنید.',
  login_btn: 'ورود',
  account_key_required: 'نام حساب و کلید Active لازم است.',
  validating: 'در حال بررسی…',
  wrong_key_role: 'این یک کلید %1 است. کلید Active لازم است.',
  wrong_memo_role: 'کلید دوم %1 است، نه Memo.',

  // QR scanning
  scan_qr: 'اسکن کد QR',
  qr_scanning: 'دوربین را به سمت کد QR بگیرید',
  qr_filled_all: 'اسکن شد! حساب و کلیدها پر شد.',
  qr_filled_active: 'اسکن شد! کلید Active پر شد.',
  qr_filled_memo: 'اسکن شد! کلید Memo پر شد.',
  qr_unknown: 'فرمت کد QR ناشناخته',
  qr_no_camera: 'دسترسی به دوربین رد شد',

  // Proxy setup
  proxy_setup: 'تنظیم پراکسی',
  proxy_required: 'پراکسی لازم است',
  proxy_desc_reconnect: 'حالت مبهم‌سازی فعال است اما پراکسی تنظیم نشده. URL پراکسی را برای اتصال مجدد وارد کنید.',
  proxy_desc_connect: 'حالت مبهم‌سازی فعال است. URL پراکسی را برای اتصال وارد کنید.',
  proxy_url: 'URL پراکسی',
  connect: 'اتصال',
  switch_direct_link: 'یا تغییر به حالت مستقیم',

  // Memo paste
  paste_memo_prefix: 'یا یادداشت رمزنگاری‌شده را از',
  block_explorer: 'کاوشگر بلاک',
  paste_memo_suffix: ' بچسبانید:',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'رمزگشایی و اتصال',
  paste_memo_error: 'یادداشت رمزنگاری‌شده را بچسبانید.',
  memo_key_required: 'کلید Memo برای رمزگشایی لازم است.',
  private_memo_key_label: 'کلید خصوصی Memo',

  // Memo decode errors
  memo_not_hash: 'یادداشت باید با # شروع شود',
  memo_bad_json: 'یادداشت رمزگشایی‌شده JSON معتبر نیست.',
  memo_bad_payload: 'یادداشت حاوی داده‌های نقطه اتصال نیست.',
  memo_expired: 'داده‌های نقطه اتصال منقضی شده است.',

  // Balance
  account_label: 'حساب',
  account_not_found: 'حساب یافت نشد.',
  refresh: 'بازنشانی',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'پس‌انداز HIVE',
  hbd_savings: 'پس‌انداز HBD',
  est_interest: 'سود تخمینی (~۲۰٪ سالانه):',
  hbd_yr: 'HBD/سال',
  pending_withdrawals: '%1 برداشت در انتظار',
  rpc_label: 'RPC:',
  obfuscated: 'مبهم‌شده',
  direct: 'مستقیم',

  // Transfer
  send_transfer: 'ارسال انتقال',
  recipient: 'گیرنده',
  currency: 'ارز',
  memo_optional: 'یادداشت (اختیاری)',
  public_memo: 'یادداشت عمومی',
  send: 'ارسال',
  recipient_required: 'گیرنده لازم است.',
  confirm_send: 'ارسال %1 به @%2؟',
  sent_tx: 'ارسال شد! TX: %1… (%2)',

  // Savings
  deposit_heading: 'واریز به پس‌انداز',
  withdraw_heading: 'برداشت از پس‌انداز',
  three_day_wait: 'دوره انتظار ۳ روزه برای امنیت.',
  deposit_btn: 'واریز به پس‌انداز',
  withdraw_btn: 'برداشت از پس‌انداز',
  pending_heading: 'در انتظار',
  cancel_latest: 'لغو آخرین',
  available_hbd: 'موجود: %1 HBD',
  apr_estimate: '~%1 HBD/سال (~۲۰٪ سالانه)',
  n_pending: '%1 در انتظار',
  cancelled: 'لغو شد. (%1)',
  confirm_deposit: 'واریز %1؟',
  confirm_withdraw: 'برداشت (انتظار ۳ روزه) %1؟',
  deposited: 'واریز شد',
  withdrawal_initiated: 'برداشت آغاز شد',
  not_found: 'یافت نشد.',

  // Settings — Privacy
  privacy: 'حریم خصوصی',
  mode_label: 'حالت:',
  mode_obfuscated: 'مبهم‌شده',
  mode_direct: 'مستقیم',
  traffic_disguised: 'ترافیک به عنوان درخواست‌های وب عادی پنهان شده است.',
  traffic_plain: 'JSON-RPC آشکار — قابل مشاهده برای ناظران شبکه.',
  switch_to_direct: 'تغییر به مستقیم',
  switch_to_obfuscated: 'تغییر به مبهم‌شده',

  // Settings — RPC
  rpc_endpoint: 'نقطه اتصال RPC',
  current_label: 'فعلی:',
  custom_endpoint: 'نقطه اتصال سفارشی',
  set_btn: 'تنظیم',
  reset_btn: 'بازنشانی',
  check_btn: 'بررسی',
  enter_url: 'URL را وارد کنید.',
  added: 'اضافه شد.',
  reset_done: 'بازنشانی شد.',

  // Settings — Discovery
  discovery: 'کشف',
  status_label: 'وضعیت:',
  n_found: '%1 یافت شد',
  none_found: 'یافت نشد',
  checking: 'در حال بررسی…',
  expires_label: 'انقضا: %1',
  discover: 'کشف',
  check_all: 'بررسی همه',
  no_memo_key: 'کلید Memo ندارید — کشف غیرفعال است.',
  add_memo_hint: 'کلید Memo را هنگام ورود اضافه کنید تا نقاط اتصال پراکسی کشف شوند.',
  found_n: '%1 یافت شد',
  none_found_dot: 'یافت نشد.',
  done: 'انجام شد.',

  // Settings — Endpoints
  endpoints: 'نقاط اتصال',
  none: 'هیچ.',

  // Settings — Account
  account_heading: 'حساب',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'دائمی',
  session: 'نشست',
  logout: 'خروج',

  // Settings — About
  about: 'درباره',
  about_text: 'کیف پول Propolis نسخه ۱.۰.۰ — کلیدها هرگز از این دستگاه خارج نمی‌شوند.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'کلید Active مجوز این حساب را ندارد.',
  err_missing_posting_auth: 'کلید Posting مجوز این حساب را ندارد.',
  err_missing_owner_auth: 'کلید Owner مجوز این حساب را ندارد.',
  err_key_mismatch: 'کلید با این حساب مطابقت ندارد.',
  err_insufficient_rc: 'اعتبار منابع کافی نیست. منتظر بازیابی بمانید یا درخواست واگذاری HP کنید.',
  err_account_not_found: 'حساب در بلاکچین یافت نشد.',
  err_tx_expired: 'تراکنش منقضی شده. لطفاً دوباره تلاش کنید.',
  err_duplicate_tx: 'تراکنش تکراری — قبلاً پردازش شده.',
  err_all_endpoints_failed: 'اتصال به هیچ نود RPC ممکن نیست. اتصال شبکه را بررسی کنید.',
  err_http_error: 'خطای سرور. دوباره تلاش کنید یا نود RPC را تغییر دهید.',
  err_network: 'خطای شبکه. اتصال اینترنت را بررسی کنید.',
  err_timeout: 'زمان درخواست به پایان رسید. دوباره تلاش کنید یا نود RPC را تغییر دهید.',
  err_unknown: 'عملیات ناموفق بود. لطفاً دوباره تلاش کنید.',
} as const;
