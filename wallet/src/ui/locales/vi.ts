/** Vietnamese locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'vi',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Ví Propolis',
  nav_balance: 'Số dư',
  nav_transfer: 'Chuyển khoản',
  nav_savings: 'Tiết kiệm',
  nav_settings: 'Cài đặt',

  // Common
  loading: 'Đang tải…',
  amount: 'Số tiền',
  confirm: 'Xác nhận',
  cancel: 'Hủy',
  broadcasting: 'Đang phát…',
  invalid_url: 'URL không hợp lệ.',
  https_required: 'URL proxy phải sử dụng HTTPS.',
  enter_proxy_url: 'Nhập URL proxy.',
  amount_positive: 'Số tiền phải lớn hơn 0.',
  username_placeholder: 'tên người dùng',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'Chế độ trực tiếp sẽ lộ lưu lượng Hive. Tiếp tục?',
  confirm_logout: 'Đăng xuất và xóa khóa?',

  // Login
  login_title: 'Đăng nhập',
  login_info: 'Nhập tên tài khoản Hive và khóa riêng Active. Khóa của bạn không bao giờ rời khỏi thiết bị này.',
  account_name: 'Tên tài khoản',
  private_active_key: 'Khóa riêng Active',
  private_memo_key: 'Khóa riêng Memo (tùy chọn)',
  memo_key_placeholder: '5K... (cho tin nhắn mã hóa)',
  remember_keys: 'Ghi nhớ khóa',
  remember_warning: 'Khóa được lưu trong localStorage. Chỉ sử dụng trên thiết bị đáng tin cậy.',
  login_btn: 'Đăng nhập',
  account_key_required: 'Cần tên tài khoản và khóa Active.',
  validating: 'Đang xác thực…',
  wrong_key_role: 'Đây là khóa %1. Cần khóa Active.',
  wrong_memo_role: 'Khóa thứ hai là %1, không phải Memo.',

  // QR scanning
  scan_qr: 'Quét mã QR',
  qr_scanning: 'Hướng camera vào mã QR',
  qr_filled_all: 'Đã quét! Đã điền tài khoản và khóa.',
  qr_filled_active: 'Đã quét! Đã điền khóa Active.',
  qr_filled_memo: 'Đã quét! Đã điền khóa Memo.',
  qr_unknown: 'Định dạng mã QR không nhận dạng được',
  qr_no_camera: 'Quyền truy cập camera bị từ chối',

  // Proxy setup
  proxy_setup: 'Cài đặt Proxy',
  proxy_required: 'Yêu cầu proxy',
  proxy_desc_reconnect: 'Chế độ che giấu đã bật nhưng chưa cấu hình proxy. Nhập URL proxy để kết nối lại.',
  proxy_desc_connect: 'Chế độ che giấu đã bật. Nhập URL proxy để kết nối.',
  proxy_url: 'URL Proxy',
  connect: 'Kết nối',
  switch_direct_link: 'Hoặc chuyển sang chế độ trực tiếp',

  // Memo paste
  paste_memo_prefix: 'Hoặc dán bản ghi nhớ mã hóa từ',
  block_explorer: 'trình duyệt khối',
  paste_memo_suffix: ':',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'Giải mã & Kết nối',
  paste_memo_error: 'Dán bản ghi nhớ mã hóa.',
  memo_key_required: 'Cần khóa Memo để giải mã.',
  private_memo_key_label: 'Khóa riêng Memo',

  // Memo decode errors
  memo_not_hash: 'Bản ghi nhớ phải bắt đầu bằng #',
  memo_bad_json: 'Bản ghi nhớ giải mã không phải JSON hợp lệ.',
  memo_bad_payload: 'Bản ghi nhớ không chứa dữ liệu điểm cuối.',
  memo_expired: 'Dữ liệu điểm cuối đã hết hạn.',

  // Balance
  account_label: 'Tài khoản',
  account_not_found: 'Không tìm thấy tài khoản.',
  refresh: 'Làm mới',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'Tiết kiệm HIVE',
  hbd_savings: 'Tiết kiệm HBD',
  est_interest: 'Lãi ước tính (~20% năm):',
  hbd_yr: 'HBD/năm',
  pending_withdrawals: '%1 lệnh rút đang chờ',
  rpc_label: 'RPC:',
  obfuscated: 'đã che giấu',
  direct: 'trực tiếp',

  // Transfer
  send_transfer: 'Gửi chuyển khoản',
  recipient: 'Người nhận',
  currency: 'Tiền tệ',
  memo_optional: 'Ghi chú (tùy chọn)',
  public_memo: 'Ghi chú công khai',
  send: 'Gửi',
  recipient_required: 'Cần nhập người nhận.',
  confirm_send: 'Gửi %1 cho @%2?',
  sent_tx: 'Đã gửi! TX: %1… (%2)',

  // Savings
  deposit_heading: 'Gửi vào tiết kiệm',
  withdraw_heading: 'Rút từ tiết kiệm',
  three_day_wait: 'Thời gian chờ 3 ngày để đảm bảo an toàn.',
  deposit_btn: 'Gửi vào tiết kiệm',
  withdraw_btn: 'Rút từ tiết kiệm',
  pending_heading: 'Đang chờ',
  cancel_latest: 'Hủy gần nhất',
  available_hbd: 'Khả dụng: %1 HBD',
  apr_estimate: '~%1 HBD/năm (~20% năm)',
  n_pending: '%1 đang chờ',
  cancelled: 'Đã hủy. (%1)',
  confirm_deposit: 'Gửi %1?',
  confirm_withdraw: 'Rút (chờ 3 ngày) %1?',
  deposited: 'Đã gửi',
  withdrawal_initiated: 'Đã bắt đầu rút',
  not_found: 'Không tìm thấy.',

  // Settings — Privacy
  privacy: 'Quyền riêng tư',
  mode_label: 'Chế độ:',
  mode_obfuscated: 'Che giấu',
  mode_direct: 'Trực tiếp',
  traffic_disguised: 'Lưu lượng được ngụy trang như yêu cầu web bình thường.',
  traffic_plain: 'JSON-RPC rõ ràng — có thể thấy bởi người quan sát mạng.',
  switch_to_direct: 'Chuyển sang trực tiếp',
  switch_to_obfuscated: 'Chuyển sang che giấu',

  // Settings — RPC
  rpc_endpoint: 'Điểm cuối RPC',
  current_label: 'Hiện tại:',
  custom_endpoint: 'Điểm cuối tùy chỉnh',
  set_btn: 'Đặt',
  reset_btn: 'Đặt lại',
  check_btn: 'Kiểm tra',
  enter_url: 'Nhập URL.',
  added: 'Đã thêm.',
  reset_done: 'Đã đặt lại.',

  // Settings — Discovery
  discovery: 'Khám phá',
  status_label: 'Trạng thái:',
  n_found: 'Tìm thấy %1',
  none_found: 'Không tìm thấy',
  checking: 'Đang kiểm tra…',
  expires_label: 'Hết hạn: %1',
  discover: 'Khám phá',
  check_all: 'Kiểm tra tất cả',
  no_memo_key: 'Không có khóa Memo — khám phá bị tắt.',
  add_memo_hint: 'Thêm khóa Memo khi đăng nhập để khám phá điểm cuối proxy.',
  found_n: 'Tìm thấy %1',
  none_found_dot: 'Không tìm thấy.',
  done: 'Hoàn tất.',

  // Settings — Endpoints
  endpoints: 'Điểm cuối',
  none: 'Không có.',

  // Settings — Account
  account_heading: 'Tài khoản',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'Lưu trữ',
  session: 'Phiên',
  logout: 'Đăng xuất',

  // Settings — About
  about: 'Giới thiệu',
  about_text: 'Ví Propolis v1.0.0 — Khóa không bao giờ rời khỏi thiết bị này.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'Khóa Active không có quyền cho tài khoản này.',
  err_missing_posting_auth: 'Khóa Posting không có quyền cho tài khoản này.',
  err_missing_owner_auth: 'Khóa Owner không có quyền cho tài khoản này.',
  err_key_mismatch: 'Khóa không khớp với tài khoản này.',
  err_insufficient_rc: 'Không đủ tín dụng tài nguyên. Chờ phục hồi hoặc yêu cầu ủy quyền HP.',
  err_account_not_found: 'Không tìm thấy tài khoản trên blockchain.',
  err_tx_expired: 'Giao dịch đã hết hạn. Vui lòng thử lại.',
  err_duplicate_tx: 'Giao dịch trùng lặp — đã được xử lý.',
  err_all_endpoints_failed: 'Không thể kết nối đến bất kỳ nút RPC nào. Kiểm tra kết nối mạng.',
  err_http_error: 'Lỗi máy chủ. Thử lại hoặc đổi nút RPC.',
  err_network: 'Lỗi mạng. Kiểm tra kết nối internet.',
  err_timeout: 'Yêu cầu hết thời gian chờ. Thử lại hoặc đổi nút RPC.',
  err_unknown: 'Thao tác thất bại. Vui lòng thử lại.',
} as const;
