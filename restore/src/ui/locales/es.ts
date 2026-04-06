export function fmt(s: string, ...a: (string | number)[]): string {
  return a.reduce<string>((r, v, i) => r.replace(`%${i + 1}`, String(v)), s);
}

export const t = {
  html_lang: 'es',
  html_dir: 'ltr' as const,

  // Scan screen
  scan_title: 'Restaurar Respaldo',
  scan_desc: 'Sube la captura de pantalla de tu QR de respaldo o esc\u00e1nealo con tu c\u00e1mara.',
  scan_tap: 'Toca para seleccionar imagen o arrastra y suelta',
  scan_formats: 'Compatible con PNG, JPG o cualquier imagen con c\u00f3digo QR',
  scan_or: 'o',
  scan_camera_btn: '\u{1F4F7} Escanear con C\u00e1mara',
  scan_camera_stop: 'Detener C\u00e1mara',
  scan_no_qr: 'No se encontr\u00f3 c\u00f3digo QR en esta imagen. Prueba con una captura m\u00e1s n\u00edtida.',
  scan_read_error: 'No se pudo leer la imagen. Prueba con otro archivo.',

  // PIN entry screen
  pin_title: 'Ingresa el PIN',
  pin_desc: 'Ingresa el PIN de 6 caracteres de tu tarjeta de regalo para descifrar el respaldo.',
  pin_placeholder: '------',
  pin_crypto_error: 'Web Crypto no disponible \u2014 se requiere HTTPS.',
  pin_wrong: 'PIN incorrecto o datos de respaldo inv\u00e1lidos. Verifica tu PIN e int\u00e9ntalo de nuevo.',

  // Result screen
  result_title: '\u2705 Respaldo Restaurado',
  result_desc: 'Tus claves han sido descifradas exitosamente.',
  result_account: 'Cuenta',
  result_copy: 'Copiar',
  result_copied: '\u00a1Copiado!',
  result_master_label: 'Contrase\u00f1a Maestra',
  result_master_copy: 'Copiar Contrase\u00f1a Maestra',
  result_master_show: 'Presiona para mostrar contrase\u00f1a maestra',
  result_master_info: 'Esta contrase\u00f1a genera las cuatro claves a continuaci\u00f3n. Gu\u00e1rdala de forma segura.',
  result_keys_label: 'Claves Privadas (WIF)',
  result_key_copy: 'Copiar clave %1',
  result_key_show: 'Presiona para mostrar',
  result_keychain_label: 'Importar a Hive Keychain',
  result_keychain_show: 'Presiona para mostrar QR de importaci\u00f3n Keychain',
  result_keychain_info: 'Escanea con la app m\u00f3vil de Hive Keychain para importar esta cuenta.',
  result_keychain_error: 'No se pudo generar el c\u00f3digo QR.',
  result_warning: '\u26A0\uFE0F Mant\u00e9n estas claves en privado. Cualquiera con tus claves controla tu cuenta.',
  result_start_over: 'Restaurar Otro Respaldo',

  // Key roles
  key_owner: 'propietario',
  key_active: 'activa',
  key_posting: 'publicaci\u00f3n',
  key_memo: 'memo',
} as const;
