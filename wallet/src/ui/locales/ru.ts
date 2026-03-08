/** Russian locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'ru',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Propolis Кошелёк',
  nav_balance: 'Баланс',
  nav_transfer: 'Перевод',
  nav_savings: 'Сбережения',
  nav_settings: 'Настройки',

  // Common
  loading: 'Загрузка…',
  amount: 'Сумма',
  confirm: 'Подтвердить',
  cancel: 'Отмена',
  broadcasting: 'Отправка…',
  invalid_url: 'Неверный URL.',
  https_required: 'URL прокси должен использовать HTTPS.',
  enter_proxy_url: 'Введите URL прокси.',
  amount_positive: 'Сумма должна быть > 0.',
  username_placeholder: 'имя пользователя',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.example.com',
  rpc_placeholder: 'https://proxy.example.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'Прямой режим раскрывает трафик Hive. Продолжить?',
  confirm_logout: 'Выйти и удалить ключи?',

  // Login
  login_title: 'Вход',
  login_info: 'Введите имя аккаунта Hive и приватный Active-ключ. Ключ никогда не покидает это устройство.',
  account_name: 'Имя аккаунта',
  private_active_key: 'Приватный Active-ключ',
  private_memo_key: 'Приватный Memo-ключ (необязательно)',
  memo_key_placeholder: '5K... (для зашифрованных сообщений)',
  remember_keys: 'Запомнить ключи',
  remember_warning: 'Ключи хранятся в localStorage. Используйте только на доверенном устройстве.',
  login_btn: 'Войти',
  account_key_required: 'Требуются имя аккаунта и Active-ключ.',
  validating: 'Проверка…',
  wrong_key_role: 'Это ключ %1. Требуется Active-ключ.',
  wrong_memo_role: 'Второй ключ — %1, а не Memo.',

  // QR scanning
  scan_qr: 'Сканировать QR-код',
  qr_scanning: 'Наведите камеру на QR-код',
  qr_filled_all: 'Отсканировано! Аккаунт и ключи заполнены.',
  qr_filled_active: 'Отсканировано! Active-ключ заполнен.',
  qr_filled_memo: 'Отсканировано! Memo-ключ заполнен.',
  qr_unknown: 'Неизвестный формат QR-кода',
  qr_no_camera: 'Доступ к камере запрещён',

  // Proxy setup
  proxy_setup: 'Настройка прокси',
  proxy_required: 'Требуется прокси',
  proxy_desc_reconnect: 'Режим обфускации включён, но прокси не настроен. Введите URL прокси для переподключения.',
  proxy_desc_connect: 'Режим обфускации включён. Введите URL прокси для подключения.',
  proxy_url: 'URL прокси',
  connect: 'Подключить',
  switch_direct_link: 'Или переключиться на прямой режим',

  // Memo paste
  paste_memo_prefix: 'Или вставьте зашифрованную заметку из',
  block_explorer: 'обозревателя блоков',
  paste_memo_suffix: ':',
  memo_textarea_placeholder: '#encrypted_memo...',
  decrypt_connect: 'Расшифровать и подключить',
  paste_memo_error: 'Вставьте зашифрованную заметку.',
  memo_key_required: 'Для расшифровки нужен Memo-ключ.',
  private_memo_key_label: 'Приватный Memo-ключ',

  // Memo decode errors
  memo_not_hash: 'Заметка должна начинаться с #',
  memo_bad_json: 'Расшифрованная заметка не является валидным JSON.',
  memo_bad_payload: 'Заметка не содержит данных о конечных точках.',
  memo_expired: 'Данные конечных точек истекли.',

  // Balance
  account_label: 'Аккаунт',
  account_not_found: 'Аккаунт не найден.',
  refresh: 'Обновить',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'HIVE Сбережения',
  hbd_savings: 'HBD Сбережения',
  est_interest: 'Расч. проценты (~20% годовых):',
  hbd_yr: 'HBD/год',
  pending_withdrawals: '%1 ожидающих выводов',
  rpc_label: 'RPC:',
  obfuscated: 'обфусцировано',
  direct: 'прямой',

  // Transfer
  send_transfer: 'Отправить перевод',
  recipient: 'Получатель',
  currency: 'Валюта',
  memo_optional: 'Заметка (необязательно)',
  public_memo: 'Публичная заметка',
  send: 'Отправить',
  recipient_required: 'Требуется получатель.',
  confirm_send: 'Отправить %1 пользователю @%2?',
  sent_tx: 'Отправлено! TX: %1… (%2)',

  // Savings
  deposit_heading: 'Внести в сбережения',
  withdraw_heading: 'Вывести из сбережений',
  three_day_wait: 'Период ожидания 3 дня для безопасности.',
  deposit_btn: 'Внести в сбережения',
  withdraw_btn: 'Вывести из сбережений',
  pending_heading: 'Ожидание',
  cancel_latest: 'Отменить последний',
  available_hbd: 'Доступно: %1 HBD',
  apr_estimate: '~%1 HBD/год (~20% годовых)',
  n_pending: '%1 в ожидании',
  cancelled: 'Отменено. (%1)',
  confirm_deposit: 'Внести %1?',
  confirm_withdraw: 'Вывести (ожидание 3 дня) %1?',
  deposited: 'Внесено',
  withdrawal_initiated: 'Вывод инициирован',
  not_found: 'Не найдено.',

  // Settings — Privacy
  privacy: 'Конфиденциальность',
  mode_label: 'Режим:',
  mode_obfuscated: 'Обфусцированный',
  mode_direct: 'Прямой',
  traffic_disguised: 'Трафик замаскирован под обычные веб-запросы.',
  traffic_plain: 'Открытый JSON-RPC — виден сетевым наблюдателям.',
  switch_to_direct: 'Переключить на прямой',
  switch_to_obfuscated: 'Переключить на обфусцированный',

  // Settings — RPC
  rpc_endpoint: 'RPC-узел',
  current_label: 'Текущий:',
  custom_endpoint: 'Пользовательский узел',
  set_btn: 'Установить',
  reset_btn: 'Сбросить',
  check_btn: 'Проверить',
  enter_url: 'Введите URL.',
  added: 'Добавлено.',
  reset_done: 'Сброшено.',

  // Settings — Discovery
  discovery: 'Обнаружение',
  status_label: 'Статус:',
  n_found: '%1 найдено',
  none_found: 'Не найдено',
  checking: 'Проверка…',
  expires_label: 'Истекает: %1',
  discover: 'Обнаружить',
  check_all: 'Проверить все',
  no_memo_key: 'Нет Memo-ключа — обнаружение отключено.',
  add_memo_hint: 'Добавьте Memo-ключ при входе для обнаружения прокси-узлов.',
  found_n: 'Найдено %1',
  none_found_dot: 'Не найдено.',
  done: 'Готово.',

  // Settings — Endpoints
  endpoints: 'Конечные точки',
  none: 'Нет.',

  // Settings — Account
  account_heading: 'Аккаунт',
  active_check: 'Active:',
  memo_check: 'Memo:',
  persistent: 'Постоянный',
  session: 'Сеанс',
  logout: 'Выйти',

  // Settings — About
  about: 'О приложении',
  about_text: 'Propolis Кошелёк v1.0.0 — Ключи никогда не покидают это устройство.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'Active-ключ не имеет полномочий для этого аккаунта.',
  err_missing_posting_auth: 'Posting-ключ не имеет полномочий для этого аккаунта.',
  err_missing_owner_auth: 'Owner-ключ не имеет полномочий для этого аккаунта.',
  err_key_mismatch: 'Ключ не совпадает с этим аккаунтом.',
  err_insufficient_rc: 'Недостаточно ресурсных кредитов. Дождитесь восстановления или запросите делегирование HP.',
  err_account_not_found: 'Аккаунт не найден в блокчейне.',
  err_tx_expired: 'Транзакция истекла. Попробуйте снова.',
  err_duplicate_tx: 'Дублирующая транзакция — уже обработана.',
  err_all_endpoints_failed: 'Не удалось подключиться ни к одному RPC-узлу. Проверьте сетевое подключение.',
  err_http_error: 'Ошибка сервера. Попробуйте снова или смените RPC-узел.',
  err_network: 'Ошибка сети. Проверьте подключение к интернету.',
  err_timeout: 'Превышено время ожидания. Попробуйте снова или смените RPC-узел.',
  err_unknown: 'Операция не удалась. Попробуйте снова.',
} as const;
