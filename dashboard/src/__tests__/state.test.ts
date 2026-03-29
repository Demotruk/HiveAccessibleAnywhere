import { describe, it, expect, beforeEach } from 'vitest';
import { state, setState, subscribe, resetState } from '../state.js';

describe('state', () => {
  beforeEach(() => {
    resetState();
  });

  it('starts with null jwt and username', () => {
    expect(state.jwt).toBeNull();
    expect(state.username).toBeNull();
    expect(state.batches).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('setState merges partial updates', () => {
    setState({ jwt: 'test-token', username: 'alice' });
    expect(state.jwt).toBe('test-token');
    expect(state.username).toBe('alice');
    expect(state.batches).toEqual([]);
  });

  it('subscribe is called on setState', () => {
    let callCount = 0;
    const unsub = subscribe(() => { callCount++; });

    setState({ loading: true });
    expect(callCount).toBe(1);

    setState({ loading: false });
    expect(callCount).toBe(2);

    unsub();
    setState({ loading: true });
    expect(callCount).toBe(2);
  });

  it('resetState clears all state', () => {
    setState({ jwt: 'token', username: 'bob', loading: true });
    resetState();
    expect(state.jwt).toBeNull();
    expect(state.username).toBeNull();
    expect(state.loading).toBe(false);
  });
});
