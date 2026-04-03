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
}

type Listener = () => void;

const listeners = new Set<Listener>();

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
};

export function setState(partial: Partial<DashboardState>): void {
  Object.assign(state, partial);
  for (const fn of listeners) fn();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState(): void {
  setState({
    jwt: null, username: null, role: null, issuerStatus: null, batches: [], loading: false,
    externalJwt: null, externalServiceUrl: null, externalConnected: false, externalError: null,
  });
}
