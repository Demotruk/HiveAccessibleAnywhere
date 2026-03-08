/** Arabic locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'ar',
  html_dir: 'rtl' as const,

  // App
  app_title: 'محفظة Propolis',
  nav_balance: 'الرصيد',
  nav_transfer: 'تحويل',
  nav_savings: 'المدخرات',
  nav_settings: 'الإعدادات',

  // Common
  loading: 'جارٍ التحميل…',
  amount: 'المبلغ',
  confirm: 'تأكيد',
  cancel: 'إلغاء',
  broadcasting: 'جارٍ البث…',
  invalid_url: 'رابط غير صالح.',
  https_required: 'يجب أن يستخدم رابط الوكيل HTTPS.',
  enter_proxy_url: 'أدخل رابط الوكيل.',
  amount_positive: 'يجب أن يكون المبلغ أكبر من صفر.',
  username_placeholder: 'اسم المستخدم',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'الوضع المباشر يكشف حركة مرور Hive. هل تريد المتابعة؟',
  confirm_logout: 'تسجيل الخروج وحذف المفاتيح؟',

  // Login
  login_title: 'تسجيل الدخول',
  login_info: 'أدخل اسم حساب Hive والمفتاح الخاص Active. مفتاحك لا يغادر هذا الجهاز أبداً.',
  account_name: 'اسم الحساب',
  private_active_key: 'المفتاح الخاص Active',
  private_memo_key: 'المفتاح الخاص Memo (اختياري)',
  memo_key_placeholder: '5K... (للرسائل المشفرة)',
  remember_keys: 'تذكر المفاتيح',
  remember_warning: 'يتم تخزين المفاتيح في localStorage. استخدم فقط على جهاز موثوق.',
  login_btn: 'دخول',
  account_key_required: 'اسم الحساب ومفتاح Active مطلوبان.',
  validating: 'جارٍ التحقق…',
  wrong_key_role: 'هذا مفتاح %1. مفتاح Active مطلوب.',
  wrong_memo_role: 'المفتاح الثاني هو %1، وليس Memo.',

  // QR scanning
  scan_qr: 'مسح رمز QR',
  qr_scanning: 'وجّه الكاميرا نحو رمز QR',
  qr_filled_all: 'تم المسح! تم ملء الحساب والمفاتيح.',
  qr_filled_active: 'تم المسح! تم ملء مفتاح Active.',
  qr_filled_memo: 'تم المسح! تم ملء مفتاح Memo.',
  qr_unknown: 'صيغة رمز QR غير معروفة',
  qr_no_camera: 'تم رفض الوصول إلى الكاميرا',

  // Proxy setup
  proxy_setup: 'إعداد الوكيل',
  proxy_required: 'الوكيل مطلوب',
  proxy_desc_reconnect: 'وضع التمويه مفعّل لكن لم يتم تعيين وكيل. أدخل رابط الوكيل لإعادة الاتصال.',
  proxy_desc_connect: 'وضع التمويه مفعّل. أدخل رابط الوكيل للاتصال.',
  proxy_url: 'رابط الوكيل',
  connect: 'اتصال',
  switch_direct_link: 'أو التبديل إلى الوضع المباشر',

  // Memo paste
  paste_memo_prefix: 'أو الصق مذكرة مشفرة من',
  block_explorer: 'مستكشف الكتل',
  paste_memo_suffix: ':',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'فك التشفير والاتصال',
  paste_memo_error: 'الصق المذكرة المشفرة.',
  memo_key_required: 'مفتاح Memo مطلوب لفك التشفير.',
  private_memo_key_label: 'المفتاح الخاص Memo',

  // Memo decode errors
  memo_not_hash: 'يجب أن تبدأ المذكرة بـ #',
  memo_bad_json: 'المذكرة المفكّكة ليست JSON صالح.',
  memo_bad_payload: 'المذكرة لا تحتوي على بيانات نقاط الاتصال.',
  memo_expired: 'بيانات نقطة الاتصال منتهية الصلاحية.',

  // Balance
  account_label: 'الحساب',
  account_not_found: 'الحساب غير موجود.',
  refresh: 'تحديث',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'مدخرات HIVE',
  hbd_savings: 'مدخرات HBD',
  est_interest: 'الفائدة التقديرية (~٢٠٪ سنوياً):',
  hbd_yr: 'HBD/سنة',
  pending_withdrawals: '%1 عمليات سحب معلّقة',
  rpc_label: 'RPC:',
  obfuscated: 'مموّه',
  direct: 'مباشر',

  // Transfer
  send_transfer: 'إرسال تحويل',
  recipient: 'المستلم',
  currency: 'العملة',
  memo_optional: 'مذكرة (اختياري)',
  public_memo: 'مذكرة عامة',
  send: 'إرسال',
  recipient_required: 'المستلم مطلوب.',
  confirm_send: 'إرسال %1 إلى @%2؟',
  sent_tx: 'تم الإرسال! TX: %1… (%2)',

  // Savings
  deposit_heading: 'إيداع في المدخرات',
  withdraw_heading: 'سحب من المدخرات',
  three_day_wait: 'فترة انتظار ٣ أيام للأمان.',
  deposit_btn: 'إيداع في المدخرات',
  withdraw_btn: 'سحب من المدخرات',
  pending_heading: 'معلّق',
  cancel_latest: 'إلغاء الأخير',
  available_hbd: 'متاح: %1 HBD',
  apr_estimate: '~%1 HBD/سنة (~٢٠٪ سنوياً)',
  n_pending: '%1 معلّق',
  cancelled: 'تم الإلغاء. (%1)',
  confirm_deposit: 'إيداع %1؟',
  confirm_withdraw: 'سحب (انتظار ٣ أيام) %1؟',
  deposited: 'تم الإيداع',
  withdrawal_initiated: 'تم بدء السحب',
  not_found: 'غير موجود.',

  // Settings — Privacy
  privacy: 'الخصوصية',
  mode_label: 'الوضع:',
  mode_obfuscated: 'مموّه',
  mode_direct: 'مباشر',
  traffic_disguised: 'حركة المرور متخفية كطلبات ويب عادية.',
  traffic_plain: 'JSON-RPC مكشوف — مرئي لمراقبي الشبكة.',
  switch_to_direct: 'التبديل إلى المباشر',
  switch_to_obfuscated: 'التبديل إلى المموّه',

  // Settings — RPC
  rpc_endpoint: 'نقطة اتصال RPC',
  current_label: 'الحالي:',
  custom_endpoint: 'نقطة اتصال مخصصة',
  set_btn: 'تعيين',
  reset_btn: 'إعادة تعيين',
  check_btn: 'فحص',
  enter_url: 'أدخل رابطاً.',
  added: 'تمت الإضافة.',
  reset_done: 'تمت إعادة التعيين.',

  // Settings — Discovery
  discovery: 'اكتشاف',
  status_label: 'الحالة:',
  n_found: 'تم العثور على %1',
  none_found: 'لم يتم العثور على شيء',
  checking: 'جارٍ الفحص…',
  expires_label: 'ينتهي: %1',
  discover: 'اكتشاف',
  check_all: 'فحص الكل',
  no_memo_key: 'لا يوجد مفتاح Memo — الاكتشاف معطّل.',
  add_memo_hint: 'أضف مفتاح Memo عند الدخول لاكتشاف نقاط اتصال الوكيل.',
  found_n: 'تم العثور على %1',
  none_found_dot: 'لم يتم العثور على شيء.',
  done: 'تم.',

  // Settings — Endpoints
  endpoints: 'نقاط الاتصال',
  none: 'لا يوجد.',

  // Settings — Account
  account_heading: 'الحساب',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'دائم',
  session: 'جلسة',
  logout: 'خروج',

  // Settings — About
  about: 'حول',
  about_text: 'محفظة Propolis الإصدار ١.٠.٠ — المفاتيح لا تغادر هذا الجهاز أبداً.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'مفتاح Active ليس لديه صلاحية لهذا الحساب.',
  err_missing_posting_auth: 'مفتاح Posting ليس لديه صلاحية لهذا الحساب.',
  err_missing_owner_auth: 'مفتاح Owner ليس لديه صلاحية لهذا الحساب.',
  err_key_mismatch: 'المفتاح لا يتطابق مع هذا الحساب.',
  err_insufficient_rc: 'أرصدة الموارد غير كافية. انتظر الاستعادة أو اطلب تفويض HP.',
  err_account_not_found: 'الحساب غير موجود على البلوكتشين.',
  err_tx_expired: 'انتهت صلاحية المعاملة. يرجى المحاولة مرة أخرى.',
  err_duplicate_tx: 'معاملة مكررة — تمت معالجتها بالفعل.',
  err_all_endpoints_failed: 'تعذّر الاتصال بأي عقدة RPC. تحقق من اتصال الشبكة.',
  err_http_error: 'خطأ في الخادم. حاول مرة أخرى أو غيّر عقدة RPC.',
  err_network: 'خطأ في الشبكة. تحقق من اتصال الإنترنت.',
  err_timeout: 'انتهت مهلة الطلب. حاول مرة أخرى أو غيّر عقدة RPC.',
  err_unknown: 'فشلت العملية. يرجى المحاولة مرة أخرى.',
} as const;
