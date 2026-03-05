import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';

const DEFAULTS = ['https://api.hive.blog','https://api.deathwing.me','https://hive-api.arcange.eu'];

export async function SettingsScreen(c: HTMLElement, state: AppState, app: App) {
  const cl = getClient();
  c.innerHTML = `<div class="card"><h2>RPC Endpoint</h2>
<p class="sm mt mb">Current: <code id="ce">${cl.currentEndpoint}</code></p>
<label>Custom endpoint</label><input type="url" id="ci" placeholder="https://api.example.com">
<button class="btn-s" id="se">Set Endpoint</button>
<button class="btn-s" id="re">Reset Default</button>
<button class="btn-s" id="hc">Health Check</button>
<p class="sm hidden" id="es"></p></div>
<div class="card"><h2>Account</h2>
<p class="sm">Logged in as <strong>@${state.account}</strong></p>
<p class="sm mt">Active key: ${state.activeKeyWif ? '✓' : '✗'} | Memo key: ${state.memoKeyWif ? '✓' : '✗'}</p>
<p class="sm mt mb">Storage: ${state.persistKeys ? 'persistent' : 'session only'}</p>
<button class="btn-er" id="lo">Logout</button></div>
<div class="card"><h2>About</h2><p class="sm mt">HAA Wallet v0.1.0<br>Keys never leave this device.</p></div>`;

  const ci = c.querySelector('#ci') as HTMLInputElement, ce = c.querySelector('#ce')!;
  const es = c.querySelector('#es')!;
  const show = (cls: string, msg: string) => { es.className = `sm ${cls}`; es.textContent = msg; es.classList.remove('hidden'); };

  c.querySelector('#se')!.addEventListener('click', () => {
    const u = ci.value.trim();
    if (!u) { show('err', 'Enter a URL.'); return; }
    try { new URL(u); cl.setEndpoints([u]); ce.textContent = u; show('ok', 'Updated.'); ci.value = ''; }
    catch { show('err', 'Invalid URL.'); }
  });

  c.querySelector('#re')!.addEventListener('click', () => {
    cl.setEndpoints(DEFAULTS); ce.textContent = cl.currentEndpoint; show('ok', 'Reset.');
  });

  c.querySelector('#hc')!.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; show('mt', 'Checking...');
    const ok = await cl.healthCheck();
    show(ok ? 'ok' : 'err', ok ? `✓ ${cl.currentEndpoint}` : '✗ Failed');
    this.disabled = false;
  });

  c.querySelector('#lo')!.addEventListener('click', () => {
    if (confirm('Logout and clear keys?')) app.logout();
  });
}
