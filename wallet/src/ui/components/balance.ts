import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { parseAsset } from '../../hive/keys';
import { getRpcManager } from '../../discovery/rpc-manager';
import { isObfuscationEnabled } from '../../obfuscation/manager';
import { t, fmt } from '../locale';

export async function BalanceScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div class="card"><p class="bl">${t.account_label}</p>
<p style="font-size:1.1rem;font-weight:bold" class="mb">@${state.account}</p>
<div id="b"><p class="mt">${t.loading}</p></div></div>
<button class="btn-s" id="r">${t.refresh}</button>`;

  const bel = c.querySelector('#b')!, rbtn = c.querySelector('#r') as HTMLButtonElement;

  async function load() {
    bel.innerHTML = `<p class="mt">${t.loading}</p>`; rbtn.disabled = true;
    try {
      const cl = getClient(), accs = await cl.getAccounts([state.account!]);
      if (!accs.length) { bel.innerHTML = `<p class="err">${t.account_not_found}</p>`; return; }
      const a = accs[0];
      const h = parseAsset(a.balance), d = parseAsset(a.hbd_balance);
      const sh = parseAsset(a.savings_balance), sd = parseAsset(a.savings_hbd_balance);
      bel.innerHTML = `<div class="g2">
<div><p class="bl">${t.hive}</p><p class="ba">${h.amount.toFixed(3)}</p></div>
<div><p class="bl">${t.hbd}</p><p class="ba">${d.amount.toFixed(3)}</p></div>
<div><p class="bl">${t.hive_savings}</p><p class="ba">${sh.amount.toFixed(3)}</p></div>
<div><p class="bl">${t.hbd_savings}</p><p class="ba gc">${sd.amount.toFixed(3)}</p></div></div>
${sd.amount > 0 ? `<div class="info mt2"><p class="sm mt">${t.est_interest} <strong class="gc">~${(sd.amount*.2).toFixed(3)} ${t.hbd_yr}</strong></p></div>` : ''}
${a.savings_withdraw_requests > 0 ? `<p class="wrn mt1">${fmt(t.pending_withdrawals, a.savings_withdraw_requests)}</p>` : ''}
<p class="xs mt mt2">${t.rpc_label} ${cl.currentEndpoint}${(() => { const m = getRpcManager(); const ep = m.allEndpoints.find(e => e.url === cl.currentEndpoint); return ep ? ` (${ep.source})` : ''; })()} | ${isObfuscationEnabled() ? `<span class="gc">${t.obfuscated}</span>` : `<span class="wrn">${t.direct}</span>`}</p>`;
    } catch (e) { bel.innerHTML = `<p class="err">${e instanceof Error ? e.message : e}</p>`; }
    finally { rbtn.disabled = false; }
  }
  rbtn.addEventListener('click', load); await load();
}
