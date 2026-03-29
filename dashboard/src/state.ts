import type { Batch } from './types.js';

export interface DashboardState {
  jwt: string | null;
  username: string | null;
  batches: Batch[];
  loading: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

export const state: DashboardState = {
  jwt: null,
  username: null,
  batches: [],
  loading: false,
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
  setState({ jwt: null, username: null, batches: [], loading: false });
}
