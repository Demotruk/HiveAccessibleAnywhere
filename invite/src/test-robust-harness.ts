/**
 * Dev-only test harness for the robust success screen.
 *
 * Injects mock state and renders the SuccessRobustScreen directly,
 * bypassing the full invite flow. The wallet chunk fetching uses
 * real on-chain data (public Hive API nodes) so Phase 3 exercises
 * the actual wallet-loader code.
 *
 * Access via: http://localhost:5178/test-robust.html
 */

import './ui/styles.css';
import { t } from './ui/locale';
import { SuccessRobustScreen } from './ui/screens/success-robust';
import type { InviteState } from './types';

document.documentElement.lang = t.html_lang;
document.documentElement.dir = t.html_dir;
document.title = 'Test: Robust Success Screen';

// Mock state — simulates what would exist after a successful claim
const mockState: InviteState = {
  encryptedBlob: 'test-blob',
  pin: 'ABC123',
  payload: {
    token: 'deadbeef'.repeat(8),
    provider: 'propolis-publish',
    serviceUrl: 'https://example.com',
    endpoints: [
      // Use public nodes for testing (robust invites would use proxy endpoints)
      'https://api.hive.blog',
      'https://api.openhive.network',
    ],
    batchId: 'batch-test-001',
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    signature: 'test-signature',
    promiseType: 'account-creation',
    variant: 'robust',
    locale: 'en',
  },
  masterPassword: 'P5' + 'A'.repeat(48),
  username: 'testuser-robust',
  keys: {
    owner: { wif: '5JtestOwnerKeyWIF000000000000000000000000000000000', pub: 'STM7test' },
    active: { wif: '5JtestActiveKeyWIF00000000000000000000000000000000', pub: 'STM7test' },
    posting: { wif: '5JtestPostingKeyWIF0000000000000000000000000000000', pub: 'STM7test' },
    memo: { wif: '5JtestMemoKeyWIF0000000000000000000000000000000000', pub: 'STM7test' },
  },
  claimResult: {
    account: 'testuser-robust',
    tx_id: 'abc123def456789012345678901234567890abcd',
  },
  bootstrapSaved: false,
};

const appEl = document.getElementById('app');
if (appEl) {
  console.log('[test-harness] Rendering robust success screen with mock state');
  console.log('[test-harness] Locale: en, using public Hive API nodes');
  console.log('[test-harness] Phase 1: Confirmation (2.5s) → Phase 2: Bootstrap save → Phase 3: Wallet loading');

  // Render the robust success screen directly
  SuccessRobustScreen(appEl, mockState, (next) => {
    console.log('[test-harness] Screen advance requested:', next);
  });
}
