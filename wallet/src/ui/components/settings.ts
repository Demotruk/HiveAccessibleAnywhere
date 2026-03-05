import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { getRpcManager } from '../../discovery/rpc-manager';

const DEFAULTS = ['https://api.hive.blog','https://api.deathwing.me','https://hive-api.arcange.eu'];

export async function SettingsScreen(c: HTMLElement, state: AppState, app: App) {
  const cl = getClient();
  const mgr = getRpcManager();
  const disc = mgr.allEndpoints.filter(e => e.source === 'discovered');
  const hasDisc = disc.length > 0;
  const hasMemo = !!state.memoKeyWif;

  c.innerHTML = `<div class="card"><h2>RPC Endpoint</h2>
<p class="sm mt mb">Current: <code id="ce">${cl.currentEndpoint}</code></p>
<label>Custom endpoint</label><input type="url" id="ci" placeholder="https://api.example.com">
<button class="btn-s" id="se">Set Endpoint</button>
<button class="btn-s" id="re">Reset Default</button>
<button class="btn-s" id="hc">Health Check</button>
<p class="sm hidden" id="es"></p></div>
<div class="card"><h2>Endpoint Discovery</h2>
${hasMemo ? `<p class="sm mt">Discovery: <strong class="${hasDisc ? 'gc' : ''}">${hasDisc ? `${disc.length} endpoint(s) found` : mgr.discoveryAttempted ? 'No endpoints found' : 'Checking...'}</strong></p>
${hasDisc ? `<div class="mt1">${disc.map(e => `<p class="sm"><code>${e.url}</code> ${e.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}</p>`).join('')}</div>` : ''}
${mgr.lastPayload ? `<p class="sm mt1">Expires: ${new Date(mgr.lastPayload.expires).toLocaleDateString()}</p>` : ''}
<button class="btn-s mt1" id="rd">Re-discover Now</button>
<button class="btn-s" id="ha">Health Check All</button>` :
`<p class="sm mt wrn">No memo key — endpoint discovery disabled.</p>
<p class="sm">Add your memo key at login to enable automatic proxy endpoint discovery.</p>`}
<p class="sm hidden mt1" id="ds"></p></div>
<div class="card"><h2>All Endpoints</h2>
<div id="el">${renderEndpointList(mgr)}</div></div>
<div class="card"><h2>Account</h2>
<p class="sm">Logged in as <strong>@${state.account}</strong></p>
<p class="sm mt">Active key: ${state.activeKeyWif ? '✓' : '✗'} | Memo key: ${state.memoKeyWif ? '✓' : '✗'}</p>
<p class="sm mt mb">Storage: ${state.persistKeys ? 'persistent' : 'session only'}</p>
<button class="btn-er" id="lo">Logout</button></div>
<div class="card"><h2>About</h2><p class="sm mt">HAA Wallet v0.1.0<br>Keys never leave this device.</p></div>`;

  const ci = c.querySelector('#ci') as HTMLInputElement, ce = c.querySelector('#ce') as HTMLElement;
  const es = c.querySelector('#es') as HTMLElement, ds = c.querySelector('#ds') as HTMLElement, el = c.querySelector('#el') as HTMLElement;
  const show = (target: HTMLElement, cls: string, msg: string) => { target.className = `sm ${cls}`; target.textContent = msg; target.classList.remove('hidden'); };

  c.querySelector('#se')!.addEventListener('click', () => {
    const u = ci.value.trim();
    if (!u) { show(es, 'err', 'Enter a URL.'); return; }
    try { new URL(u); mgr.addManualEndpoint(u); ce.textContent = cl.currentEndpoint; show(es, 'ok', 'Added.'); ci.value = ''; el.innerHTML = renderEndpointList(mgr); }
    catch { show(es, 'err', 'Invalid URL.'); }
  });

  c.querySelector('#re')!.addEventListener('click', () => {
    cl.setEndpoints(DEFAULTS); ce.textContent = cl.currentEndpoint; show(es, 'ok', 'Reset.');
  });

  c.querySelector('#hc')!.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; show(es, 'mt', 'Checking...');
    const ok = await cl.healthCheck();
    show(es, ok ? 'ok' : 'err', ok ? `✓ ${cl.currentEndpoint}` : '✗ Failed');
    this.disabled = false;
  });

  // Discovery buttons (only present if memo key available)
  const rdBtn = c.querySelector('#rd') as HTMLButtonElement | null;
  const haBtn = c.querySelector('#ha') as HTMLButtonElement | null;

  rdBtn?.addEventListener('click', async function() {
    this.disabled = true; show(ds, 'mt1', 'Discovering...');
    const found = await mgr.discover(state.account!, state.memoKeyWif!);
    show(ds, found ? 'ok' : 'wrn', found ? `Found ${mgr.lastPayload!.endpoints.length} endpoint(s)` : 'No endpoint memos found.');
    ce.textContent = cl.currentEndpoint;
    el.innerHTML = renderEndpointList(mgr);
    this.disabled = false;
  });

  haBtn?.addEventListener('click', async function() {
    this.disabled = true; show(ds, 'mt1', 'Checking all endpoints...');
    await mgr.healthCheckAll();
    show(ds, 'ok', 'Health checks complete.');
    ce.textContent = cl.currentEndpoint;
    el.innerHTML = renderEndpointList(mgr);
    this.disabled = false;
  });

  c.querySelector('#lo')!.addEventListener('click', () => {
    if (confirm('Logout and clear keys?')) app.logout();
  });
}

function renderEndpointList(mgr: ReturnType<typeof getRpcManager>): string {
  const eps = mgr.allEndpoints;
  if (eps.length === 0) return '<p class="sm">No endpoints configured.</p>';
  return eps.map(e =>
    `<p class="sm"><code>${e.url}</code> <span class="xs">[${e.source}]</span> ${e.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}</p>`
  ).join('');
}
