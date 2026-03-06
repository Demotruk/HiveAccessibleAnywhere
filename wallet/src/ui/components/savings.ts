import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { importKey, parseAsset, formatAsset } from '../../hive/keys';
import { transferToSavings, transferFromSavings, cancelTransferFromSavings } from '../../hive/operations';
import { signAndBroadcast } from '../../hive/signing';
import { t, fmt } from '../locale';

export async function SavingsScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div id="si" class="card"><p class="mt">${t.loading}</p></div>
<div class="card"><h2>${t.deposit_heading}</h2><label>${t.amount}</label>
<input type="number" id="da" placeholder="0.000" step="0.001" min="0.001">
<select id="dc"><option value="HBD">${t.hbd}</option><option value="HIVE">${t.hive}</option></select>
<button id="db">${t.deposit_btn}</button></div>
<div class="card"><h2>${t.withdraw_heading}</h2><p class="sm mt mb">${t.three_day_wait}</p>
<label>${t.amount}</label><input type="number" id="wa" placeholder="0.000" step="0.001" min="0.001">
<select id="wc"><option value="HBD">${t.hbd}</option><option value="HIVE">${t.hive}</option></select>
<button id="wb">${t.withdraw_btn}</button></div>
<div id="pw" class="card hidden"><h2>${t.pending_heading}</h2><div id="pl"></div></div>
<p class="err hidden" id="e"></p><p class="ok hidden" id="o"></p>`;

  const si = c.querySelector('#si')!, da = c.querySelector('#da') as HTMLInputElement;
  const dc = c.querySelector('#dc') as HTMLSelectElement, db = c.querySelector('#db') as HTMLButtonElement;
  const wa = c.querySelector('#wa') as HTMLInputElement, wc = c.querySelector('#wc') as HTMLSelectElement;
  const wb = c.querySelector('#wb') as HTMLButtonElement;
  const pw = c.querySelector('#pw')!, pl = c.querySelector('#pl')!;
  const er = c.querySelector('#e')!, ok = c.querySelector('#o')!;

  const showE = (m: string) => { er.textContent = m; er.classList.remove('hidden'); ok.classList.add('hidden'); };
  const showO = (m: string) => { ok.textContent = m; ok.classList.remove('hidden'); er.classList.add('hidden'); };

  async function load() {
    try {
      const a = (await getClient().getAccounts([state.account!]))[0];
      if (!a) { si.innerHTML = `<p class="err">${t.not_found}</p>`; return; }
      const sd = parseAsset(a.savings_hbd_balance), sh = parseAsset(a.savings_balance);
      const hbd = parseAsset(a.hbd_balance);
      si.innerHTML = `<div class="g2">
<div><p class="bl">${t.hbd_savings}</p><p class="ba gc">${sd.amount.toFixed(3)}</p></div>
<div><p class="bl">${t.hive_savings}</p><p class="ba">${sh.amount.toFixed(3)}</p></div></div>
<p class="sm mt mt1">${fmt(t.available_hbd, hbd.amount.toFixed(3))}</p>
${sd.amount > 0 ? `<p class="sm gc mt1">${fmt(t.apr_estimate, (sd.amount*.2).toFixed(3))}</p>` : ''}`;
      if (a.savings_withdraw_requests > 0) {
        pw.classList.remove('hidden');
        pl.innerHTML = `<p class="wrn">${fmt(t.n_pending, a.savings_withdraw_requests)}</p>
<button class="btn-s mt1" id="cb">${t.cancel_latest}</button>`;
        pl.querySelector('#cb')!.addEventListener('click', async function(this: HTMLButtonElement) {
          this.disabled = true;
          try { const r = await signAndBroadcast([cancelTransferFromSavings(state.account!, 0)], importKey(state.activeKeyWif!));
            showO(fmt(t.cancelled, r.status)); await load();
          } catch(e) { showE(e instanceof Error ? e.message : String(e)); } finally { this.disabled = false; }
        });
      } else pw.classList.add('hidden');
    } catch(e) { si.innerHTML = `<p class="err">${e instanceof Error ? e.message : e}</p>`; }
  }

  async function op(btn: HTMLButtonElement, inp: HTMLInputElement, sel: HTMLSelectElement, isSave: boolean) {
    const amt = parseFloat(inp.value), cur = sel.value as 'HIVE'|'HBD';
    if (!amt || amt <= 0) { showE(t.amount_positive); return; }
    const confirmMsg = isSave ? fmt(t.confirm_deposit, formatAsset(amt, cur)) : fmt(t.confirm_withdraw, formatAsset(amt, cur));
    if (!confirm(confirmMsg)) return;
    btn.disabled = true; btn.textContent = t.broadcasting;
    try {
      const kp = importKey(state.activeKeyWif!);
      const o = isSave
        ? transferToSavings(state.account!, state.account!, formatAsset(amt, cur))
        : transferFromSavings(state.account!, Math.floor(Date.now()/1000)%2147483647, state.account!, formatAsset(amt, cur));
      const r = await signAndBroadcast([o], kp);
      showO(`${isSave ? t.deposited : t.withdrawal_initiated}. (${r.status})`);
      inp.value = ''; await load();
    } catch(e) { showE(e instanceof Error ? e.message : String(e)); }
    finally { btn.disabled = false; btn.textContent = isSave ? t.deposit_btn : t.withdraw_btn; }
  }

  db.addEventListener('click', () => op(db, da, dc, true));
  wb.addEventListener('click', () => op(wb, wa, wc, false));
  await load();
}
