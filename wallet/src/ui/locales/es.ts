/** Spanish locale strings. */

/** Replace %1, %2, ... placeholders with arguments. */
export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'es',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Monedero Propolis',
  nav_balance: 'Saldo',
  nav_transfer: 'Transferir',
  nav_savings: 'Ahorros',
  nav_settings: 'Ajustes',

  // Common
  loading: 'Cargando...',
  amount: 'Cantidad',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  broadcasting: 'Transmitiendo...',
  invalid_url: 'URL no v\u00e1lida.',
  https_required: 'Se requiere HTTPS para URLs de proxy.',
  enter_proxy_url: 'Ingresa una URL de proxy.',
  amount_positive: 'La cantidad debe ser > 0.',
  username_placeholder: 'usuario',
  key_placeholder: '5K...',
  proxy_placeholder: 'https://proxy.ejemplo.com',
  rpc_placeholder: 'https://proxy.ejemplo.com/rpc',

  // Confirm dialogs
  confirm_direct_mode: 'El modo directo expone el tr\u00e1fico de Hive. \u00bfContinuar?',
  confirm_logout: '\u00bfCerrar sesi\u00f3n y borrar claves?',

  // Login
  login_title: 'Iniciar Sesi\u00f3n',
  login_info: 'Ingresa tu nombre de cuenta Hive y tu clave activa privada. Tu clave nunca sale de este dispositivo.',
  account_name: 'Nombre de cuenta',
  private_active_key: 'Clave activa privada',
  private_memo_key: 'Clave memo privada (opcional)',
  memo_key_placeholder: '5K... (para mensajes cifrados)',
  remember_keys: 'Recordar claves',
  remember_warning: 'Las claves se almacenan en localStorage. \u00dasalo solo en un dispositivo de confianza.',
  login_btn: 'Iniciar Sesi\u00f3n',
  account_key_required: 'Se requiere cuenta y clave activa.',
  validating: 'Validando...',
  wrong_key_role: 'Esta es una clave %1. Se requiere clave activa.',
  wrong_memo_role: 'La segunda clave es %1, no memo.',

  // QR scanning
  scan_qr: 'Escanear C\u00f3digo QR',
  qr_scanning: 'Apunta la c\u00e1mara al c\u00f3digo QR',
  qr_filled_all: '\u00a1Escaneado! Cuenta y claves completadas.',
  qr_filled_active: '\u00a1Escaneado! Clave activa completada.',
  qr_filled_memo: '\u00a1Escaneado! Clave memo completada.',
  qr_unknown: 'Formato de c\u00f3digo QR no reconocido',
  qr_no_camera: 'Acceso a la c\u00e1mara denegado',

  // Proxy setup
  proxy_setup: 'Configuraci\u00f3n de Proxy',
  proxy_required: 'Proxy requerido',
  proxy_desc_reconnect: 'La ofuscaci\u00f3n est\u00e1 habilitada pero no hay un punto de conexi\u00f3n proxy configurado. Ingresa una URL de proxy para reconectar.',
  proxy_desc_connect: 'La ofuscaci\u00f3n est\u00e1 habilitada. Ingresa una URL de punto de conexi\u00f3n proxy para conectar.',
  proxy_url: 'URL del Proxy',
  connect: 'Conectar',
  switch_direct_link: 'O cambiar a modo Directo',

  // Memo paste
  paste_memo_prefix: 'O pega un memo cifrado desde un',
  block_explorer: 'explorador de bloques',
  paste_memo_suffix: ':',
  memo_textarea_placeholder: '#memo_cifrado...',
  decrypt_connect: 'Descifrar y Conectar',
  paste_memo_error: 'Pega el memo cifrado.',
  memo_key_required: 'Se requiere clave memo para descifrar.',
  private_memo_key_label: 'Clave memo privada',

  // Memo decode errors
  memo_not_hash: 'El memo debe comenzar con #',
  memo_bad_json: 'El memo descifrado no es JSON v\u00e1lido.',
  memo_bad_payload: 'El memo no contiene datos de punto de conexi\u00f3n.',
  memo_expired: 'Los datos del punto de conexi\u00f3n han expirado.',

  // Balance
  account_label: 'Cuenta',
  account_not_found: 'Cuenta no encontrada.',
  refresh: 'Actualizar',
  hive: 'HIVE',
  hbd: 'HBD',
  hive_savings: 'Ahorros HIVE',
  hbd_savings: 'Ahorros HBD',
  est_interest: 'Inter\u00e9s est. (~20% APR):',
  hbd_yr: 'HBD/a\u00f1o',
  pending_withdrawals: '%1 retiro(s) pendiente(s)',
  rpc_label: 'RPC:',
  obfuscated: 'ofuscado',
  direct: 'directo',

  // Transfer
  send_transfer: 'Enviar Transferencia',
  recipient: 'Destinatario',
  currency: 'Moneda',
  memo_optional: 'Memo (opcional)',
  public_memo: 'Memo p\u00fablico',
  send: 'Enviar',
  recipient_required: 'Destinatario requerido.',
  confirm_send: '\u00bfEnviar %1 a @%2?',
  sent_tx: '\u00a1Enviado! TX: %1... (%2)',

  // Savings
  deposit_heading: 'Depositar en Ahorros',
  withdraw_heading: 'Retirar de Ahorros',
  three_day_wait: 'Per\u00edodo de espera de 3 d\u00edas por seguridad.',
  deposit_btn: 'Depositar en Ahorros',
  withdraw_btn: 'Retirar de Ahorros',
  pending_heading: 'Pendientes',
  cancel_latest: 'Cancelar \u00daltimo',
  available_hbd: 'Disponible: %1 HBD',
  apr_estimate: '~%1 HBD/a\u00f1o (~20% APR)',
  n_pending: '%1 pendiente(s)',
  cancelled: 'Cancelado. (%1)',
  confirm_deposit: '\u00bfDepositar %1?',
  confirm_withdraw: '\u00bfRetirar (espera de 3 d\u00edas) %1?',
  deposited: 'Depositado',
  withdrawal_initiated: 'Retiro iniciado',
  not_found: 'No encontrado.',

  // Settings \u2014 Privacy
  privacy: 'Privacidad',
  mode_label: 'Modo:',
  mode_obfuscated: 'Ofuscado',
  mode_direct: 'Directo',
  traffic_disguised: 'Tr\u00e1fico disfrazado como solicitudes web normales.',
  traffic_plain: 'JSON-RPC plano \u2014 visible para observadores de red.',
  switch_to_direct: 'Cambiar a Directo',
  switch_to_obfuscated: 'Cambiar a Ofuscado',

  // Settings \u2014 RPC
  rpc_endpoint: 'Punto de Conexi\u00f3n RPC',
  current_label: 'Actual:',
  custom_endpoint: 'Punto de conexi\u00f3n personalizado',
  set_btn: 'Establecer',
  reset_btn: 'Restablecer',
  check_btn: 'Verificar',
  enter_url: 'Ingresa una URL.',
  added: 'A\u00f1adido.',
  reset_done: 'Restablecido.',

  // Settings \u2014 Discovery
  discovery: 'Descubrimiento',
  status_label: 'Estado:',
  n_found: '%1 encontrado(s)',
  none_found: 'Ninguno encontrado',
  checking: 'Verificando...',
  expires_label: 'Expira: %1',
  discover: 'Descubrir',
  check_all: 'Verificar Todos',
  no_memo_key: 'Sin clave memo \u2014 descubrimiento deshabilitado.',
  add_memo_hint: 'A\u00f1ade la clave memo al iniciar sesi\u00f3n para descubrir puntos de conexi\u00f3n proxy.',
  found_n: '%1 encontrado(s)',
  none_found_dot: 'Ninguno encontrado.',
  done: 'Listo.',

  // Settings \u2014 Endpoints
  endpoints: 'Puntos de Conexi\u00f3n',
  none: 'Ninguno.',

  // Settings \u2014 Account
  account_heading: 'Cuenta',
  active_check: 'Activa:',
  memo_check: 'Memo:',
  persistent: 'Persistente',
  session: 'Sesi\u00f3n',
  logout: 'Cerrar Sesi\u00f3n',

  // Settings \u2014 About
  about: 'Acerca de',
  about_text: 'Monedero Propolis v1.0.0 \u2014 Las claves nunca salen de este dispositivo.',

  // RPC / broadcast errors (localized with raw detail preserved)
  err_missing_active_auth: 'La clave activa no tiene autoridad para esta cuenta.',
  err_missing_posting_auth: 'La clave de publicaci\u00f3n no tiene autoridad para esta cuenta.',
  err_missing_owner_auth: 'La clave de propietario no tiene autoridad para esta cuenta.',
  err_key_mismatch: 'La clave no coincide con esta cuenta.',
  err_insufficient_rc: 'Cr\u00e9ditos de recursos insuficientes. Espera la recuperaci\u00f3n o solicita delegaci\u00f3n de HP.',
  err_account_not_found: 'Cuenta no encontrada en la blockchain.',
  err_tx_expired: 'Transacci\u00f3n expirada. Int\u00e9ntalo de nuevo.',
  err_duplicate_tx: 'Transacci\u00f3n duplicada \u2014 ya fue procesada.',
  err_all_endpoints_failed: 'No se pudo conectar a ning\u00fan nodo RPC. Verifica tu conexi\u00f3n de red.',
  err_http_error: 'Error del servidor. Int\u00e9ntalo de nuevo o cambia de nodo RPC.',
  err_network: 'Error de red. Verifica tu conexi\u00f3n a internet.',
  err_timeout: 'La solicitud expir\u00f3. Int\u00e9ntalo de nuevo o cambia de nodo RPC.',
  err_unknown: 'La operaci\u00f3n fall\u00f3. Int\u00e9ntalo de nuevo.',
} as const;
