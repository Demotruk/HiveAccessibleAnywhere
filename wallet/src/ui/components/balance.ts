import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { parseAsset } from '../../hive/keys';
import { getRpcManager } from '../../discovery/rpc-manager';
import { isObfuscationEnabled } from '../../obfuscation/manager';

export async function BalanceScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div class="card"><p class="bl">Account</p>
<p style="font-size:1.1rem;font-weight:bold" class="mb">@${state.account}</p>
<div id="b"><p class="mt">Loading...</p></div></div>
<button class="btn-s" id="r">Refresh</button>`;

  const bel = c.querySelector('#b')!, rbtn = c.querySelector('#r') as HTMLButtonElement;

  async function load() {
    bel.innerHTML = '<p class="mt">Loading...</p>'; rbtn.disabled = true;
    try {
      const cl = getClient(), accs = await cl.getAccounts([state.account!]);
      if (!accs.length) { bel.innerHTML = '<p class="err">Account not found.</p>'; return; }
      const a = accs[0];
      const h = parseAsset(a.balance), d = parseAsset(a.hbd_balance);
      const sh = parseAsset(a.savings_balance), sd = parseAsset(a.savings_hbd_balance);
      bel.innerHTML = `<div class="g2">
<div><p class="bl">HIVE</p><p class="ba">${h.amount.toFixed(3)}</p></div>
<div><p class="bl">HBD</p><p class="ba">${d.amount.toFixed(3)}</p></div>
<div><p class="bl">HIVE Savings</p><p class="ba">${sh.amount.toFixed(3)}</p></div>
<div><p class="bl">HBD Savings</p><p class="ba gc">${sd.amount.toFixed(3)}</p></div></div>
${sd.amount > 0 ? `<div class="info mt2"><p class="sm mt">Est. interest (~20% APR): <strong class="gc">~${(sd.amount*.2).toFixed(3)} HBD/yr</strong></p></div>` : ''}
${a.savings_withdraw_requests > 0 ? `<p class="wrn mt1">${a.savings_withdraw_requests} pending withdrawal(s)</p>` : ''}
<p class="xs mt mt2">RPC: ${cl.currentEndpoint}${(() => { const m = getRpcManager(); const ep = m.allEndpoints.find(e => e.url === cl.currentEndpoint); return ep ? ` (${ep.source})` : ''; })()} | ${isObfuscationEnabled() ? '<span class="gc">obfuscated</span>' : '<span class="wrn">direct</span>'}</p>`;
    } catch (e) { bel.innerHTML = `<p class="err">${e instanceof Error ? e.message : e}</p>`; }
    finally { rbtn.disabled = false; }
  }
  rbtn.addEventListener('click', load); await load();
}
