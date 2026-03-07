import type { AppState, App } from '../app';
import { importAndValidateKey } from '../../hive/keys';
import { isObfuscationEnabled, setObfuscationMode } from '../../obfuscation/manager';
import { getRpcManager } from '../../discovery/rpc-manager';
import { decryptMemo } from '../../hive/memo';
import { isValidPayload, type EndpointPayload } from '../../discovery/endpoint-feed';
import { isPhase2 } from '../../phase';
import { showError } from '../../hive/errors';
import { t, fmt } from '../locale';
import { isQrScannerSupported, scanQrCode, parseQrPayload } from './qr-scanner';

const $ = (s: string, c: HTMLElement) => c.querySelector(s) as HTMLElement;

/** Try to decrypt a memo and extract proxy endpoints. Returns endpoint URLs or throws. */
function extractEndpointsFromMemo(memo: string, memoKeyWif: string): string[] {
  const text = memo.trim();
  if (!text.startsWith('#')) throw new Error(t.memo_not_hash);
  const decrypted = decryptMemo(text, memoKeyWif);
  let payload: EndpointPayload;
  try { payload = JSON.parse(decrypted); } catch { throw new Error(t.memo_bad_json); }
  if (!isValidPayload(payload)) throw new Error(t.memo_bad_payload);
  if (new Date(payload.expires) < new Date()) throw new Error(t.memo_expired);
  return payload.endpoints;
}

/** Shared HTML for the memo-paste section */
function memoSectionHtml(hasMemoKey: boolean): string {
  return `<p class="sm mt mb">${t.paste_memo_prefix} <a href="https://hive.blog" target="_blank">${t.block_explorer}</a>${t.paste_memo_suffix}</p>
<textarea id="em" rows="3" placeholder="${t.memo_textarea_placeholder}" style="font-size:0.8rem"></textarea>
${!hasMemoKey ? `<label>${t.private_memo_key_label}</label><input type="password" id="mk" placeholder="${t.key_placeholder}" autocomplete="off">` : ''}
<button class="btn-s" id="md">${t.decrypt_connect}</button>
<p class="err hidden" id="me"></p>`;
}

/** Wire up memo-paste event handlers. Returns nothing. */
function wireMemoHandlers(
  c: HTMLElement, memoKeyWif: string | null,
  onSuccess: (urls: string[]) => void,
): void {
  const emInput = $('#em', c) as HTMLTextAreaElement;
  const mkInput = c.querySelector('#mk') as HTMLInputElement | null;
  const mdBtn = $('#md', c) as HTMLButtonElement;
  const meErr = $('#me', c);
  const show = (msg: string) => { meErr.textContent = msg; meErr.classList.remove('hidden'); };

  mdBtn.addEventListener('click', () => {
    const memo = emInput.value.trim();
    const key = memoKeyWif || mkInput?.value.trim() || '';
    if (!memo) { show(t.paste_memo_error); return; }
    if (!key) { show(t.memo_key_required); return; }
    try {
      const urls = extractEndpointsFromMemo(memo, key);
      onSuccess(urls);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e));
    }
  });
}

export async function LoginScreen(c: HTMLElement, state: AppState, app: App) {
  const ob = isPhase2() && isObfuscationEnabled();
  const mgr = getRpcManager();
  const needsProxy = ob && !mgr.hasProxyEndpoints();
  const loggedIn = !!state.account;

  // Read and consume temporary memo key handed off from bootstrap
  let bootstrapMemoKey: string | null = null;
  try {
    bootstrapMemoKey = localStorage.getItem('propolis_bootstrap_memo_key');
    if (bootstrapMemoKey) localStorage.removeItem('propolis_bootstrap_memo_key');
  } catch { /* ignore */ }

  // If already logged in but just needs proxy, show simplified proxy-only card
  if (needsProxy && loggedIn) {
    const hasMemo = !!state.memoKeyWif;
    c.innerHTML = `<div class="card"><h2>${t.proxy_setup}</h2>
<p class="sm mt mb">${t.proxy_desc_reconnect}</p>
<label>${t.proxy_url}</label><input type="url" id="px" placeholder="${t.proxy_placeholder}" autocomplete="off">
<button class="btn-s" id="pa">${t.connect}</button>
${memoSectionHtml(hasMemo)}
<p class="sm mt1"><a href="#" id="dm">${t.switch_direct_link}</a></p>
<p class="err hidden" id="pe"></p></div>`;

    const pxInput = $('#px',c) as HTMLInputElement;
    const paBtn = $('#pa',c) as HTMLButtonElement;
    const peErr = $('#pe',c);
    const dmLink = $('#dm',c);

    paBtn.addEventListener('click', () => {
      const url = pxInput.value.trim();
      if (!url) { peErr.textContent = t.enter_proxy_url; peErr.classList.remove('hidden'); return; }
      try { new URL(url); } catch { peErr.textContent = t.invalid_url; peErr.classList.remove('hidden'); return; }
      mgr.addManualEndpoint(url);
      app.startDiscovery();
      app.navigate('balance');
    });

    wireMemoHandlers(c, state.memoKeyWif, (urls) => {
      for (const u of urls) mgr.addManualEndpoint(u);
      app.startDiscovery();
      app.navigate('balance');
    });

    dmLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm(t.confirm_direct_mode)) return;
      setObfuscationMode('direct');
      app.startDiscovery();
      app.navigate('balance');
    });
    return;
  }

  // Normal login screen (with optional proxy setup section for new users)
  c.innerHTML = `<div class="card"><h2>${t.login_title}</h2>
${needsProxy ? `<div class="info mb"><p class="sm"><strong>${t.proxy_required}</strong> — ${t.proxy_desc_connect}</p>
<label>${t.proxy_url}</label><input type="url" id="px" placeholder="${t.proxy_placeholder}" autocomplete="off">
<button class="btn-s" id="pa">${t.connect}</button>
${memoSectionHtml(false)}
<p class="sm mt1"><a href="#" id="dm">${t.switch_direct_link}</a></p>
<p class="err hidden" id="pe"></p></div>` : ''}
<p class="sm mt mb">${t.login_info}</p>
${isQrScannerSupported() ? `<button class="btn-s mb" id="qr" type="button">${t.scan_qr}</button>` : ''}
<label>${t.account_name}</label><input id="a" placeholder="${t.username_placeholder}" autocomplete="off" spellcheck="false">
<label>${t.private_active_key}</label><input type="password" id="k" placeholder="${t.key_placeholder}" autocomplete="off">
<label>${t.private_memo_key}</label><input type="password" id="m" placeholder="${t.memo_key_placeholder}" autocomplete="off">
<div class="mb"><label class="fx" style="cursor:pointer"><input type="checkbox" id="p" style="width:auto;margin:0"><span class="sm">${t.remember_keys}</span></label>
<p class="wrn hidden" id="pw">${t.remember_warning}</p></div>
<button id="b"${needsProxy ? ' disabled' : ''}>${t.login_btn}</button><p class="err hidden" id="e"></p><p class="ok hidden" id="s"></p></div>`;

  const ai = $('#a',c) as HTMLInputElement, ki = $('#k',c) as HTMLInputElement;
  const mi = $('#m',c) as HTMLInputElement, pi = $('#p',c) as HTMLInputElement;
  const pw = $('#pw',c), btn = $('#b',c) as HTMLButtonElement;
  const er = $('#e',c), st = $('#s',c);

  // Trim account name on blur (handles browser autofill trailing spaces)
  ai.addEventListener('blur', () => { ai.value = ai.value.trim().toLowerCase().replace('@',''); });

  // Pre-fill memo key from bootstrap handoff (user still controls persistence via "Remember keys")
  if (bootstrapMemoKey) mi.value = bootstrapMemoKey;

  const show = (el: HTMLElement, msg: string) => { el.textContent = msg; el.classList.remove('hidden'); };
  const hide = (...els: HTMLElement[]) => els.forEach(e => e.classList.add('hidden'));

  // QR code scanning
  const qrBtn = c.querySelector('#qr') as HTMLButtonElement | null;
  if (qrBtn) {
    qrBtn.addEventListener('click', async () => {
      try {
        const raw = await scanQrCode();
        if (!raw) return;
        hide(er, st);
        const result = parseQrPayload(raw);
        if (result.type === 'combined') {
          ai.value = result.account;
          ki.value = result.activeWif;
          if (result.memoWif) mi.value = result.memoWif;
          show(st, t.qr_filled_all);
        } else if (result.type === 'wif') {
          if (!ki.value) { ki.value = result.key; show(st, t.qr_filled_active); }
          else if (!mi.value) { mi.value = result.key; show(st, t.qr_filled_memo); }
          else { ki.value = result.key; show(st, t.qr_filled_active); }
        } else {
          show(er, t.qr_unknown);
        }
      } catch (e) {
        show(er, e instanceof Error ? e.message : t.qr_no_camera);
      }
    });
  }

  // Proxy setup handlers (only when obfuscation ON and no proxy configured)
  if (needsProxy) {
    const pxInput = $('#px',c) as HTMLInputElement;
    const paBtn = $('#pa',c) as HTMLButtonElement;
    const peErr = $('#pe',c);
    const dmLink = $('#dm',c);

    paBtn.addEventListener('click', () => {
      const url = pxInput.value.trim();
      if (!url) { show(peErr, t.enter_proxy_url); return; }
      try { new URL(url); } catch { show(peErr, t.invalid_url); return; }
      mgr.addManualEndpoint(url);
      LoginScreen(c, state, app); // re-render without proxy setup
    });

    wireMemoHandlers(c, null, (urls) => {
      for (const u of urls) mgr.addManualEndpoint(u);
      LoginScreen(c, state, app); // re-render without proxy setup
    });

    dmLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm(t.confirm_direct_mode)) return;
      setObfuscationMode('direct');
      LoginScreen(c, state, app); // re-render in direct mode
    });
  }

  pi.addEventListener('change', () => pw.classList.toggle('hidden', !pi.checked));

  btn.addEventListener('click', async () => {
    const account = ai.value.trim().toLowerCase().replace('@','');
    const activeWif = ki.value.trim();
    const memoWif = mi.value.trim() || null;
    if (!account || !activeWif) { show(er, t.account_key_required); return; }

    btn.disabled = true; hide(er); show(st, t.validating);

    try {
      const r = await importAndValidateKey(activeWif, account);
      if (r.role !== 'active' && r.role !== 'owner') {
        show(er, fmt(t.wrong_key_role, r.role)); hide(st); btn.disabled = false; return;
      }
      if (memoWif) {
        const mr = await importAndValidateKey(memoWif, account);
        if (mr.role !== 'memo') { show(er, fmt(t.wrong_memo_role, mr.role)); hide(st); btn.disabled = false; return; }
      }
      state.account = account; state.activeKeyWif = activeWif;
      state.memoKeyWif = memoWif; state.persistKeys = pi.checked;
      app.saveState(); app.startDiscovery(); app.navigate('balance');
    } catch (e) {
      showError(er, e); hide(st); btn.disabled = false;
    }
  });
}
