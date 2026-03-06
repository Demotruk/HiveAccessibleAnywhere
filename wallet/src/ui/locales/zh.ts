/** Chinese (Simplified) locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'zh',

  // App
  app_title: 'HAA 钱包',
  nav_balance: '余额',
  nav_transfer: '转账',
  nav_savings: '储蓄',
  nav_settings: '设置',

  // Common
  loading: '加载中…',
  amount: '金额',
  confirm: '确认',
  cancel: '取消',
  broadcasting: '广播中…',
  invalid_url: '无效的URL。',
  enter_proxy_url: '请输入代理URL。',
  amount_positive: '金额必须大于0。',
  username_placeholder: '用户名',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: '直连模式会暴露Hive流量，是否继续？',
  confirm_logout: '退出登录并清除密钥？',

  // Login
  login_title: '登录',
  login_info: '输入您的Hive账户名和私有Active密钥。密钥绝不会离开此设备。',
  account_name: '账户名',
  private_active_key: '私有Active密钥',
  private_memo_key: '私有Memo密钥（可选）',
  memo_key_placeholder: '5K...（用于加密消息）',
  remember_keys: '记住密钥',
  remember_warning: '密钥将存储在本地存储中，仅在可信设备上使用。',
  login_btn: '登录',
  account_key_required: '需要账户名和Active密钥。',
  validating: '验证中…',
  wrong_key_role: '这是 %1 密钥，需要Active密钥。',
  wrong_memo_role: '第二个密钥是 %1，不是Memo密钥。',

  // Proxy setup
  proxy_setup: '代理设置',
  proxy_required: '需要代理',
  proxy_desc_reconnect: '已启用混淆模式，但未配置代理节点。请输入代理URL以重新连接。',
  proxy_desc_connect: '已启用混淆模式。请输入代理节点URL以连接。',
  proxy_url: '代理URL',
  connect: '连接',
  switch_direct_link: '或切换到直连模式',

  // Memo paste
  paste_memo_prefix: '或从',
  block_explorer: '区块浏览器',
  paste_memo_suffix: '粘贴加密备忘录：',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: '解密并连接',
  paste_memo_error: '请粘贴加密备忘录。',
  memo_key_required: '需要Memo密钥才能解密。',
  private_memo_key_label: '私有Memo密钥',

  // Memo decode errors
  memo_not_hash: '备忘录必须以#开头',
  memo_bad_json: '解密的备忘录不是有效的JSON。',
  memo_bad_payload: '备忘录不包含节点数据。',
  memo_expired: '节点数据已过期。',

  // Balance
  account_label: '账户',
  account_not_found: '未找到账户。',
  refresh: '刷新',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'HIVE储蓄',
  hbd_savings: 'HBD储蓄',
  est_interest: '预估利息（~20% APR）：',
  hbd_yr: 'HBD/年',
  pending_withdrawals: '%1 笔待处理提取',
  rpc_label: 'RPC:',
  obfuscated: '已混淆',
  direct: '直连',

  // Transfer
  send_transfer: '发送转账',
  recipient: '收款人',
  currency: '币种',
  memo_optional: '备注（可选）',
  public_memo: '公开备注',
  send: '发送',
  recipient_required: '需要收款人。',
  confirm_send: '发送 %1 给 @%2？',
  sent_tx: '已发送！TX: %1…（%2）',

  // Savings
  deposit_heading: '存入储蓄',
  withdraw_heading: '从储蓄提取',
  three_day_wait: '提取需要3天等待期。',
  deposit_btn: '存入储蓄',
  withdraw_btn: '从储蓄提取',
  pending_heading: '待处理',
  cancel_latest: '取消最新',
  available_hbd: '可用: %1 HBD',
  apr_estimate: '~%1 HBD/年（~20% APR）',
  n_pending: '%1 笔待处理',
  cancelled: '已取消。（%1）',
  confirm_deposit: '存入 %1？',
  confirm_withdraw: '提取（3天等待）%1？',
  deposited: '已存入',
  withdrawal_initiated: '提取已发起',
  not_found: '未找到。',

  // Settings — Privacy
  privacy: '隐私',
  mode_label: '模式：',
  mode_obfuscated: '混淆',
  mode_direct: '直连',
  traffic_disguised: '流量伪装为普通网络请求。',
  traffic_plain: '明文JSON-RPC — 对网络观察者可见。',
  switch_to_direct: '切换到直连',
  switch_to_obfuscated: '切换到混淆',

  // Settings — RPC
  rpc_endpoint: 'RPC节点',
  current_label: '当前：',
  custom_endpoint: '自定义节点',
  set_btn: '设置',
  reset_btn: '重置',
  check_btn: '检查',
  enter_url: '请输入URL。',
  added: '已添加。',
  reset_done: '已重置。',

  // Settings — Discovery
  discovery: '节点发现',
  status_label: '状态：',
  n_found: '已找到 %1 个',
  none_found: '未找到',
  checking: '检查中…',
  expires_label: '过期时间：%1',
  discover: '发现',
  check_all: '全部检查',
  no_memo_key: '无Memo密钥 — 节点发现已禁用。',
  add_memo_hint: '在登录时添加Memo密钥以发现代理节点。',
  found_n: '找到 %1 个',
  none_found_dot: '未找到。',
  done: '完成。',

  // Settings — Endpoints
  endpoints: '节点列表',
  none: '无。',

  // Settings — Account
  account_heading: '账户',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: '持久',
  session: '会话',
  logout: '退出',

  // Settings — About
  about: '关于',
  about_text: 'HAA钱包 v0.1.0 — 密钥绝不会离开此设备。',
} as const;
