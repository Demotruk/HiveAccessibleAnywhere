/**
 * Setup page — guides approved issuers through active authority delegation.
 *
 * Steps: Apply → Approved → Delegate Authority → Ready
 */

import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { state, setState } from '../state.js';
import { isKeychainAvailable, broadcastOperation } from '../auth.js';
import { getMyIssuerStatus } from '../api.js';
import type { SetupStatus } from '../types.js';

export function Setup() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [delegating, setDelegating] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function fetchStatus() {
    try {
      const data = await getMyIssuerStatus();
      if (data.issuer) {
        setState({ issuerStatus: data.issuer, role: data.role });
      }
      setSetupStatus(data.setupStatus);

      // Auto-redirect if now active
      if (data.issuer?.status === 'active') {
        window.location.hash = '#batches';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleDelegate() {
    setError('');
    setDelegating(true);

    try {
      if (!isKeychainAvailable()) {
        throw new Error('Hive Keychain extension is required.');
      }

      // We need to add the service account's active key to the issuer's active authority.
      // Keychain's requestBroadcast with account_update handles this.
      // We broadcast an update_account that adds the service key.
      // The actual authority merge is done by Keychain — we request the broadcast
      // and Keychain prompts the user to approve.

      // Note: For security, Keychain will show the user exactly what's being changed.
      // We use requestBroadcast with the account_update2 operation which allows
      // partial authority updates.
      //
      // However, Hive doesn't have partial update — we need to fetch current authority
      // and merge. The /api/issuers/me endpoint returns setup status but not the full
      // authority object. For now, we'll instruct users to use Peakd/Keychain wallet
      // directly for this step, and poll for verification.

      // TODO: In a future iteration, fetch current authority from chain client-side,
      // merge the service key, and broadcast the full update_account operation.
      // For now, show instructions and poll.

      throw new Error('SHOW_INSTRUCTIONS');
    } catch (err) {
      if (err instanceof Error && err.message === 'SHOW_INSTRUCTIONS') {
        // Fall through to show manual instructions
        setDelegating(false);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDelegating(false);
    }
  }

  async function handleCheckDelegation() {
    setChecking(true);
    setError('');
    try {
      const data = await getMyIssuerStatus();
      if (data.issuer) {
        setState({ issuerStatus: data.issuer, role: data.role });
      }
      setSetupStatus(data.setupStatus);

      if (data.issuer?.status === 'active') {
        window.location.hash = '#batches';
      } else if (data.setupStatus && !data.setupStatus.delegated) {
        setError('Delegation not detected yet. Please complete the delegation step and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return html`<div class="ct"><div class="loading"><span class="spinner" /> Loading setup status...</div></div>`;
  }

  const issuer = state.issuerStatus;
  if (!issuer || issuer.status === 'pending') {
    return html`
      <div class="ct">
        <div class="card center">
          <h2>Application Pending</h2>
          <p class="tm">Your application is being reviewed. You'll be notified when approved.</p>
        </div>
      </div>
    `;
  }

  const stepNum = issuer.status === 'active' ? 4
    : setupStatus?.delegated ? 4
    : issuer.status === 'approved' ? 3
    : 1;

  return html`
    <div class="ct">
      <h1>Issuer Setup</h1>

      <div class="steps">
        <div class="step ${stepNum >= 1 ? 'done' : ''}">
          <span class="step-num">1</span>
          <span>Apply</span>
        </div>
        <div class="step-line ${stepNum >= 2 ? 'done' : ''}" />
        <div class="step ${stepNum >= 2 ? 'done' : ''}">
          <span class="step-num">2</span>
          <span>Approved</span>
        </div>
        <div class="step-line ${stepNum >= 3 ? 'done' : ''}" />
        <div class="step ${stepNum >= 3 ? 'done' : ''}">
          <span class="step-num">3</span>
          <span>Delegate</span>
        </div>
        <div class="step-line ${stepNum >= 4 ? 'done' : ''}" />
        <div class="step ${stepNum >= 4 ? 'done' : ''}">
          <span class="step-num">4</span>
          <span>Ready</span>
        </div>
      </div>

      ${issuer.status === 'active' ? html`
        <div class="card center">
          <h2 style="color:var(--ok)">Setup Complete</h2>
          <p>You're ready to generate gift cards!</p>
          ${setupStatus && html`<p class="tm">Account creation tokens: <strong>${setupStatus.pendingTokens}</strong></p>`}
          <p class="mt1"><a href="#batches" class="btn">Go to Dashboard →</a></p>
        </div>
      ` : html`
        <div class="card">
          <h2>Delegate Active Authority</h2>
          <div class="notice">
            <strong>What this means:</strong>
            <p>You need to add the service account's active key to your account's active authority. This allows the service to create Hive accounts and delegate HP on your behalf when gift cards are claimed.</p>
            <p><strong>Important:</strong> You retain full control of your account. You can revoke this delegation at any time through Peakd or any Hive wallet.</p>
          </div>

          <h3 class="mt1">How to delegate:</h3>
          <ol class="setup-steps">
            <li>Go to <a href="https://peakd.com/@${state.username}/permissions" target="_blank" rel="noopener">your Peakd permissions page</a></li>
            <li>Under "Active" authority, add the service account's key</li>
            <li>Confirm the transaction with Hive Keychain</li>
            <li>Come back here and click "Check Delegation"</li>
          </ol>

          <div class="fx mt1">
            <button onClick=${handleCheckDelegation} disabled=${checking}>
              ${checking
                ? html`<span class="spinner" /> Checking...`
                : 'Check Delegation'}
            </button>
          </div>

          ${setupStatus && html`
            <dl class="meta mt1">
              <dt>Delegation Status</dt>
              <dd>${setupStatus.delegated
                ? html`<span style="color:var(--ok)">Delegated</span>`
                : html`<span style="color:var(--er)">Not delegated</span>`}</dd>
              <dt>Account Creation Tokens</dt>
              <dd>${setupStatus.pendingTokens}</dd>
            </dl>
          `}

          ${error && html`<p class="err mt1">${error}</p>`}
        </div>
      `}
    </div>
  `;
}
