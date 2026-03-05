import type { AppState, App } from '../app';
import { importAndValidateKey } from '../../hive/keys';

const $ = (s: string, c: HTMLElement) => c.querySelector(s) as HTMLElement;

export async function LoginScreen(c: HTMLElement, state: AppState, app: App) {
  c.innerHTML = `<div class="card"><h2>Login</h2>
<p class="sm mt mb">Enter your Hive account name and private active key. Your key never leaves this device.</p>
<label>Account name</label><input id="a" placeholder="username" autocomplete="off" spellcheck="false">
<label>Private active key</label><input type="password" id="k" placeholder="5K..." autocomplete="off">
<label>Private memo key (optional)</label><input type="password" id="m" placeholder="5K... (for encrypted messages)" autocomplete="off">
<div class="mb"><label class="fx" style="cursor:pointer"><input type="checkbox" id="p" style="width:auto;margin:0"><span class="sm">Remember keys</span></label>
<p class="wrn hidden" id="pw">Keys stored in localStorage. Only use on a trusted device.</p></div>
<button id="b">Login</button><p class="err hidden" id="e"></p><p class="ok hidden" id="s"></p></div>`;

  const ai = $('#a',c) as HTMLInputElement, ki = $('#k',c) as HTMLInputElement;
  const mi = $('#m',c) as HTMLInputElement, pi = $('#p',c) as HTMLInputElement;
  const pw = $('#pw',c), btn = $('#b',c) as HTMLButtonElement;
  const er = $('#e',c), st = $('#s',c);

  const show = (el: HTMLElement, msg: string) => { el.textContent = msg; el.classList.remove('hidden'); };
  const hide = (...els: HTMLElement[]) => els.forEach(e => e.classList.add('hidden'));

  pi.addEventListener('change', () => pw.classList.toggle('hidden', !pi.checked));

  btn.addEventListener('click', async () => {
    const account = ai.value.trim().toLowerCase().replace('@','');
    const activeWif = ki.value.trim();
    const memoWif = mi.value.trim() || null;
    if (!account || !activeWif) { show(er, 'Account and active key required.'); return; }

    btn.disabled = true; hide(er); show(st, 'Validating...');

    try {
      const r = await importAndValidateKey(activeWif, account);
      if (r.role !== 'active' && r.role !== 'owner') {
        show(er, `This is a ${r.role} key. Active key required.`); hide(st); btn.disabled = false; return;
      }
      if (memoWif) {
        const mr = await importAndValidateKey(memoWif, account);
        if (mr.role !== 'memo') { show(er, `Second key is ${mr.role}, not memo.`); hide(st); btn.disabled = false; return; }
      }
      state.account = account; state.activeKeyWif = activeWif;
      state.memoKeyWif = memoWif; state.persistKeys = pi.checked;
      app.saveState(); app.startDiscovery(); app.navigate('balance');
    } catch (e) {
      show(er, e instanceof Error ? e.message : String(e)); hide(st); btn.disabled = false;
    }
  });
}
