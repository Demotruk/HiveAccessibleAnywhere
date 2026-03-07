import type { AppState, App } from '../app';
import { transfer } from '../../hive/operations';
import { signAndBroadcast } from '../../hive/signing';
import { importKey, formatAsset } from '../../hive/keys';
import { showError } from '../../hive/errors';
import { t, fmt } from '../locale';

export async function TransferScreen(c: HTMLElement, state: AppState, _app: App) {
  c.innerHTML = `<div class="card"><h2>${t.send_transfer}</h2>
<label>${t.recipient}</label><input id="to" placeholder="${t.username_placeholder}" autocomplete="off" spellcheck="false">
<label>${t.amount}</label><input type="number" id="am" placeholder="0.000" step="0.001" min="0.001">
<label>${t.currency}</label><select id="cu"><option value="HBD">${t.hbd}</option><option value="HIVE">${t.hive}</option></select>
<label>${t.memo_optional}</label><input id="me" placeholder="${t.public_memo}" autocomplete="off">
<div id="cb" class="hidden mb"><div class="card" style="background:var(--bg);border-color:var(--wn)">
<p class="sm" id="ct"></p><div class="fx mt2"><button class="btn-ok" id="y">${t.confirm}</button><button class="btn-s" id="n">${t.cancel}</button></div></div></div>
<button id="s">${t.send}</button><p class="err hidden" id="e"></p><p class="ok hidden" id="o"></p></div>`;

  const to = c.querySelector('#to') as HTMLInputElement, am = c.querySelector('#am') as HTMLInputElement;
  const cu = c.querySelector('#cu') as HTMLSelectElement, me = c.querySelector('#me') as HTMLInputElement;
  const sb = c.querySelector('#s') as HTMLButtonElement, cb = c.querySelector('#cb') as HTMLElement;
  const ct = c.querySelector('#ct') as HTMLElement, yb = c.querySelector('#y') as HTMLButtonElement;
  const nb = c.querySelector('#n') as HTMLElement, er = c.querySelector('#e') as HTMLElement, ok = c.querySelector('#o') as HTMLElement;

  // Trim recipient on blur (handles browser autofill trailing spaces)
  to.addEventListener('blur', () => { to.value = to.value.trim().toLowerCase().replace('@',''); });

  const show = (el: HTMLElement, msg: string) => { el.textContent = msg; el.classList.remove('hidden'); };
  const hide = (...els: HTMLElement[]) => els.forEach(e => e.classList.add('hidden'));

  sb.addEventListener('click', () => {
    const r = to.value.trim().toLowerCase().replace('@',''), a = parseFloat(am.value);
    hide(er, ok);
    if (!r) { show(er, t.recipient_required); return; }
    if (!a || a <= 0) { show(er, t.amount_positive); return; }
    ct.textContent = fmt(t.confirm_send, formatAsset(a, cu.value as any), r);
    cb.classList.remove('hidden'); sb.classList.add('hidden');
  });

  nb.addEventListener('click', () => { cb.classList.add('hidden'); sb.classList.remove('hidden'); });

  yb.addEventListener('click', async () => {
    const r = to.value.trim().toLowerCase().replace('@',''), a = parseFloat(am.value);
    const cur = cu.value as 'HIVE'|'HBD';
    yb.disabled = true; yb.textContent = t.broadcasting; hide(er);
    try {
      const kp = importKey(state.activeKeyWif!);
      const res = await signAndBroadcast([transfer(state.account!, r, formatAsset(a, cur), me.value)], kp);
      cb.classList.add('hidden'); sb.classList.remove('hidden');
      show(ok, fmt(t.sent_tx, res.tx_id?.slice(0,12) || '', res.status));
      to.value = ''; am.value = ''; me.value = '';
    } catch (e) {
      showError(er, e);
      cb.classList.add('hidden'); sb.classList.remove('hidden');
    } finally { yb.disabled = false; yb.textContent = t.confirm; }
  });
}
