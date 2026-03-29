import { state, setState } from './state.js';
import type { Batch, BatchCreateRequest, BatchCreateResponse, BatchDetail } from './types.js';

declare const __API_BASE__: string;
const API_BASE = __API_BASE__;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (state.jwt) {
    headers.set('Authorization', `Bearer ${state.jwt}`);
  }
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
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

export async function createBatch(options: BatchCreateRequest): Promise<BatchCreateResponse> {
  const res = await apiFetch('/api/batches', {
    method: 'POST',
    body: JSON.stringify(options),
  });
  return res.json();
}

export async function listBatches(): Promise<Batch[]> {
  const res = await apiFetch('/api/batches');
  const data = await res.json();
  return data.batches;
}

export async function getBatchDetail(id: string): Promise<BatchDetail> {
  const res = await apiFetch(`/api/batches/${encodeURIComponent(id)}`);
  return res.json();
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await apiFetch(path);
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

export { ApiError };
