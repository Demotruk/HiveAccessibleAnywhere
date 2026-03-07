/**
 * Localize Hive RPC and broadcast errors for user display.
 *
 * Hive nodes return English-only error messages with no error codes.
 * This module maps known error patterns to localized user-friendly
 * messages while preserving the raw English detail for debugging.
 */

import { t } from '../ui/locale';

/** Escape HTML special characters in untrusted RPC text. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Known error patterns, ordered from most specific to least.
 * Each entry: [regex to match raw message, getter for localized message].
 * Getters are used (not direct strings) so locale is resolved at call time.
 */
const patterns: [RegExp, () => string][] = [
  // Auth / key errors
  [/missing required active authority/i, () => t.err_missing_active_auth],
  [/missing required posting authority/i, () => t.err_missing_posting_auth],
  [/missing required owner authority/i, () => t.err_missing_owner_auth],
  [/does not match any authority/i, () => t.err_key_mismatch],
  // Resource errors
  [/insufficient Resource Credits/i, () => t.err_insufficient_rc],
  // Account errors
  [/Account.+not found/i, () => t.err_account_not_found],
  // Transaction errors
  [/uniqueness constraint/i, () => t.err_duplicate_tx],
  // Connectivity errors (most specific first)
  [/All RPC endpoints failed/i, () => t.err_all_endpoints_failed],
  [/HTTP [45]\d\d/i, () => t.err_http_error],
  [/Failed to fetch|NetworkError|ERR_/i, () => t.err_network],
  [/AbortError|timed?\s*out/i, () => t.err_timeout],
  // Broad patterns last
  [/expir/i, () => t.err_tx_expired],
];

/**
 * Format an error for user display.
 * Returns HTML: localized message + raw English detail in smaller text.
 */
export function localizeError(raw: string): string {
  const detail = esc(raw);
  for (const [pattern, getMessage] of patterns) {
    if (pattern.test(raw)) {
      return `${esc(getMessage())}<br><span class="xs" style="opacity:0.7;word-break:break-all">${detail}</span>`;
    }
  }
  return `${esc(t.err_unknown)}<br><span class="xs" style="opacity:0.7;word-break:break-all">${detail}</span>`;
}

/** Show a localized error in an element (sets innerHTML, removes hidden). */
export function showError(el: HTMLElement, e: unknown): void {
  el.innerHTML = localizeError(e instanceof Error ? e.message : String(e));
  el.classList.remove('hidden');
}
