/**
 * RPC Endpoint Manager.
 *
 * Manages endpoint priority: discovered (from encrypted memos) >
 * manually configured > public fallback.
 *
 * Integrates with the HiveClient singleton to update active endpoints
 * and runs periodic health checks + re-discovery.
 */

import { getClient } from '../hive/client';
import { getLatestEndpoints, type EndpointPayload } from './endpoint-feed';

/** Endpoint source categories, in priority order */
export type EndpointSource = 'discovered' | 'manual' | 'fallback';

export interface ManagedEndpoint {
  url: string;
  source: EndpointSource;
  healthy: boolean;
  lastCheck: number;
}

/** Public fallback endpoints (used when nothing else is available) */
const PUBLIC_FALLBACKS = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

export class RpcManager {
  private endpoints: ManagedEndpoint[] = [];
  private discoveryInterval: ReturnType<typeof setInterval> | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private serviceAccounts: string[];

  /** Last discovered payload (for UI display) */
  lastPayload: EndpointPayload | null = null;
  /** Timestamp of last successful discovery */
  lastDiscoveryTime: number = 0;
  /** Whether discovery has been attempted */
  discoveryAttempted = false;

  constructor(serviceAccounts: string[] = ['haa-service']) {
    this.serviceAccounts = serviceAccounts;
    // Start with public fallbacks
    this.addFallbacks();
  }

  /** Get all endpoints sorted by priority (discovered > manual > fallback) */
  get allEndpoints(): ManagedEndpoint[] {
    return [...this.endpoints];
  }

  /** Get healthy endpoints sorted by priority */
  get healthyEndpoints(): string[] {
    const priority: Record<EndpointSource, number> = {
      discovered: 0,
      manual: 1,
      fallback: 2,
    };
    return this.endpoints
      .filter(e => e.healthy)
      .sort((a, b) => priority[a.source] - priority[b.source])
      .map(e => e.url);
  }

  /** Add manually configured endpoint */
  addManualEndpoint(url: string): void {
    if (this.endpoints.some(e => e.url === url)) return;
    this.endpoints.push({
      url,
      source: 'manual',
      healthy: true, // assume healthy until checked
      lastCheck: 0,
    });
    this.applyToClient();
  }

  /** Remove a manually configured endpoint */
  removeManualEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter(
      e => !(e.url === url && e.source === 'manual')
    );
    this.applyToClient();
  }

  /**
   * Run endpoint discovery from encrypted memos.
   * Updates the endpoint list with any discovered proxy endpoints.
   */
  async discover(account: string, memoKeyWif: string): Promise<boolean> {
    this.discoveryAttempted = true;
    try {
      const payload = await getLatestEndpoints(
        account,
        memoKeyWif,
        this.serviceAccounts,
      );

      if (payload) {
        this.lastPayload = payload;
        this.lastDiscoveryTime = Date.now();

        // Remove old discovered endpoints
        this.endpoints = this.endpoints.filter(e => e.source !== 'discovered');

        // Add new discovered endpoints
        for (const url of payload.endpoints) {
          this.endpoints.push({
            url,
            source: 'discovered',
            healthy: true, // assume healthy until checked
            lastCheck: 0,
          });
        }

        this.applyToClient();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Endpoint discovery failed:', e);
      return false;
    }
  }

  /**
   * Run health checks on all endpoints.
   * Tests each endpoint with a lightweight RPC call.
   */
  async healthCheckAll(): Promise<void> {
    const checks = this.endpoints.map(async (ep) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8_000);
        const response = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_dynamic_global_properties',
            params: [],
            id: 1,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        ep.healthy = response.ok;
      } catch {
        ep.healthy = false;
      }
      ep.lastCheck = Date.now();
    });

    await Promise.allSettled(checks);
    this.applyToClient();
  }

  /**
   * Start periodic discovery and health checks.
   *
   * @param account - Hive account name
   * @param memoKeyWif - Private memo key for decrypting endpoint memos
   * @param discoveryIntervalMs - How often to re-discover (default: 30 min)
   * @param healthIntervalMs - How often to health-check (default: 5 min)
   */
  startPeriodicChecks(
    account: string,
    memoKeyWif: string,
    discoveryIntervalMs = 30 * 60_000,
    healthIntervalMs = 5 * 60_000,
  ): void {
    this.stopPeriodicChecks();

    // Immediate discovery
    this.discover(account, memoKeyWif);

    // Periodic discovery
    this.discoveryInterval = setInterval(
      () => this.discover(account, memoKeyWif),
      discoveryIntervalMs,
    );

    // Periodic health checks (start after a delay to avoid hammering on startup)
    setTimeout(() => {
      this.healthCheckAll();
      this.healthInterval = setInterval(
        () => this.healthCheckAll(),
        healthIntervalMs,
      );
    }, 15_000);
  }

  /** Stop all periodic checks */
  stopPeriodicChecks(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /** Apply the current endpoint list to the HiveClient singleton */
  private applyToClient(): void {
    const healthy = this.healthyEndpoints;
    if (healthy.length > 0) {
      try {
        getClient().setEndpoints(healthy);
      } catch {
        // If all unhealthy, keep current client endpoints
      }
    }
  }

  /** Add public fallback endpoints if not already present */
  private addFallbacks(): void {
    for (const url of PUBLIC_FALLBACKS) {
      if (!this.endpoints.some(e => e.url === url)) {
        this.endpoints.push({
          url,
          source: 'fallback',
          healthy: true,
          lastCheck: 0,
        });
      }
    }
  }
}

// Singleton instance
let managerInstance: RpcManager | undefined;

export function getRpcManager(): RpcManager {
  if (!managerInstance) {
    managerInstance = new RpcManager();
  }
  return managerInstance;
}
