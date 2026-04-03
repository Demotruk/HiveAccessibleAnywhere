import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { createBatch, downloadFile } from '../api.js';
import { state } from '../state.js';
import type { BatchCreateResponse } from '../types.js';

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fa', label: 'Persian' },
  { value: 'ru', label: 'Russian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'vi', label: 'Vietnamese' },
];

function navigate(hash: string, e: Event) {
  e.preventDefault();
  window.location.hash = hash;
}

export function BatchForm() {
  const externalDown = !!(state.externalServiceUrl && !state.externalConnected);

  const [count, setCount] = useState(10);
  const [locale, setLocale] = useState('en');
  const [expiryDays, setExpiryDays] = useState(365);
  const [variant, setVariant] = useState<'standard' | 'robust'>('standard');
  const [autoFollowStr, setAutoFollowStr] = useState('');
  const [communitiesStr, setCommunitiesStr] = useState('');
  const [referrer, setReferrer] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BatchCreateResponse | null>(null);

  if (externalDown) {
    return html`
      <div class="ct">
        <h2>Generate Batch</h2>
        <div class="banner-warn">Your gift card service is unreachable. Batch generation is unavailable until the connection is restored.</div>
      </div>
    `;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setGenerating(true);

    try {
      const autoFollow = autoFollowStr.trim()
        ? autoFollowStr.split(',').map(s => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
        : undefined;
      const communities = communitiesStr.trim()
        ? communitiesStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : undefined;
      const refUser = referrer.trim().toLowerCase().replace(/^@/, '') || undefined;
      const res = await createBatch({
        count,
        locale,
        expiryDays,
        variant,
        design: 'hive',
        ...(note.trim() && { note: note.trim() }),
        ...(autoFollow?.length && { autoFollow }),
        ...(communities?.length && { communities }),
        ...(refUser && { referrer: refUser }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  if (result) {
    return html`
      <div class="ct" style="max-width:520px">
        <div class="card center">
          <h2 style="color:var(--ok)">Batch Generated</h2>
          <p>${result.count} gift cards created.</p>
          <p class="sm mt">Batch ID: <span class="mono">${result.batchId}</span></p>
        </div>

        <div class="btn-row mt2">
          <button class="btn-ok"
            onClick=${() => downloadFile(result.downloads.pdf, `${result.batchId}.pdf`)}>
            Download PDF
          </button>
          <button class="btn-s"
            onClick=${() => downloadFile(result.downloads.manifest, `${result.batchId}-manifest.json`)}>
            Download Manifest
          </button>
        </div>

        <p class="wrn sm mt1">The manifest contains all card secrets (tokens and PINs). Store it securely.</p>

        <div class="btn-row mt2">
          <button class="btn-s" onClick=${(e: Event) => navigate(`#batches/${result.batchId}`, e)}>
            View Batch
          </button>
          <button class="btn-s" onClick=${() => { setResult(null); setNote(''); }}>
            Generate Another
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="ct" style="max-width:520px">
      <h2>Generate New Batch</h2>
      <p class="sm mt mb">Issuer: <strong>@${state.username}</strong></p>

      <form onSubmit=${handleSubmit}>
        <div class="form-row">
          <label for="count">Number of Cards</label>
          <input id="count" type="number" min="1" max="100" step="1"
            value=${count}
            onInput=${(e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v)) setCount(v); }}
            disabled=${generating} />
          <p class="form-hint">1 to 100 cards per batch</p>
        </div>

        <div class="form-row">
          <label for="locale">Locale</label>
          <select id="locale" value=${locale}
            onChange=${(e: Event) => setLocale((e.target as HTMLSelectElement).value)}
            disabled=${generating}>
            ${LOCALES.map(l => html`<option value=${l.value}>${l.label} (${l.value})</option>`)}
          </select>
        </div>

        <div class="form-row">
          <label for="variant">Variant</label>
          <select id="variant" value=${variant}
            onChange=${(e: Event) => setVariant((e.target as HTMLSelectElement).value as 'standard' | 'robust')}
            disabled=${generating}>
            <option value="standard">Standard (unrestricted internet)</option>
            <option value="robust">Robust (restricted regions)</option>
          </select>
        </div>

        <div class="form-row">
          <label for="expiry">Expiry (days)</label>
          <input id="expiry" type="number" min="1" max="3650" step="1"
            value=${expiryDays}
            onInput=${(e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v)) setExpiryDays(v); }}
            disabled=${generating} />
        </div>

        <div class="form-row">
          <label for="autoFollow">Auto-Follow (optional)</label>
          <input id="autoFollow" type="text"
            placeholder="user1, user2, user3"
            value=${autoFollowStr}
            onInput=${(e: Event) => setAutoFollowStr((e.target as HTMLInputElement).value)}
            disabled=${generating} />
          <p class="form-hint">Comma-separated Hive usernames to follow on account creation (max 20)</p>
        </div>

        <div class="form-row">
          <label for="communities">Communities (optional)</label>
          <input id="communities" type="text"
            placeholder="hive-123456, hive-789012"
            value=${communitiesStr}
            onInput=${(e: Event) => setCommunitiesStr((e.target as HTMLInputElement).value)}
            disabled=${generating} />
          <p class="form-hint">Comma-separated Hive community names to subscribe on account creation (max 10)</p>
        </div>

        <div class="form-row">
          <label for="referrer">Referrer (optional)</label>
          <input id="referrer" type="text"
            placeholder="username"
            value=${referrer}
            onInput=${(e: Event) => setReferrer((e.target as HTMLInputElement).value)}
            disabled=${generating} />
          <p class="form-hint">Hive username recorded as account referrer</p>
        </div>

        <div class="form-row">
          <label for="note">Note (optional)</label>
          <textarea id="note" rows="2" placeholder="Batch description..."
            value=${note}
            onInput=${(e: Event) => setNote((e.target as HTMLTextAreaElement).value)}
            disabled=${generating} />
        </div>

        <p class="sm mt mb" style="color:var(--tm)">Design: Hive Community (default)</p>

        <button type="submit" disabled=${generating}>
          ${generating
            ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:8px" /> Generating ${count} cards...`
            : `Generate ${count} Cards`}
        </button>
      </form>

      ${error && html`<p class="err mt1">${error}</p>`}
    </div>
  `;
}
