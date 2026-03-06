/**
 * Build-time phase constant.
 * Phase 1: Propolis Wallet (self-contained, no obfuscation/proxy/discovery UI)
 * Phase 2: Restricted Access (obfuscation, proxy, endpoint discovery)
 *
 * Set via Vite `define` — defaults to 1.
 */
declare const __PHASE__: number;

export const PHASE: number = typeof __PHASE__ !== 'undefined' ? __PHASE__ : 1;

export function isPhase2(): boolean {
  return PHASE >= 2;
}
