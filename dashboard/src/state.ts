import type { Batch, IssuerRecord, UserRole } from './types.js';

export interface DashboardState {
  jwt: string | null;
  username: string | null;
  role: UserRole | null;
  issuerStatus: IssuerRecord | null;
  batches: Batch[];
  loading: boolean;
  /** JWT for the issuer's external gift card service (self-hosted mode). */
  externalJwt: string | null;
  /** External service URL from the issuer's profile. */
  externalServiceUrl: string | null;
  /** Whether the external service auth succeeded. */
  externalConnected: boolean;
  /** Error message if external service is unreachable. */
  externalError: string | null;
  /** Number of pending issuer applications (admin only). */
  pendingCount: number;
  /** Whether the user was auto-approved from the pre-approved list (shown once on first login). */
  preApproved: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

// ---------------------------------------------------------------------------
// Session persistence via sessionStorage
// ---------------------------------------------------------------------------

const SESSION_KEY = 'propolis_dashboard_session';

/** Fields persisted across page refreshes. */
interface PersistedSession {
  jwt: string;
  username: string;
  role: UserRole | null;
  issuerStatus: IssuerRecord | null;
  externalJwt: string | null;
  externalServiceUrl: string | null;
  externalConnected: boolean;
}

const hasSessionStorage = typeof sessionStorage !== 'undefined';

function saveSession(): void {
  if (!hasSessionStorage) return;
  if (!state.jwt || !state.username) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  const data: PersistedSession = {
    jwt: state.jwt,
    username: state.username,
    role: state.role,
    issuerStatus: state.issuerStatus,
    externalJwt: state.externalJwt,
    externalServiceUrl: state.externalServiceUrl,
    externalConnected: state.externalConnected,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession(): Partial<DashboardState> {
  if (!hasSessionStorage) return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const data: PersistedSession = JSON.parse(raw);
    if (!data.jwt || !data.username) return {};
    return {
      jwt: data.jwt,
      username: data.username,
      role: data.role ?? null,
      issuerStatus: data.issuerStatus ?? null,
      externalJwt: data.externalJwt ?? null,
      externalServiceUrl: data.externalServiceUrl ?? null,
      externalConnected: data.externalConnected ?? false,
    };
  } catch {
    return {};
  }
}

function clearSession(): void {
  if (!hasSessionStorage) return;
  sessionStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------

const restored = loadSession();

export const state: DashboardState = {
  jwt: null,
  username: null,
  role: null,
  issuerStatus: null,
  batches: [],
  loading: false,
  externalJwt: null,
  externalServiceUrl: null,
  externalConnected: false,
  externalError: null,
  pendingCount: 0,
  preApproved: false,
  ...restored,
};

export function setState(partial: Partial<DashboardState>): void {
  Object.assign(state, partial);
  saveSession();
  for (const fn of listeners) fn();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState(): void {
  clearSession();
  Object.assign(state, {
    jwt: null, username: null, role: null, issuerStatus: null, batches: [], loading: false,
    externalJwt: null, externalServiceUrl: null, externalConnected: false, externalError: null, pendingCount: 0, preApproved: false,
  });
  for (const fn of listeners) fn();
}
