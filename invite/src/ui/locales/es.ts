export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'es',
  html_dir: 'ltr' as const,

  // App
  app_title: 'Canjea Tu Invitaci\u00f3n a Hive',

  // Landing
  landing_title: 'Bienvenido a <span class="hive-brand">Hive</span>',
  landing_desc: 'Canjea tu tarjeta de regalo para crear una cuenta en la blockchain Hive.',
  landing_no_card: 'Necesitas una tarjeta de regalo con un c\u00f3digo QR y un PIN para continuar. Escanea el c\u00f3digo QR de tu tarjeta para comenzar.',

  // PIN
  pin_title: 'Ingresa Tu PIN',
  pin_desc: 'Ingresa el PIN de 6 caracteres impreso en tu tarjeta de regalo.',
  pin_placeholder: 'PIN',
  pin_submit: 'Desbloquear',
  pin_error: 'PIN incorrecto. Por favor, verif\u00edcalo e int\u00e9ntalo de nuevo.',
  pin_invalid: 'El PIN debe tener 6 caracteres.',

  // Verifying
  verifying_title: 'Verificando Tarjeta de Regalo',
  verifying_checking: 'Comprobando autenticidad...',
  verifying_failed: 'La verificaci\u00f3n fall\u00f3. Int\u00e9ntalo de nuevo m\u00e1s tarde.',
  verifying_expired: 'Esta tarjeta de regalo ha expirado.',
  verifying_counterfeit: 'No se pudo verificar esta tarjeta de regalo. La firma es inv\u00e1lida.',
  verifying_network: 'No se pudo conectar a la red. Verifica tu conexi\u00f3n e int\u00e9ntalo de nuevo.',

  // Username
  username_title: 'Elige Tu Nombre de Usuario',
  username_desc: 'Elige un nombre de usuario para tu nueva cuenta Hive. Esto no se puede cambiar despu\u00e9s.',
  username_placeholder: 'usuario',
  username_checking: 'Verificando...',
  username_available: '\u00a1Disponible!',
  username_taken: 'Ya est\u00e1 en uso.',
  username_suggestions: 'Prueba uno de estos:',
  username_continue: 'Continuar',

  // Key Backup
  backup_title: 'Importante \u2014 Toma una Captura de Pantalla Ahora',
  backup_desc: 'Este c\u00f3digo QR es el respaldo de las claves de tu cuenta. Sin \u00e9l, podr\u00edas perder el acceso a tu cuenta permanentemente.',
  backup_pin_warning: 'Guarda tu tarjeta de regalo o PIN en un lugar seguro \u2014 lo necesitar\u00e1s junto con este c\u00f3digo QR para recuperar tus claves.',
  backup_qr_label: 'Respaldo Cifrado de Claves',
  backup_qr_info: 'Toma una captura de pantalla o imprime este c\u00f3digo QR antes de continuar. Puedes restaurar tus claves escane\u00e1ndolo e ingresando el PIN de tu tarjeta de regalo.',
  backup_print: 'Imprimir Respaldo',
  backup_print_title: 'Respaldo de Claves de Cuenta Hive',
  backup_print_account: 'Cuenta: @%1',
  backup_print_instructions: 'Escanea este c\u00f3digo QR e ingresa el PIN de tu tarjeta de regalo para recuperar las claves de tu cuenta. Guarda esta impresi\u00f3n y tu tarjeta de regalo en un lugar seguro.',
  backup_master_label: 'Contrase\u00f1a Maestra',
  backup_master_info: 'Esta contrase\u00f1a \u00fanica genera todas las claves de tu cuenta. Tambi\u00e9n puedes guardarla manualmente como precauci\u00f3n adicional.',
  backup_copy: 'Copiar',
  backup_copied: '\u00a1Copiado!',
  backup_keys_label: 'Claves de la Cuenta',
  backup_active_wif: 'Clave Activa',
  backup_posting_wif: 'Clave de Publicaci\u00f3n',
  backup_memo_wif: 'Clave Memo',
  backup_owner_wif: 'Clave de Propietario',
  backup_show_keys: 'Mostrar claves individuales',
  backup_hide_keys: 'Ocultar claves individuales',
  backup_show_manual: 'Mostrar contrase\u00f1a maestra y claves',
  backup_hide_manual: 'Ocultar contrase\u00f1a maestra y claves',
  backup_proceed: 'Crear Mi Cuenta',

  // Claiming
  claiming_title: 'Creando Tu Cuenta',
  claiming_connecting: 'Conectando al servicio de cuentas...',
  claiming_progress: 'Configurando @%1 en la blockchain Hive...',
  claiming_failed: 'La creaci\u00f3n de la cuenta fall\u00f3. Int\u00e9ntalo de nuevo.',
  claiming_timeout: 'La solicitud expir\u00f3. Tu tarjeta de regalo sigue siendo v\u00e1lida \u2014 toca Reintentar.',
  claiming_retry: 'Reintentar',

  // Success
  success_title: '\u00a1Bienvenido a <span class="hive-brand">Hive</span>!',
  success_welcome: 'Tu cuenta @%1 ha sido creada.',
  success_tx: 'Transacci\u00f3n: %1',
  success_peakd_heading: 'Inicia sesi\u00f3n en Peakd',
  success_peakd_intro: 'Peakd es la interfaz m\u00e1s popular de Hive. Vamos a iniciar sesi\u00f3n \u2014 solo toma un momento.',
  success_step_login: 'Tu clave de publicaci\u00f3n se copiar\u00e1 al portapapeles. En Peakd, p\u00e9gala y elige un PIN de 5 d\u00edgitos. \u00a1Eso es todo \u2014 ya est\u00e1s dentro!',
  success_peakd_btn: 'Copiar Clave e Iniciar Sesi\u00f3n en Peakd',
  success_peakd_note: 'PeakLock almacena tu clave de forma segura en tu navegador. Tu clave de publicaci\u00f3n te permite interactuar en Hive (votar, comentar, publicar) pero no puede mover fondos.',
  success_keys_reminder: 'Guarda el PIN de tu tarjeta de regalo \u2014 protege tu respaldo de claves. Puedes restaurar tus claves en cualquier momento escaneando el c\u00f3digo QR de respaldo.',

  // Robust Success \u2014 Phase 1 (Confirmation)
  robust_title: '\u00a1Bienvenido a <span class="hive-brand">Hive</span>!',
  robust_created: 'Tu cuenta @%1 ha sido creada.',
  robust_tx: 'Transacci\u00f3n: %1',

  // Robust Success \u2014 Phase 2 (Bootstrap Save)
  robust_save_heading: 'Guarda Tu Archivo de Monedero',
  robust_save_desc: 'Este archivo te permite acceder a tu monedero en cualquier momento. Est\u00e1 cifrado con el PIN de tu tarjeta de regalo \u2014 guarda tu tarjeta en un lugar seguro.',
  robust_save_download: 'Descargar Archivo de Monedero',
  robust_save_generating: 'Generando archivo de monedero...',
  robust_save_checkbox: 'He guardado mi archivo de monedero',
  robust_save_continue: 'Continuar',
  robust_save_filename: 'propolis-wallet-%1.html',

  // Robust Success \u2014 Phase 3 (Wallet Loading)
  robust_loading_title: 'Cargando Monedero',
  robust_loading_chunk: 'Descargando monedero: fragmento %1 de %2',
  robust_loading_verifying: 'Verificando integridad...',
  robust_loading_ready: '\u00a1Listo!',
  robust_loading_estimate: 'Generalmente toma 10\u201320 segundos',
  robust_enrollment_confirmed: 'Inscripci\u00f3n de punto de conexi\u00f3n confirmada.',
  robust_enrollment_timeout: 'La inscripci\u00f3n del punto de conexi\u00f3n a\u00fan se est\u00e1 procesando. Tu monedero funcionar\u00e1 normalmente \u2014 los puntos de conexi\u00f3n actualizados llegar\u00e1n en unas horas.',

  // Robust Errors
  robust_err_fetch: 'No se pudo obtener el monedero desde la blockchain. Verifica tu conexi\u00f3n e int\u00e9ntalo de nuevo.',
  robust_err_hash: 'La verificaci\u00f3n de integridad del monedero fall\u00f3. Int\u00e9ntalo de nuevo.',
  robust_err_retry: 'Reintentar',

  // Errors
  err_network: 'Error de red. Verifica tu conexi\u00f3n.',
  err_service_down: 'El servicio no est\u00e1 disponible. Tu tarjeta de regalo sigue siendo v\u00e1lida \u2014 int\u00e9ntalo m\u00e1s tarde.',
} as const;
