/**
 * Gift card service configuration.
 *
 * Loads and validates environment variables at startup.
 * Exits with a clear error message if required variables are missing.
 *
 * Supports two modes:
 * - **Single-tenant** (default): one provider, service holds their keys directly.
 * - **Multi-tenant**: multiple providers delegate active authority to a shared
 *   service account. Enabled when GIFTCARD_SERVICE_ACCOUNT and
 *   GIFTCARD_SERVICE_ACTIVE_KEY are set.
 */

export interface GiftcardConfig {
  /** Hive account with claimed account tokens (default provider in multi-tenant) */
  providerAccount: string;
  /** Provider's active key (WIF) — used directly in single-tenant mode. Optional in multi-tenant. */
  activeKey?: string;
  /** Provider's memo key (WIF) — used in single-tenant mode for signature verification. Optional in multi-tenant. */
  memoKey?: string;
  /** Feed service account name (e.g. 'haa-service') */
  haaServiceAccount: string;
  /** Default amount of VESTS to delegate (e.g. '30000.000000 VESTS') */
  delegationVests: string;
  /** SQLite database path */
  dbPath: string;
  /** Server port */
  port: number;
  /** Cover site theme */
  coverSiteTheme: string;
  /** Hive API nodes for broadcasting */
  hiveNodes: string[];

  // -- Multi-tenant fields (optional) --

  /** Service account name that providers delegate active authority to */
  serviceAccount?: string;
  /** Service account's own active key (WIF) — signs on behalf of providers */
  serviceActiveKey?: string;
  /** Service account's memo key (WIF) — signs gift cards on behalf of issuers in multi-tenant mode.
   *  Deprecated for new deployments: batch-level signing eliminates this requirement.
   *  Still needed for the legacy single-phase POST /api/batches endpoint. */
  serviceMemoKey?: string;
  /** Approved provider accounts. Claims for unlisted providers are rejected. */
  allowedProviders?: Set<string>;
  /** Pre-approved issuer accounts. Auto-created as 'approved' on first login (skip application). */
  preapprovedIssuers?: Set<string>;

  // -- Admin fields (optional) --

  /** Admin accounts (service account is always admin; these are additional) */
  adminAccounts?: Set<string>;

  // -- Notification fields (optional) --

  /** Account for sending notification memos (separate from service account) */
  notifyAccount?: string;
  /** Active key for the notification account (WIF) */
  notifyActiveKey?: string;
  /** Currency for notification transfers: 'HIVE' or 'HBD' (default: 'HBD') */
  notifyCurrency?: 'HIVE' | 'HBD';

  // -- Dashboard API fields (optional) --

  /** JWT secret for dashboard session tokens. Required for dashboard API endpoints. */
  jwtSecret?: string;

  /** Public URL of this service (e.g. 'https://haa-giftcard-prod.fly.dev'). Used in generated QR payloads. */
  serviceUrl?: string;

  /** Posting key (WIF) for the service/provider account. Required for auto-follow and community subscribe
   *  operations — these use delegated posting authority on the new account. */
  postingKey?: string;

  /** Base URL for the issuer dashboard (e.g. 'http://localhost:5179/dashboard'). Used in approval notification memos. */
  dashboardUrl?: string;

  /** Base URL for invite/restore apps (e.g. 'https://hiveinvite.com'). Used in generated QR/PDF URLs. */
  inviteBaseUrl: string;
}

/**
 * Whether multi-tenant mode is active.
 * True when both service account and its active key are configured.
 */
export function isMultiTenant(config: GiftcardConfig): boolean {
  return !!(config.serviceAccount && config.serviceActiveKey);
}

/**
 * Get the signing key (WIF) for blockchain operations.
 * In multi-tenant mode, uses the service account's key (delegated authority).
 * In single-tenant mode, uses the provider's active key directly.
 */
export function getSigningKey(config: GiftcardConfig): string {
  const key = config.serviceActiveKey || config.activeKey;
  if (!key) throw new Error('No signing key available — set GIFTCARD_SERVICE_ACTIVE_KEY or GIFTCARD_ACTIVE_KEY');
  return key;
}

/**
 * Load configuration from environment variables.
 * Exits the process if required variables are missing.
 */
export function loadConfig(): GiftcardConfig {
  const providerAccount = process.env.GIFTCARD_PROVIDER_ACCOUNT;
  const activeKey = process.env.GIFTCARD_ACTIVE_KEY;
  const memoKey = process.env.GIFTCARD_MEMO_KEY;
  const haaServiceAccount = process.env.HAA_SERVICE_ACCOUNT;
  const delegationVests = process.env.GIFTCARD_DELEGATION_VESTS;

  // Multi-tenant: service account + key
  const serviceAccount = process.env.GIFTCARD_SERVICE_ACCOUNT || undefined;
  const serviceActiveKey = process.env.GIFTCARD_SERVICE_ACTIVE_KEY || undefined;
  const multiTenant = !!(serviceAccount && serviceActiveKey);

  const missing: string[] = [];
  if (!providerAccount) missing.push('GIFTCARD_PROVIDER_ACCOUNT');
  // In multi-tenant mode, provider's own active/memo keys are not needed —
  // the service account holds delegated authority and memo key resolution
  // happens on-chain per provider.
  if (!multiTenant) {
    if (!activeKey) missing.push('GIFTCARD_ACTIVE_KEY');
    if (!memoKey) missing.push('GIFTCARD_MEMO_KEY');
  }
  if (!haaServiceAccount) missing.push('HAA_SERVICE_ACCOUNT');
  if (!delegationVests) missing.push('GIFTCARD_DELEGATION_VESTS');

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }

  // Validate: both must be set, or neither
  if ((serviceAccount && !serviceActiveKey) || (!serviceAccount && serviceActiveKey)) {
    console.error('Multi-tenant mode requires both GIFTCARD_SERVICE_ACCOUNT and GIFTCARD_SERVICE_ACTIVE_KEY');
    process.exit(1);
  }

  const nodesRaw = process.env.HIVE_NODES;
  const hiveNodes = nodesRaw
    ? nodesRaw.split(',').map(s => s.trim())
    : ['https://api.hive.blog', 'https://api.deathwing.me', 'https://hive-api.arcange.eu'];

  let allowedProviders: Set<string> | undefined;
  const allowedRaw = process.env.GIFTCARD_ALLOWED_PROVIDERS;
  if (allowedRaw) {
    allowedProviders = new Set(allowedRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  }

  // In multi-tenant mode, memo key is resolved per-provider from chain,
  // but we still require GIFTCARD_MEMO_KEY for the default provider (backward compat)

  let preapprovedIssuers: Set<string> | undefined;
  const preapprovedRaw = process.env.GIFTCARD_PREAPPROVED_ISSUERS;
  if (preapprovedRaw) {
    preapprovedIssuers = new Set(preapprovedRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  }

  let adminAccounts: Set<string> | undefined;
  const adminRaw = process.env.GIFTCARD_ADMIN_ACCOUNTS;
  if (adminRaw) {
    adminAccounts = new Set(adminRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  }

  const notifyAccount = process.env.GIFTCARD_NOTIFY_ACCOUNT || undefined;
  const notifyActiveKey = process.env.GIFTCARD_NOTIFY_ACTIVE_KEY || undefined;
  const notifyCurrencyRaw = (process.env.GIFTCARD_NOTIFY_CURRENCY || '').toUpperCase();
  const notifyCurrency: 'HIVE' | 'HBD' = notifyCurrencyRaw === 'HIVE' ? 'HIVE' : 'HBD';

  const serviceMemoKey = process.env.GIFTCARD_SERVICE_MEMO_KEY || undefined;
  const jwtSecret = process.env.GIFTCARD_JWT_SECRET || undefined;
  const serviceUrl = process.env.GIFTCARD_SERVICE_URL || undefined;
  const dashboardUrl = process.env.GIFTCARD_DASHBOARD_URL || undefined;
  const inviteBaseUrl = (process.env.GIFTCARD_INVITE_BASE_URL || 'https://hiveinvite.com').replace(/\/+$/, '');
  const postingKey = process.env.GIFTCARD_POSTING_KEY || undefined;

  return {
    providerAccount: providerAccount!,
    activeKey: activeKey || undefined,
    memoKey: memoKey || undefined,
    haaServiceAccount: haaServiceAccount!,
    delegationVests: delegationVests!,
    dbPath: process.env.GIFTCARD_DB_PATH || './data/tokens.db',
    port: parseInt(process.env.PORT || '3200', 10),
    coverSiteTheme: process.env.COVER_SITE_THEME || 'tech',
    hiveNodes,
    serviceAccount,
    serviceActiveKey,
    serviceMemoKey,
    allowedProviders,
    preapprovedIssuers,
    adminAccounts,
    notifyAccount,
    notifyActiveKey,
    notifyCurrency,
    jwtSecret,
    serviceUrl,
    dashboardUrl,
    inviteBaseUrl,
    postingKey,
  };
}

/**
 * Check if a username has admin access.
 * Admin = service account (in multi-tenant) or provider account (single-tenant) or in adminAccounts.
 */
export function isAdmin(config: GiftcardConfig, username: string): boolean {
  const u = username.toLowerCase();
  if (config.serviceAccount && u === config.serviceAccount.toLowerCase()) return true;
  if (!config.serviceAccount && u === config.providerAccount.toLowerCase()) return true;
  if (config.adminAccounts?.has(u)) return true;
  return false;
}

/**
 * Check if a username is on the pre-approved issuers list.
 */
export function isPreapproved(config: GiftcardConfig, username: string): boolean {
  return config.preapprovedIssuers?.has(username.toLowerCase()) ?? false;
}
