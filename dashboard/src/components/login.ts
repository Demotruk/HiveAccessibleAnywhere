import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { isKeychainAvailable, login, loginExternal } from '../auth.js';
import { setState } from '../state.js';
import { getMyIssuerStatus, listIssuers } from '../api.js';

export function Login() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  async function handleLogin(e: Event) {
    e.preventDefault();
    setError('');

    const name = username.toLowerCase().replace(/^@/, '').trim();
    if (!name) {
      setError('Enter your Hive username');
      return;
    }

    if (!isKeychainAvailable()) {
      setError('Hive Keychain extension not detected. Install it from hivekeychain.com');
      return;
    }

    setSigning(true);
    try {
      setStatusMsg('Signing in...');
      const jwt = await login(name);
      setState({ jwt, username: name });

      // Fetch issuer status and role to determine where to route
      const data = await getMyIssuerStatus();
      setState({ role: data.role, issuerStatus: data.issuer, preApproved: !!data.preApproved, serviceAccount: data.serviceAccount || null });

      // If issuer has an external service URL, authenticate with it
      if (data.issuer?.service_url) {
        const serviceUrl = data.issuer.service_url;
        setState({ externalServiceUrl: serviceUrl });
        setStatusMsg('Connecting to your service...');

        const extJwt = await loginExternal(name, serviceUrl);
        if (extJwt) {
          setState({ externalJwt: extJwt, externalConnected: true, externalError: null });
        } else {
          setState({ externalConnected: false, externalError: 'Could not connect to your gift card service' });
        }
      }

      // Fetch pending application count for admins (non-blocking)
      if (data.role === 'admin') {
        listIssuers('pending').then(issuers => {
          setState({ pendingCount: issuers.length });
        }).catch(() => {});
      }

      // Redirect to saved destination (e.g. from approval memo link) or role-based default
      const redirect = sessionStorage.getItem('propolis_redirect');
      sessionStorage.removeItem('propolis_redirect');

      if (redirect) {
        window.location.hash = redirect;
      } else if (data.role === 'admin') {
        window.location.hash = '#admin';
      } else if (data.role === 'issuer') {
        window.location.hash = '#batches';
      } else if (data.issuer?.status === 'approved') {
        window.location.hash = '#setup';
      } else if (data.issuer?.status === 'pending') {
        window.location.hash = '#apply';
      } else {
        // No issuer record — show apply option
        window.location.hash = '#apply';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Keychain cancel / timeout — not a real error, just reset
      if (/not respond|cancel|denied|rejected/i.test(msg)) {
        setError('');
      } else {
        setError(msg);
      }
    } finally {
      setSigning(false);
      setStatusMsg('');
    }
  }

  return html`
    <div class="ct" style="max-width:420px;margin-top:80px">
      <div class="center mb">
        <h1>HiveInvite</h1>
        <p class="sm mt">Sign in with Hive Keychain to manage gift cards or apply to become an onboarder.</p>
      </div>

      <form onSubmit=${handleLogin}>
        <div class="form-row">
          <label for="username">Hive Username</label>
          <input
            id="username"
            type="text"
            placeholder="yourusername"
            value=${username}
            onInput=${(e: Event) => setUsername((e.target as HTMLInputElement).value)}
            disabled=${signing}
            autocomplete="username"
            autofocus
          />
        </div>

        <button type="submit" disabled=${signing}>
          ${signing ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> ${statusMsg || 'Signing in...'}` : 'Sign in with Keychain'}
        </button>
      </form>

      ${error && html`<p class="err mt1">${error}</p>`}
    </div>
  `;
}
