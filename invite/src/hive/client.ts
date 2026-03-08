/**
 * Lightweight Hive RPC client for the invite app.
 * Stripped from wallet/src/hive/client.ts — only getAccounts + failover.
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown[];
  id: number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  id: number;
}

export interface HiveAccount {
  name: string;
  memo_key: string;
  [key: string]: unknown;
}

export class HiveClient {
  private endpoints: string[];
  private currentIndex = 0;
  private requestId = 1;
  private timeout: number;

  constructor(endpoints: string[], timeoutMs = 10_000) {
    this.endpoints = endpoints;
    this.timeout = timeoutMs;
  }

  private async send(endpoint: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
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
        const response = await this.send(endpoint, request);
        if (response.error) {
          throw new Error(`RPC error ${response.error.code}: ${response.error.message}`);
        }
        this.currentIndex = (this.currentIndex + attempt) % this.endpoints.length;
        return response.result as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  async getAccounts(accounts: string[]): Promise<HiveAccount[]> {
    return this.call<HiveAccount[]>('condenser_api.get_accounts', [accounts]);
  }
}
