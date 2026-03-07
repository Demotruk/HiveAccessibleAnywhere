/**
 * Gift card service configuration.
 *
 * Loads and validates environment variables at startup.
 * Exits with a clear error message if required variables are missing.
 */

export interface GiftcardConfig {
  /** Hive account with claimed account tokens */
  providerAccount: string;
  /** Provider's active key (WIF) for create_claimed_account + delegate */
  activeKey: string;
  /** Provider's memo key (WIF) for signing card authenticity */
  memoKey: string;
  /** Feed service account name (e.g. 'haa-service') */
  haaServiceAccount: string;
  /** Amount of VESTS to delegate (e.g. '30000.000000 VESTS') */
  delegationVests: string;
  /** SQLite database path */
  dbPath: string;
  /** Server port */
  port: number;
  /** Cover site theme */
  coverSiteTheme: string;
  /** Hive API nodes for broadcasting */
  hiveNodes: string[];
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

  const missing: string[] = [];
  if (!providerAccount) missing.push('GIFTCARD_PROVIDER_ACCOUNT');
  if (!activeKey) missing.push('GIFTCARD_ACTIVE_KEY');
  if (!memoKey) missing.push('GIFTCARD_MEMO_KEY');
  if (!haaServiceAccount) missing.push('HAA_SERVICE_ACCOUNT');
  if (!delegationVests) missing.push('GIFTCARD_DELEGATION_VESTS');

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }

  const nodesRaw = process.env.HIVE_NODES;
  const hiveNodes = nodesRaw
    ? nodesRaw.split(',').map(s => s.trim())
    : ['https://api.hive.blog', 'https://api.deathwing.me', 'https://hive-api.arcange.eu'];

  return {
    providerAccount: providerAccount!,
    activeKey: activeKey!,
    memoKey: memoKey!,
    haaServiceAccount: haaServiceAccount!,
    delegationVests: delegationVests!,
    dbPath: process.env.GIFTCARD_DB_PATH || './data/tokens.db',
    port: parseInt(process.env.PORT || '3200', 10),
    coverSiteTheme: process.env.COVER_SITE_THEME || 'tech',
    hiveNodes,
  };
}
