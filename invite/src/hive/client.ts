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

  private async send(
    endpoint: string,
    request: JsonRpcRequest,
    externalSignal?: AbortSignal,
  ): Promise<JsonRpcResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    // If an external signal fires (e.g. race winner cancels losers), abort too
    const onExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternal);

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
      externalSignal?.removeEventListener('abort', onExternal);
    }
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    // Race all endpoints in parallel — use whichever responds first.
    // This avoids waiting on a slow/unresponsive node before trying the next.
    const controllers: AbortController[] = [];

    const racePromises = this.endpoints.map((endpoint, i) => {
      const controller = new AbortController();
      controllers.push(controller);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId++,
      };

      return this.send(endpoint, request, controller.signal)
        .then((response) => {
          if (response.error) {
            throw new Error(`RPC error ${response.error.code}: ${response.error.message}`);
          }
          // Remember fastest endpoint for future sequential use
          this.currentIndex = i;
          return { result: response.result as T, index: i };
        });
    });

    try {
      const winner = await Promise.any(racePromises);
      // Abort remaining in-flight requests
      controllers.forEach((c) => c.abort());
      return winner.result;
    } catch (err) {
      // All endpoints failed — AggregateError from Promise.any
      const aggregate = err instanceof AggregateError ? err : undefined;
      const lastMsg = aggregate?.errors?.at(-1)?.message ?? String(err);
      throw new Error(`All RPC endpoints failed. Last error: ${lastMsg}`);
    }
  }

  async getAccounts(accounts: string[]): Promise<HiveAccount[]> {
    return this.call<HiveAccount[]>('condenser_api.get_accounts', [accounts]);
  }
}
