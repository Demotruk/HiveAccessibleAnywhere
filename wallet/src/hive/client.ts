/**
 * Hive RPC client with configurable endpoints and failover.
 *
 * Designed with a transport abstraction so obfuscated transports
 * can be swapped in later (Phase 3).
 */

import { config as hiveTxConfig } from 'hive-tx';

/** A JSON-RPC 2.0 request */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown[];
  id: number;
}

/** A JSON-RPC 2.0 response */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  id: number;
}

/**
 * Transport interface — abstracts the HTTP layer so we can swap in
 * an obfuscated transport later.
 */
export interface Transport {
  send(endpoint: string, request: JsonRpcRequest): Promise<JsonRpcResponse>;
}

/** Default transport: plain HTTPS fetch */
export class DirectTransport implements Transport {
  private timeout: number;

  constructor(timeoutMs = 10_000) {
    this.timeout = timeoutMs;
  }

  async send(endpoint: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as JsonRpcResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Hive RPC Client.
 * Manages a list of endpoints with automatic failover.
 */
export class HiveClient {
  private endpoints: string[];
  private currentIndex = 0;
  private transport: Transport;
  private requestId = 1;

  constructor(endpoints?: string[], transport?: Transport) {
    this.endpoints = endpoints ?? [
      'https://api.hive.blog',
      'https://api.deathwing.me',
      'https://hive-api.arcange.eu',
    ];
    this.transport = transport ?? new DirectTransport();

    // Also configure hive-tx's internal node for any direct hive-tx calls
    hiveTxConfig.node = this.endpoints[0];
  }

  /** Get the currently active endpoint */
  get currentEndpoint(): string {
    return this.endpoints[this.currentIndex];
  }

  /** Set the endpoint list (e.g. from discovered endpoints) */
  setEndpoints(endpoints: string[]): void {
    if (endpoints.length === 0) throw new Error('At least one endpoint required');
    this.endpoints = endpoints;
    this.currentIndex = 0;
    hiveTxConfig.node = endpoints[0];
  }

  /** Set the transport (e.g. swap in obfuscated transport) */
  setTransport(transport: Transport): void {
    this.transport = transport;
  }

  /** Make a JSON-RPC call with automatic failover */
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const maxAttempts = this.endpoints.length;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const endpoint = this.endpoints[(this.currentIndex + attempt) % this.endpoints.length];
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId++,
      };

      try {
        const response = await this.transport.send(endpoint, request);

        if (response.error) {
          throw new Error(`RPC error ${response.error.code}: ${response.error.message}`);
        }

        // Success — update current index to this working endpoint
        this.currentIndex = (this.currentIndex + attempt) % this.endpoints.length;
        hiveTxConfig.node = this.endpoints[this.currentIndex];
        return response.result as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`RPC call to ${endpoint} failed: ${lastError.message}`);
      }
    }

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  /** Health check: try to get dynamic global properties */
  async healthCheck(): Promise<boolean> {
    try {
      await this.call('condenser_api.get_dynamic_global_properties');
      return true;
    } catch {
      return false;
    }
  }

  /** Get account information */
  async getAccounts(accounts: string[]): Promise<HiveAccount[]> {
    return this.call<HiveAccount[]>('condenser_api.get_accounts', [accounts]);
  }

  /** Get dynamic global properties (needed for transaction signing) */
  async getDynamicGlobalProperties(): Promise<DynamicGlobalProperties> {
    return this.call<DynamicGlobalProperties>('condenser_api.get_dynamic_global_properties');
  }

  /** Broadcast a signed transaction */
  async broadcastTransaction(trx: SignedTransaction): Promise<BroadcastResult> {
    return this.call<BroadcastResult>('condenser_api.broadcast_transaction_synchronous', [trx]);
  }

  /** Get account history */
  async getAccountHistory(
    account: string,
    start: number = -1,
    limit: number = 100,
  ): Promise<AccountHistoryEntry[]> {
    return this.call<AccountHistoryEntry[]>('condenser_api.get_account_history', [
      account,
      start,
      limit,
    ]);
  }
}

// ---- Hive type definitions ----

export interface HiveAccount {
  name: string;
  balance: string;
  hbd_balance: string;
  savings_balance: string;
  savings_hbd_balance: string;
  savings_withdraw_requests: number;
  memo_key: string;
  active: { key_auths: [string, number][] };
  posting: { key_auths: [string, number][] };
  owner: { key_auths: [string, number][] };
  [key: string]: unknown;
}

export interface DynamicGlobalProperties {
  head_block_number: number;
  head_block_id: string;
  time: string;
  [key: string]: unknown;
}

export interface SignedTransaction {
  ref_block_num: number;
  ref_block_prefix: number;
  expiration: string;
  operations: [string, Record<string, unknown>][];
  extensions: unknown[];
  signatures: string[];
}

export interface BroadcastResult {
  id: string;
  block_num: number;
  trx_num: number;
  expired: boolean;
}

export type AccountHistoryEntry = [number, { op: [string, Record<string, unknown>]; [key: string]: unknown }];

// Singleton client instance
let clientInstance: HiveClient | undefined;

export function getClient(): HiveClient {
  if (!clientInstance) {
    clientInstance = new HiveClient();
  }
  return clientInstance;
}

export function setClient(client: HiveClient): void {
  clientInstance = client;
}
