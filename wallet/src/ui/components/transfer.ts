import type { AppState, App } from '../app';
import { transfer } from '../../hive/operations';
import { signAndBroadcast } from '../../hive/signing';
import { importKey, formatAsset } from '../../hive/keys';

export async function TransferScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div class="card"><h2>Send Transfer</h2>
<label>Recipient</label><input id="to" placeholder="username" autocomplete="off" spellcheck="false">
<label>Amount</label><input type="number" id="am" placeholder="0.000" step="0.001" min="0.001">
<label>Currency</label><select id="cu"><option value="HBD">HBD</option><option value="HIVE">HIVE</option></select>
<label>Memo (optional)</label><input id="me" placeholder="Public memo" autocomplete="off">
<div id="cb" class="hidden mb"><div class="card" style="background:var(--bg);border-color:var(--wn)">
<p class="sm" id="ct"></p><div class="fx mt2"><button class="btn-ok" id="y">Confirm</button><button class="btn-s" id="n">Cancel</button></div></div></div>
<button id="s">Send</button><p class="err hidden" id="e"></p><p class="ok hidden" id="o"></p></div>`;

  const to = c.querySelector('#to') as HTMLInputElement, am = c.querySelector('#am') as HTMLInputElement;
  const cu = c.querySelector('#cu') as HTMLSelectElement, me = c.querySelector('#me') as HTMLInputElement;
  const sb = c.querySelector('#s') as HTMLButtonElement, cb = c.querySelector('#cb')!;
  const ct = c.querySelector('#ct')!, yb = c.querySelector('#y') as HTMLButtonElement;
  const nb = c.querySelector('#n')!, er = c.querySelector('#e')!, ok = c.querySelector('#o')!;

  const show = (el: HTMLElement, msg: string) => { el.textContent = msg; el.classList.remove('hidden'); };
  const hide = (...els: HTMLElement[]) => els.forEach(e => e.classList.add('hidden'));

  sb.addEventListener('click', () => {
    const r = to.value.trim().toLowerCase().replace('@',''), a = parseFloat(am.value);
    hide(er, ok);
    if (!r) { show(er, 'Recipient required.'); return; }
    if (!a || a <= 0) { show(er, 'Amount must be > 0.'); return; }
    ct.textContent = `Send ${formatAsset(a, cu.value as any)} to @${r}?`;
    cb.classList.remove('hidden'); sb.classList.add('hidden');
  });

  nb.addEventListener('click', () => { cb.classList.add('hidden'); sb.classList.remove('hidden'); });

  yb.addEventListener('click', async () => {
    const r = to.value.trim().toLowerCase().replace('@',''), a = parseFloat(am.value);
    const cur = cu.value as 'HIVE'|'HBD';
    yb.disabled = true; yb.textContent = 'Broadcasting...'; hide(er);
    try {
      const kp = importKey(state.activeKeyWif!);
      const res = await signAndBroadcast([transfer(state.account!, r, formatAsset(a, cur), me.value)], kp);
      cb.classList.add('hidden'); sb.classList.remove('hidden');
      show(ok, `Sent! TX: ${res.tx_id?.slice(0,12)}... (${res.status})`);
      to.value = ''; am.value = ''; me.value = '';
    } catch (e) {
      show(er, e instanceof Error ? e.message : String(e));
      cb.classList.add('hidden'); sb.classList.remove('hidden');
    } finally { yb.disabled = false; yb.textContent = 'Confirm'; }
  });
}
