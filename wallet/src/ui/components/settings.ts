import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { getRpcManager } from '../../discovery/rpc-manager';
import { getObfuscationMode, setObfuscationMode, isObfuscationEnabled } from '../../obfuscation/manager';
import { isPhase2 } from '../../phase';
import { t, fmt } from '../locale';

const DEFAULTS = ['https://api.hive.blog','https://api.deathwing.me','https://hive-api.arcange.eu'];

export async function SettingsScreen(c: HTMLElement, state: AppState, app: App) {
  const cl = getClient(), mgr = getRpcManager();
  const disc = mgr.allEndpoints.filter(e => e.source === 'discovered');
  const hd = disc.length > 0, hm = !!state.memoKeyWif, ob = isObfuscationEnabled();
  const S = (cls: string, t: string) => `<p class="sm ${cls}">${t}</p>`;

  c.innerHTML = `${isPhase2() ? `<div class="card"><h2>${t.privacy}</h2>
${S('mt', `${t.mode_label} <strong class="${ob ? 'gc' : 'wrn'}">${ob ? t.mode_obfuscated : t.mode_direct}</strong>`)}
${S('mt1', ob ? t.traffic_disguised : t.traffic_plain)}
<button class="btn-s mt1" id="ot">${ob ? t.switch_to_direct : t.switch_to_obfuscated}</button>
<p class="sm hidden mt1" id="os"></p></div>` : ''}
<div class="card"><h2>${t.rpc_endpoint}</h2>
${S('mt mb', `${t.current_label} <code id="ce">${cl.currentEndpoint}</code>`)}
<label>${t.custom_endpoint}</label><input type="url" id="ci" placeholder="${t.rpc_placeholder}">
<button class="btn-s" id="se">${t.set_btn}</button><button class="btn-s" id="re">${t.reset_btn}</button><button class="btn-s" id="hc">${t.check_btn}</button>
<p class="sm hidden" id="es"></p></div>
${isPhase2() ? `<div class="card"><h2>${t.discovery}</h2>
${hm ? `${S('mt', `${t.status_label} <strong class="${hd ? 'gc' : ''}">${hd ? fmt(t.n_found, disc.length) : mgr.discoveryAttempted ? t.none_found : t.checking}</strong>`)}
${hd ? `<div class="mt1">${disc.map(e => S('', `<code>${e.url}</code> ${e.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}`)).join('')}</div>` : ''}
${mgr.lastPayload ? S('mt1', fmt(t.expires_label, new Date(mgr.lastPayload.expires).toLocaleDateString())) : ''}
<button class="btn-s mt1" id="rd">${t.discover}</button><button class="btn-s" id="ha">${t.check_all}</button>` :
`${S('mt wrn', t.no_memo_key)}${S('', t.add_memo_hint)}`}
<p class="sm hidden mt1" id="ds"></p></div>` : ''}
${isPhase2() ? `<div class="card"><h2>${t.endpoints}</h2><div id="el">${rl(mgr)}</div></div>` : ''}
<div class="card"><h2>${t.account_heading}</h2>
${S('', `@<strong>${state.account}</strong>`)}
${S('mt mb', `${t.active_check} ${state.activeKeyWif ? '✓' : '✗'} | ${t.memo_check} ${state.memoKeyWif ? '✓' : '✗'} | ${state.persistKeys ? t.persistent : t.session}`)}
<button class="btn-er" id="lo">${t.logout}</button></div>
<div class="card"><h2>${t.about}</h2>${S('mt', t.about_text)}</div>`;

  const ci = c.querySelector('#ci') as HTMLInputElement, ce = c.querySelector('#ce') as HTMLElement;
  const es = c.querySelector('#es') as HTMLElement;
  const ds = c.querySelector('#ds') as HTMLElement | null;
  const el = c.querySelector('#el') as HTMLElement | null;
  const sh = (t: HTMLElement, cls: string, m: string) => { t.className = `sm ${cls}`; t.textContent = m; t.classList.remove('hidden'); };

  // Phase 2 only: privacy toggle
  if (isPhase2()) {
    c.querySelector('#ot')!.addEventListener('click', () => {
      const nxt = getObfuscationMode() === 'obfuscated' ? 'direct' : 'obfuscated';
      if (nxt === 'direct' && !confirm(t.confirm_direct_mode)) return;
      setObfuscationMode(nxt as any);
      SettingsScreen(c, state, app);
    });
  }

  c.querySelector('#se')!.addEventListener('click', () => {
    const u = ci.value.trim();
    if (!u) { sh(es, 'err', t.enter_url); return; }
    try { new URL(u); mgr.addManualEndpoint(u); ce.textContent = cl.currentEndpoint; sh(es, 'ok', t.added); ci.value = ''; if (el) el.innerHTML = rl(mgr); }
    catch { sh(es, 'err', t.invalid_url); }
  });

  c.querySelector('#re')!.addEventListener('click', () => { cl.setEndpoints(DEFAULTS); ce.textContent = cl.currentEndpoint; sh(es, 'ok', t.reset_done); });

  c.querySelector('#hc')!.addEventListener('click', async function(this: HTMLButtonElement) {
    this.disabled = true; sh(es, 'mt', '...');
    const ok = await cl.healthCheck();
    sh(es, ok ? 'ok' : 'err', ok ? '✓ OK' : '✗ Failed');
    this.disabled = false;
  });

  // Phase 2 only: discovery + endpoints
  if (isPhase2()) {
    c.querySelector('#rd')?.addEventListener('click', async function(this: HTMLButtonElement) {
      this.disabled = true; sh(ds!, 'mt1', '...');
      const f = await mgr.discover(state.account!, state.memoKeyWif!);
      sh(ds!, f ? 'ok' : 'wrn', f ? fmt(t.found_n, mgr.lastPayload!.endpoints.length) : t.none_found_dot);
      ce.textContent = cl.currentEndpoint; el!.innerHTML = rl(mgr); this.disabled = false;
    });

    c.querySelector('#ha')?.addEventListener('click', async function(this: HTMLButtonElement) {
      this.disabled = true; sh(ds!, 'mt1', '...');
      await mgr.healthCheckAll();
      sh(ds!, 'ok', t.done); ce.textContent = cl.currentEndpoint; el!.innerHTML = rl(mgr); this.disabled = false;
    });
  }

  c.querySelector('#lo')!.addEventListener('click', () => { if (confirm(t.confirm_logout)) app.logout(); });
}

function rl(m: ReturnType<typeof getRpcManager>): string {
  const e = m.allEndpoints;
  if (!e.length) return `<p class="sm">${t.none}</p>`;
  return e.map(p => `<p class="sm"><code>${p.url}</code> <span class="xs">[${p.source}]</span> ${p.healthy ? '<span class="gc">✓</span>' : '<span class="err">✗</span>'}</p>`).join('');
}
