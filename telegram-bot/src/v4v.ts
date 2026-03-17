/**
 * v4v.app API client.
 *
 * Generates Lightning invoices that convert BTC payments to HBD
 * transfers on the Hive blockchain.
 */

const V4V_API_BASE = 'https://api.v4v.app';
const REQUEST_TIMEOUT_MS = 15_000;

export interface V4vInvoice {
  /** BOLT11 payment request string (the Lightning invoice) */
  paymentRequest: string;
  /** Base64-encoded payment hash (used to check status) */
  paymentHash: string;
  /** Invoice expiry time (ISO string) */
  expiresAt: string;
  /** Amount in satoshis */
  amountSats: number;
}

export interface V4vInvoiceStatus {
  settled: boolean;
  paid: boolean;
  expired: boolean;
  state: 'OPEN' | 'SETTLED' | 'CANCELLED' | 'ACCEPTED';
}

/**
 * Generate a Lightning invoice via v4v.app that, when paid, sends HBD
 * to the specified Hive account with the given memo.
 */
export async function createV4vInvoice(opts: {
  hiveAccount: string;
  amountHbd: string;
  memo: string;
  expirySeconds?: number;
}): Promise<V4vInvoice> {
  const params = new URLSearchParams({
    hive_accname: opts.hiveAccount,
    amount: opts.amountHbd,
    currency: 'HBD',
    receive_currency: 'hbd',
    message: opts.memo,
    expiry: String(opts.expirySeconds ?? 1800),
    app_name: 'propolis',
  });

  const url = `${V4V_API_BASE}/v1/new_invoice_hive?${params}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`v4v.app invoice creation failed (${resp.status}): ${text}`);
  }

  const data = await resp.json() as {
    payment_request?: string;
    payment_hash?: string;
    r_hash?: string;
    expires_at?: string;
    amount?: number;
  };

  if (!data.payment_request) {
    throw new Error('v4v.app returned no payment_request');
  }

  return {
    paymentRequest: data.payment_request,
    paymentHash: data.payment_hash || data.r_hash || '',
    expiresAt: data.expires_at || '',
    amountSats: data.amount || 0,
  };
}

/**
 * Check the payment status of a Lightning invoice.
 */
export async function checkV4vInvoice(paymentHash: string): Promise<V4vInvoiceStatus> {
  const url = `${V4V_API_BASE}/v1/check_invoice/${encodeURIComponent(paymentHash)}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`v4v.app check_invoice failed (${resp.status})`);
  }

  return await resp.json() as V4vInvoiceStatus;
}
