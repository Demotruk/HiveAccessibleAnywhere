import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { getRpcManager } from '../../discovery/rpc-manager';
import { getObfuscationMode, setObfuscationMode, isObfuscationEnabled } from '../../obfuscation/manager';

const DEFAULTS = ['https://api.hive.blog','https://api.deathwing.me','https://hive-api.arcange.eu'];

export async function SettingsScreen(c: HTMLElement, state: AppState, app: App) {
  const cl = getClient(), mgr = getRpcManager();
  const disc = mgr.allEndpoints.filter(e => e.source === 'discovered');
  const hd = disc.length > 0, hm = !!state.memoKeyWif, ob = isObfuscationEnabled();
  const S = (cls: string, t: string) => `<p class="sm ${cls}">${t}</p>`;

  c.innerHTML = `<div class="card"><h2>Privacy</h2>
${S('mt', `Mode: <strong class="${ob ? 'gc' : 'wrn'}">${ob ? 'Obfuscated' : 'Direct'}</strong>`)}
${S('mt1', ob ? 'Traffic disguised as normal web requests.' : 'Plain JSON-RPC — visible to network observers.')}
<button class="btn-s mt1" id="ot">${ob ? 'Switch to Direct' : 'Switch to Obfuscated'}</button>
<p class="sm hidden mt1" id="os"></p></div>
<div class="card"><h2>RPC Endpoint</h2>
${S('mt mb', `Current: <code id="ce">${cl.currentEndpoint}</code>`)}
<label>Custom endpoint</label><input type="url" id="ci" placeholder="https://proxy.example.com/rpc">
<button class="btn-s" id="se">Set</button><button class="btn-s" id="re">Reset</button><button class="btn-s" id="hc">Check</button>
<p class="sm hidden" id="es"></p></div>
<div class="card"><h2>Discovery</h2>
${hm ? `${S('mt', `Status: <strong class="${hd ? 'gc' : ''}">${hd ? disc.length + ' found' : mgr.discoveryAttempted ? 'None found' : 'Checking...'}</strong>`)}
${hd ? `<div class="mt1">${disc.map(e => S('', `<code>${e.url}</code> ${e.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}`)).join('')}</div>` : ''}
${mgr.lastPayload ? S('mt1', `Expires: ${new Date(mgr.lastPayload.expires).toLocaleDateString()}`) : ''}
<button class="btn-s mt1" id="rd">Discover</button><button class="btn-s" id="ha">Check All</button>` :
`${S('mt wrn', 'No memo key — discovery disabled.')}${S('', 'Add memo key at login to discover proxy endpoints.')}`}
<p class="sm hidden mt1" id="ds"></p></div>
<div class="card"><h2>Endpoints</h2><div id="el">${rl(mgr)}</div></div>
<div class="card"><h2>Account</h2>
${S('', `@<strong>${state.account}</strong>`)}
${S('mt mb', `Active: ${state.activeKeyWif ? '✓' : '✗'} | Memo: ${state.memoKeyWif ? '✓' : '✗'} | ${state.persistKeys ? 'Persistent' : 'Session'}`)}
<button class="btn-er" id="lo">Logout</button></div>
<div class="card"><h2>About</h2>${S('mt', 'HAA Wallet v0.1.0 — Keys never leave this device.')}</div>`;

  const ci = c.querySelector('#ci') as HTMLInputElement, ce = c.querySelector('#ce') as HTMLElement;
  const es = c.querySelector('#es') as HTMLElement, ds = c.querySelector('#ds') as HTMLElement, el = c.querySelector('#el') as HTMLElement;
  const sh = (t: HTMLElement, cls: string, m: string) => { t.className = `sm ${cls}`; t.textContent = m; t.classList.remove('hidden'); };

  c.querySelector('#ot')!.addEventListener('click', () => {
    const nxt = getObfuscationMode() === 'obfuscated' ? 'direct' : 'obfuscated';
    if (nxt === 'direct' && !confirm('Direct mode exposes Hive traffic. Continue?')) return;
    setObfuscationMode(nxt as any);
    SettingsScreen(c, state, app);
  });

  c.querySelector('#se')!.addEventListener('click', () => {
    const u = ci.value.trim();
    if (!u) { sh(es, 'err', 'Enter a URL.'); return; }
    try { new URL(u); mgr.addManualEndpoint(u); ce.textContent = cl.currentEndpoint; sh(es, 'ok', 'Added.'); ci.value = ''; el.innerHTML = rl(mgr); }
    catch { sh(es, 'err', 'Invalid URL.'); }
  });

  c.querySelector('#re')!.addEventListener('click', () => { cl.setEndpoints(DEFAULTS); ce.textContent = cl.currentEndpoint; sh(es, 'ok', 'Reset.'); });

  c.querySelector('#hc')!.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; sh(es, 'mt', '...');
    const ok = await cl.healthCheck();
    sh(es, ok ? 'ok' : 'err', ok ? '✓ OK' : '✗ Failed');
    this.disabled = false;
  });

  c.querySelector('#rd')?.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; sh(ds, 'mt1', '...');
    const f = await mgr.discover(state.account!, state.memoKeyWif!);
    sh(ds, f ? 'ok' : 'wrn', f ? `Found ${mgr.lastPayload!.endpoints.length}` : 'None found.');
    ce.textContent = cl.currentEndpoint; el.innerHTML = rl(mgr); this.disabled = false;
  });

  c.querySelector('#ha')?.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; sh(ds, 'mt1', '...');
    await mgr.healthCheckAll();
    sh(ds, 'ok', 'Done.'); ce.textContent = cl.currentEndpoint; el.innerHTML = rl(mgr); this.disabled = false;
  });

  c.querySelector('#lo')!.addEventListener('click', () => { if (confirm('Logout and clear keys?')) app.logout(); });
}

function rl(m: ReturnType<typeof getRpcManager>): string {
  const e = m.allEndpoints;
  if (!e.length) return '<p class="sm">None.</p>';
  return e.map(p => `<p class="sm"><code>${p.url}</code> <span class="xs">[${p.source}]</span> ${p.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}</p>`).join('');
}
