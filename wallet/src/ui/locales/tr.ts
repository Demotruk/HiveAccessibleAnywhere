/** Turkish locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'tr',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Propolis Cüzdan',
  nav_balance: 'Bakiye',
  nav_transfer: 'Transfer',
  nav_savings: 'Birikim',
  nav_settings: 'Ayarlar',

  // Common
  loading: 'Yükleniyor…',
  amount: 'Miktar',
  confirm: 'Onayla',
  cancel: 'İptal',
  broadcasting: 'Yayınlanıyor…',
  invalid_url: 'Geçersiz URL.',
  https_required: 'Proxy URL HTTPS kullanmalıdır.',
  enter_proxy_url: 'Bir proxy URL girin.',
  amount_positive: 'Miktar 0\'dan büyük olmalıdır.',
  username_placeholder: 'kullanıcı adı',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'Doğrudan mod Hive trafiğini açığa çıkarır. Devam edilsin mi?',
  confirm_logout: 'Çıkış yap ve anahtarları sil?',

  // Login
  login_title: 'Giriş',
  login_info: 'Hive hesap adınızı ve özel Active anahtarınızı girin. Anahtarınız bu cihazdan asla çıkmaz.',
  account_name: 'Hesap adı',
  private_active_key: 'Özel Active anahtarı',
  private_memo_key: 'Özel Memo anahtarı (isteğe bağlı)',
  memo_key_placeholder: '5K... (şifreli mesajlar için)',
  remember_keys: 'Anahtarları hatırla',
  remember_warning: 'Anahtarlar localStorage\'da saklanır. Yalnızca güvenilir cihazlarda kullanın.',
  login_btn: 'Giriş Yap',
  account_key_required: 'Hesap adı ve Active anahtarı gerekli.',
  validating: 'Doğrulanıyor…',
  wrong_key_role: 'Bu bir %1 anahtarı. Active anahtarı gerekli.',
  wrong_memo_role: 'İkinci anahtar %1, Memo değil.',

  // QR scanning
  scan_qr: 'QR Kod Tara',
  qr_scanning: 'Kamerayı QR koda doğrultun',
  qr_filled_all: 'Tarandı! Hesap ve anahtarlar dolduruldu.',
  qr_filled_active: 'Tarandı! Active anahtarı dolduruldu.',
  qr_filled_memo: 'Tarandı! Memo anahtarı dolduruldu.',
  qr_unknown: 'Tanınmayan QR kod formatı',
  qr_no_camera: 'Kamera erişimi reddedildi',

  // Proxy setup
  proxy_setup: 'Proxy Ayarı',
  proxy_required: 'Proxy gerekli',
  proxy_desc_reconnect: 'Gizleme modu etkin ama proxy yapılandırılmamış. Yeniden bağlanmak için proxy URL girin.',
  proxy_desc_connect: 'Gizleme modu etkin. Bağlanmak için proxy URL girin.',
  proxy_url: 'Proxy URL',
  connect: 'Bağlan',
  switch_direct_link: 'Veya doğrudan moda geç',

  // Memo paste
  paste_memo_prefix: 'Veya şifreli bir notu',
  block_explorer: 'blok gezgininden',
  paste_memo_suffix: ' yapıştırın:',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'Şifre Çöz ve Bağlan',
  paste_memo_error: 'Şifreli notu yapıştırın.',
  memo_key_required: 'Şifre çözmek için Memo anahtarı gerekli.',
  private_memo_key_label: 'Özel Memo anahtarı',

  // Memo decode errors
  memo_not_hash: 'Not # ile başlamalıdır',
  memo_bad_json: 'Çözülen not geçerli bir JSON değil.',
  memo_bad_payload: 'Not, uç nokta verisi içermiyor.',
  memo_expired: 'Uç nokta verisi süresi dolmuş.',

  // Balance
  account_label: 'Hesap',
  account_not_found: 'Hesap bulunamadı.',
  refresh: 'Yenile',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'HIVE Birikim',
  hbd_savings: 'HBD Birikim',
  est_interest: 'Tahmini faiz (~%20 yıllık):',
  hbd_yr: 'HBD/yıl',
  pending_withdrawals: '%1 bekleyen çekim',
  rpc_label: 'RPC:',
  obfuscated: 'gizlenmiş',
  direct: 'doğrudan',

  // Transfer
  send_transfer: 'Transfer Gönder',
  recipient: 'Alıcı',
  currency: 'Para Birimi',
  memo_optional: 'Not (isteğe bağlı)',
  public_memo: 'Herkese açık not',
  send: 'Gönder',
  recipient_required: 'Alıcı gerekli.',
  confirm_send: '%1 tutarı @%2 hesabına gönderilsin mi?',
  sent_tx: 'Gönderildi! TX: %1… (%2)',

  // Savings
  deposit_heading: 'Birikime Yatır',
  withdraw_heading: 'Birikimden Çek',
  three_day_wait: 'Güvenlik için 3 günlük bekleme süresi.',
  deposit_btn: 'Birikime Yatır',
  withdraw_btn: 'Birikimden Çek',
  pending_heading: 'Bekleyen',
  cancel_latest: 'Son İşlemi İptal Et',
  available_hbd: 'Mevcut: %1 HBD',
  apr_estimate: '~%1 HBD/yıl (~%20 yıllık)',
  n_pending: '%1 bekliyor',
  cancelled: 'İptal edildi. (%1)',
  confirm_deposit: '%1 yatırılsın mı?',
  confirm_withdraw: 'Çekilsin mi (3 gün bekleme) %1?',
  deposited: 'Yatırıldı',
  withdrawal_initiated: 'Çekim başlatıldı',
  not_found: 'Bulunamadı.',

  // Settings — Privacy
  privacy: 'Gizlilik',
  mode_label: 'Mod:',
  mode_obfuscated: 'Gizlenmiş',
  mode_direct: 'Doğrudan',
  traffic_disguised: 'Trafik normal web istekleri olarak gizleniyor.',
  traffic_plain: 'Açık JSON-RPC — ağ gözlemcilerine görünür.',
  switch_to_direct: 'Doğrudan moda geç',
  switch_to_obfuscated: 'Gizlenmiş moda geç',

  // Settings — RPC
  rpc_endpoint: 'RPC Uç Noktası',
  current_label: 'Mevcut:',
  custom_endpoint: 'Özel uç nokta',
  set_btn: 'Ayarla',
  reset_btn: 'Sıfırla',
  check_btn: 'Kontrol',
  enter_url: 'Bir URL girin.',
  added: 'Eklendi.',
  reset_done: 'Sıfırlandı.',

  // Settings — Discovery
  discovery: 'Keşif',
  status_label: 'Durum:',
  n_found: '%1 bulundu',
  none_found: 'Bulunamadı',
  checking: 'Kontrol ediliyor…',
  expires_label: 'Bitiş: %1',
  discover: 'Keşfet',
  check_all: 'Tümünü Kontrol Et',
  no_memo_key: 'Memo anahtarı yok — keşif devre dışı.',
  add_memo_hint: 'Proxy uç noktalarını keşfetmek için girişte Memo anahtarı ekleyin.',
  found_n: '%1 bulundu',
  none_found_dot: 'Bulunamadı.',
  done: 'Tamamlandı.',

  // Settings — Endpoints
  endpoints: 'Uç Noktalar',
  none: 'Yok.',

  // Settings — Account
  account_heading: 'Hesap',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'Kalıcı',
  session: 'Oturum',
  logout: 'Çıkış',

  // Settings — About
  about: 'Hakkında',
  about_text: 'Propolis Cüzdan v1.0.0 — Anahtarlar bu cihazdan asla çıkmaz.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'Active anahtarı bu hesap için yetkiye sahip değil.',
  err_missing_posting_auth: 'Posting anahtarı bu hesap için yetkiye sahip değil.',
  err_missing_owner_auth: 'Owner anahtarı bu hesap için yetkiye sahip değil.',
  err_key_mismatch: 'Anahtar bu hesapla eşleşmiyor.',
  err_insufficient_rc: 'Yetersiz kaynak kredisi. Toparlanmasını bekleyin veya HP delegasyonu isteyin.',
  err_account_not_found: 'Hesap blokzincirde bulunamadı.',
  err_tx_expired: 'İşlem süresi doldu. Lütfen tekrar deneyin.',
  err_duplicate_tx: 'Tekrarlanan işlem — zaten işlendi.',
  err_all_endpoints_failed: 'Hiçbir RPC düğümüne ulaşılamadı. Ağ bağlantınızı kontrol edin.',
  err_http_error: 'Sunucu hatası. Tekrar deneyin veya RPC düğümünü değiştirin.',
  err_network: 'Ağ hatası. İnternet bağlantınızı kontrol edin.',
  err_timeout: 'İstek zaman aşımına uğradı. Tekrar deneyin veya RPC düğümünü değiştirin.',
  err_unknown: 'İşlem başarısız oldu. Lütfen tekrar deneyin.',
} as const;
