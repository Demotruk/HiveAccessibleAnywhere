import { state, setState } from './state.js';
import type {
  Batch, BatchCreateRequest, BatchCreateResponse, PrepareResponse, BatchDetail,
  IssuerRecord, IssuerWithStats, SetupStatus, UserRole,
} from './types.js';

declare const __API_BASE__: string;
const API_BASE = __API_BASE__;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------

type ApiTarget = 'operator' | 'external';

/**
 * Resolve the base URL and JWT for the given target.
 * 'operator' always uses the build-time API_BASE and the operator JWT.
 * 'external' uses the issuer's external service URL and external JWT.
 */
function resolveTarget(target: ApiTarget): { baseUrl: string; jwt: string | null } {
  if (target === 'external' && state.externalServiceUrl) {
    return { baseUrl: state.externalServiceUrl.replace(/\/$/, ''), jwt: state.externalJwt };
  }
  return { baseUrl: API_BASE, jwt: state.jwt };
}

/**
 * Determine the correct target for batch operations.
 * Uses external service if configured and connected, otherwise operator.
 */
function batchTarget(): ApiTarget {
  return (state.externalServiceUrl && state.externalConnected) ? 'external' : 'operator';
}

async function apiFetch(path: string, options: RequestInit = {}, target: ApiTarget = 'operator'): Promise<Response> {
  const { baseUrl, jwt } = resolveTarget(target);
  const headers = new Headers(options.headers);
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (target === 'external') {
      // External session expired — degrade gracefully, don't redirect
      setState({ externalJwt: null, externalConnected: false, externalError: 'External service session expired' });
      throw new ApiError(401, 'External service session expired');
    }
    setState({ jwt: null, username: null, batches: [] });
    window.location.hash = '#login';
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Auth — operator service
// ---------------------------------------------------------------------------

export async function requestChallenge(username: string): Promise<string> {
  const res = await apiFetch('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  return data.challenge;
}

export async function verifyChallenge(
  username: string,
  challenge: string,
  signature: string,
): Promise<string> {
  const res = await apiFetch('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ username, challenge, signature }),
  });
  const data = await res.json();
  return data.token;
}

// ---------------------------------------------------------------------------
// Auth — external service (raw fetch, no apiFetch — different base URL)
// ---------------------------------------------------------------------------

export async function requestChallengeExternal(username: string, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error('External service challenge request failed');
  const data = await res.json();
  return data.challenge;
}

export async function verifyChallengeExternal(
  username: string,
  challenge: string,
  signature: string,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, challenge, signature }),
  });
  if (!res.ok) throw new Error('External service verification failed');
  const data = await res.json();
  return data.token;
}

/**
 * Health check against an external service URL. Returns true if healthy.
 */
export async function healthCheckExternal(serviceUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${serviceUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Batch operations — routed to external service when configured
// ---------------------------------------------------------------------------

export async function createBatch(options: BatchCreateRequest): Promise<BatchCreateResponse> {
  const res = await apiFetch('/api/batches', {
    method: 'POST',
    body: JSON.stringify(options),
  }, batchTarget());
  return res.json();
}

export async function prepareBatchApi(options: BatchCreateRequest): Promise<PrepareResponse> {
  const res = await apiFetch('/api/batches/prepare', {
    method: 'POST',
    body: JSON.stringify(options),
  }, batchTarget());
  return res.json();
}

export async function finalizeBatchApi(batchId: string, signature: string): Promise<BatchCreateResponse> {
  const res = await apiFetch(`/api/batches/${encodeURIComponent(batchId)}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ signature }),
  }, batchTarget());
  return res.json();
}

export async function listBatches(): Promise<Batch[]> {
  const res = await apiFetch('/api/batches', {}, batchTarget());
  const data = await res.json();
  return data.batches;
}

export async function getBatchDetail(id: string): Promise<BatchDetail> {
  const res = await apiFetch(`/api/batches/${encodeURIComponent(id)}`, {}, batchTarget());
  return res.json();
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await apiFetch(path, {}, batchTarget());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Issuer API — always operator service
// ---------------------------------------------------------------------------

export async function submitApplication(
  description: string,
  contact?: string,
  txId?: string,
): Promise<IssuerRecord> {
  const res = await apiFetch('/api/issuers/apply', {
    method: 'POST',
    body: JSON.stringify({ description, contact, txId }),
  });
  const data = await res.json();
  return data.issuer;
}

export async function getMyIssuerStatus(): Promise<{
  issuer: IssuerRecord | null;
  role: UserRole;
  setupStatus: SetupStatus | null;
}> {
  const res = await apiFetch('/api/issuers/me');
  return res.json();
}

export async function setServiceUrl(serviceUrl: string | null): Promise<IssuerRecord> {
  const res = await apiFetch('/api/issuers/me/service-url', {
    method: 'POST',
    body: JSON.stringify({ serviceUrl }),
  });
  const data = await res.json();
  return data.issuer;
}

// ---------------------------------------------------------------------------
// Admin API — always operator service
// ---------------------------------------------------------------------------

export async function listIssuers(status?: string): Promise<IssuerWithStats[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiFetch(`/api/admin/issuers${qs}`);
  const data = await res.json();
  return data.issuers;
}

export async function approveIssuer(username: string, txId?: string): Promise<IssuerRecord> {
  const res = await apiFetch(`/api/admin/issuers/${encodeURIComponent(username)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ txId }),
  });
  const data = await res.json();
  return data.issuer;
}

// ---------------------------------------------------------------------------
// Hive chain queries (public, no auth needed)
// ---------------------------------------------------------------------------

const HIVE_NODES = ['https://api.hive.blog', 'https://api.deathwing.me'];

export interface HiveAuthority {
  weight_threshold: number;
  account_auths: [string, number][];
  key_auths: [string, number][];
}

export interface HiveAccount {
  name: string;
  active: HiveAuthority;
  posting: HiveAuthority;
  owner: HiveAuthority;
  memo_key: string;
  json_metadata: string;
  posting_json_metadata: string;
}

/**
 * Fetch a Hive account's data from public API nodes.
 */
export async function fetchHiveAccount(username: string): Promise<HiveAccount> {
  let lastError: Error | null = null;
  for (const node of HIVE_NODES) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[username]],
          id: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (!data.result?.[0]) throw new Error(`Account @${username} not found`);
      return data.result[0];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('All Hive nodes failed');
}

export { ApiError };
