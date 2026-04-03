/**
 * Setup page — guides approved issuers through configuration.
 *
 * Two modes:
 * - Delegate: add the service account's active key to the issuer's authority
 * - Self-hosted: register an external gift card service URL
 */

import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { state, setState } from '../state.js';
import { isKeychainAvailable, loginExternal } from '../auth.js';
import { getMyIssuerStatus, setServiceUrl, healthCheckExternal } from '../api.js';
import type { SetupStatus } from '../types.js';

type Mode = 'delegate' | 'self-hosted' | null;

export function Setup() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Mode selection
  const [mode, setMode] = useState<Mode>(null);

  // Self-hosted state
  const [serviceUrlInput, setServiceUrlInput] = useState('');
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchStatus() {
    try {
      const data = await getMyIssuerStatus();
      if (data.issuer) {
        setState({ issuerStatus: data.issuer, role: data.role });
        // Pre-select mode if already configured
        if (data.issuer.service_url) {
          setMode('self-hosted');
          setServiceUrlInput(data.issuer.service_url);
        } else if (data.issuer.delegation_verified_at) {
          setMode('delegate');
        }
      }
      setSetupStatus(data.setupStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

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

  async function handleHealthCheck() {
    setHealthChecking(true);
    setHealthResult(null);
    setError('');
    try {
      const url = serviceUrlInput.trim();
      if (!url) {
        setError('Enter your gift card service URL');
        return;
      }
      // Basic URL validation
      try { new URL(url); } catch { setError('Enter a valid URL (e.g. https://your-service.fly.dev)'); return; }

      const healthy = await healthCheckExternal(url);
      setHealthResult(healthy);
      if (!healthy) {
        setError('Could not reach your service. Check the URL and ensure CORS is configured.');
      }
    } finally {
      setHealthChecking(false);
    }
  }

  async function handleSaveServiceUrl() {
    setSaving(true);
    setError('');
    try {
      const url = serviceUrlInput.trim();
      const issuer = await setServiceUrl(url);
      setState({ issuerStatus: issuer });

      // If the server auto-activated, refresh role and authenticate with the external service
      if (issuer.status === 'active' && issuer.service_url) {
        // Re-fetch to get updated role from server
        const data = await getMyIssuerStatus();
        setState({ role: data.role, issuerStatus: data.issuer, externalServiceUrl: issuer.service_url });

        if (state.username) {
          const extJwt = await loginExternal(state.username, issuer.service_url);
          if (extJwt) {
            setState({ externalJwt: extJwt, externalConnected: true, externalError: null });
          } else {
            setState({ externalConnected: false, externalError: 'Connected but could not authenticate' });
          }
        }
        window.location.hash = '#batches';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return html`<div class="ct"><div class="loading"><span class="spinner" /> Loading setup status...</div></div>`;
  }

  const issuer = state.issuerStatus;

  // Whitelisted issuers (via GIFTCARD_ALLOWED_PROVIDERS) or admins may have no DB record.
  // If they already have an issuer/admin role, treat them as active.
  if (!issuer && (state.role === 'issuer' || state.role === 'admin')) {
    return html`
      <div class="ct">
        <h1>Issuer Setup</h1>
        ${renderSteps(4)}
        <div class="card center">
          <h2 style="color:var(--ok)">Setup Complete</h2>
          <p>You're ready to generate gift cards.</p>
          <p class="mt1"><a href="#batches" class="btn">Go to Dashboard →</a></p>
        </div>
      </div>
    `;
  }

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

  // Step indicator
  const stepNum = issuer.status === 'active' ? 4
    : (mode && (setupStatus?.delegated || healthResult)) ? 4
    : mode ? 3
    : issuer.status === 'approved' ? 2
    : 1;

  // Active issuer — show current config with option to update
  if (issuer.status === 'active') {
    return html`
      <div class="ct">
        <h1>Issuer Setup</h1>
        ${renderSteps(4)}

        <div class="card center">
          <h2 style="color:var(--ok)">Setup Complete</h2>
          <p>You're ready to generate gift cards!</p>
          ${issuer.service_url && html`
            <dl class="meta mt1">
              <dt>External Service</dt>
              <dd>${issuer.service_url}</dd>
            </dl>
          `}
          ${setupStatus && html`<p class="tm">Account creation tokens: <strong>${setupStatus.pendingTokens}</strong></p>`}
          <p class="mt1"><a href="#batches" class="btn">Go to Dashboard →</a></p>
        </div>

        ${issuer.service_url && html`
          <div class="card mt1">
            <h3>Update Service URL</h3>
            <div class="form-row">
              <input
                type="url"
                placeholder="https://your-service.fly.dev"
                value=${serviceUrlInput}
                onInput=${(e: Event) => { setServiceUrlInput((e.target as HTMLInputElement).value); setHealthResult(null); }}
              />
            </div>
            <div class="fx gap">
              <button onClick=${handleHealthCheck} disabled=${healthChecking}>
                ${healthChecking ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Checking...` : 'Check Connection'}
              </button>
              <button onClick=${handleSaveServiceUrl} disabled=${saving || !healthResult}>
                ${saving ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Saving...` : 'Update URL'}
              </button>
            </div>
            ${healthResult === true && html`<p class="mt1" style="color:var(--ok)">Service is reachable</p>`}
            ${error && html`<p class="err mt1">${error}</p>`}
          </div>
        `}
      </div>
    `;
  }

  // Approved issuer — show mode selection and setup
  return html`
    <div class="ct">
      <h1>Issuer Setup</h1>
      ${renderSteps(stepNum)}

      ${!mode && html`
        <div class="card">
          <h2>Choose Setup Mode</h2>
          <p class="tm mb">How would you like to operate your gift card service?</p>

          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div class="card" style="flex:1;min-width:220px;cursor:pointer;border:2px solid transparent" onClick=${() => setMode('delegate')}>
              <h3>Delegate to Operator</h3>
              <p class="sm">The operator's service creates accounts on your behalf. You delegate your active key authority.</p>
            </div>
            <div class="card" style="flex:1;min-width:220px;cursor:pointer;border:2px solid transparent" onClick=${() => setMode('self-hosted')}>
              <h3>Use Your Own Service</h3>
              <p class="sm">You run your own gift card service. Register its URL here. You retain full control of all keys.</p>
            </div>
          </div>
        </div>
      `}

      ${mode === 'delegate' && renderDelegateSetup(setupStatus, checking, error, handleCheckDelegation, () => setMode(null))}
      ${mode === 'self-hosted' && renderSelfHostedSetup(
        serviceUrlInput, setServiceUrlInput,
        healthChecking, healthResult, setHealthResult,
        saving, error, setError,
        handleHealthCheck, handleSaveServiceUrl, () => setMode(null),
      )}
    </div>
  `;
}

function renderSteps(stepNum: number) {
  return html`
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
        <span>Configure</span>
      </div>
      <div class="step-line ${stepNum >= 4 ? 'done' : ''}" />
      <div class="step ${stepNum >= 4 ? 'done' : ''}">
        <span class="step-num">4</span>
        <span>Ready</span>
      </div>
    </div>
  `;
}

function renderDelegateSetup(
  setupStatus: SetupStatus | null,
  checking: boolean,
  error: string,
  handleCheckDelegation: () => void,
  goBack: () => void,
) {
  return html`
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

      <div class="fx mt1 gap">
        <button onClick=${handleCheckDelegation} disabled=${checking}>
          ${checking
            ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Checking...`
            : 'Check Delegation'}
        </button>
        <button onClick=${goBack} class="btn-secondary">Back</button>
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
  `;
}

function renderSelfHostedSetup(
  serviceUrlInput: string,
  setServiceUrlInput: (v: string) => void,
  healthChecking: boolean,
  healthResult: boolean | null,
  setHealthResult: (v: boolean | null) => void,
  saving: boolean,
  error: string,
  setError: (v: string) => void,
  handleHealthCheck: () => void,
  handleSaveServiceUrl: () => void,
  goBack: () => void,
) {
  return html`
    <div class="card">
      <h2>Register Your Service</h2>
      <div class="notice">
        <p>Enter the URL of your gift card service. The dashboard will route batch operations to your service directly.</p>
        <p><strong>Requirements:</strong> Your service must implement the <a href="https://github.com/demotruk/HiveAccessibleAnywhere" target="_blank" rel="noopener">standard batch API</a> and allow CORS from this dashboard.</p>
      </div>

      <div class="form-row mt1">
        <label>Gift Card Service URL</label>
        <input
          type="url"
          placeholder="https://your-service.fly.dev"
          value=${serviceUrlInput}
          onInput=${(e: Event) => { setServiceUrlInput((e.target as HTMLInputElement).value); setHealthResult(null); setError(''); }}
        />
      </div>

      <div class="fx mt1 gap">
        <button onClick=${handleHealthCheck} disabled=${healthChecking || !serviceUrlInput.trim()}>
          ${healthChecking ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Checking...` : 'Check Connection'}
        </button>
        <button onClick=${handleSaveServiceUrl} disabled=${saving || !healthResult}>
          ${saving ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Saving...` : 'Register Service'}
        </button>
        <button onClick=${goBack} class="btn-secondary">Back</button>
      </div>

      ${healthResult === true && html`<p class="mt1" style="color:var(--ok)">Service is reachable</p>`}
      ${healthResult === false && html`<p class="mt1" style="color:var(--er)">Service is not reachable</p>`}
      ${error && html`<p class="err mt1">${error}</p>`}
    </div>
  `;
}
