import type { AppState, App } from '../app';
import { getClient } from '../../hive/client';
import { importKey, parseAsset, formatAsset } from '../../hive/keys';
import { transferToSavings, transferFromSavings, cancelTransferFromSavings } from '../../hive/operations';
import { signAndBroadcast } from '../../hive/signing';

export async function SavingsScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div id="si" class="card"><p class="mt">Loading...</p></div>
<div class="card"><h2>Deposit to Savings</h2><label>Amount</label>
<input type="number" id="da" placeholder="0.000" step="0.001" min="0.001">
<select id="dc"><option value="HBD">HBD</option><option value="HIVE">HIVE</option></select>
<button id="db">Deposit to Savings</button></div>
<div class="card"><h2>Withdraw from Savings</h2><p class="sm mt mb">3-day waiting period for security.</p>
<label>Amount</label><input type="number" id="wa" placeholder="0.000" step="0.001" min="0.001">
<select id="wc"><option value="HBD">HBD</option><option value="HIVE">HIVE</option></select>
<button id="wb">Withdraw from Savings</button></div>
<div id="pw" class="card hidden"><h2>Pending</h2><div id="pl"></div></div>
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
      if (!a) { si.innerHTML = '<p class="err">Not found.</p>'; return; }
      const sd = parseAsset(a.savings_hbd_balance), sh = parseAsset(a.savings_balance);
      const hbd = parseAsset(a.hbd_balance);
      si.innerHTML = `<div class="g2">
<div><p class="bl">HBD Savings</p><p class="ba gc">${sd.amount.toFixed(3)}</p></div>
<div><p class="bl">HIVE Savings</p><p class="ba">${sh.amount.toFixed(3)}</p></div></div>
<p class="sm mt mt1">Available: ${hbd.amount.toFixed(3)} HBD</p>
${sd.amount > 0 ? `<p class="sm gc mt1">~${(sd.amount*.2).toFixed(3)} HBD/yr (~20% APR)</p>` : ''}`;
      if (a.savings_withdraw_requests > 0) {
        pw.classList.remove('hidden');
        pl.innerHTML = `<p class="wrn">${a.savings_withdraw_requests} pending</p>
<button class="btn-s mt1" id="cb">Cancel Latest</button>`;
        pl.querySelector('#cb')!.addEventListener('click', async function(this: HTMLButtonElement) {
          this.disabled = true;
          try { const r = await signAndBroadcast([cancelTransferFromSavings(state.account!, 0)], importKey(state.activeKeyWif!));
            showO(`Cancelled. (${r.status})`); await load();
          } catch(e) { showE(e instanceof Error ? e.message : String(e)); } finally { this.disabled = false; }
        });
      } else pw.classList.add('hidden');
    } catch(e) { si.innerHTML = `<p class="err">${e instanceof Error ? e.message : e}</p>`; }
  }

  async function op(btn: HTMLButtonElement, inp: HTMLInputElement, sel: HTMLSelectElement, isSave: boolean) {
    const amt = parseFloat(inp.value), cur = sel.value as 'HIVE'|'HBD';
    if (!amt || amt <= 0) { showE('Amount must be > 0.'); return; }
    const label = isSave ? 'Deposit' : 'Withdraw (3-day wait)';
    if (!confirm(`${label} ${formatAsset(amt, cur)}?`)) return;
    btn.disabled = true; btn.textContent = 'Broadcasting...';
    try {
      const kp = importKey(state.activeKeyWif!);
      const o = isSave
        ? transferToSavings(state.account!, state.account!, formatAsset(amt, cur))
        : transferFromSavings(state.account!, Math.floor(Date.now()/1000)%2147483647, state.account!, formatAsset(amt, cur));
      const r = await signAndBroadcast([o], kp);
      showO(`${isSave ? 'Deposited' : 'Withdrawal initiated'}. (${r.status})`);
      inp.value = ''; await load();
    } catch(e) { showE(e instanceof Error ? e.message : String(e)); }
    finally { btn.disabled = false; btn.textContent = isSave ? 'Deposit to Savings' : 'Withdraw from Savings'; }
  }

  db.addEventListener('click', () => op(db, da, dc, true));
  wb.addEventListener('click', () => op(wb, wa, wc, false));
  await load();
}
