import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { getBatchDetail, downloadFile, allocateBatch } from '../api.js';
import { state } from '../state.js';
import type { BatchDetail as BatchDetailType, Card } from '../types.js';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(status: Card['status']) {
  const cls = status === 'active' ? 'badge-active'
    : status === 'spent' ? 'badge-spent'
    : 'badge-revoked';
  return html`<span class="badge ${cls}">${status}</span>`;
}

function navigate(hash: string, e: Event) {
  e.preventDefault();
  window.location.hash = hash;
}

export function BatchDetail({ batchId }: { batchId: string }) {
  const [batch, setBatch] = useState<BatchDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allocRecipient, setAllocRecipient] = useState('');
  const [allocCount, setAllocCount] = useState(10);
  const [allocBusy, setAllocBusy] = useState(false);
  const [allocMsg, setAllocMsg] = useState('');
  const [allocErr, setAllocErr] = useState('');

  function reload() {
    setLoading(true);
    setError('');
    getBatchDetail(batchId)
      .then(b => { setBatch(b); setLoading(false); })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }

  useEffect(() => { reload(); }, [batchId]);

  async function handleAllocate(e: Event) {
    e.preventDefault();
    setAllocErr('');
    setAllocMsg('');
    const recipient = allocRecipient.trim().toLowerCase().replace(/^@/, '');
    if (!recipient) { setAllocErr('Recipient username required'); return; }
    if (!Number.isInteger(allocCount) || allocCount < 1 || allocCount > 100) {
      setAllocErr('Count must be between 1 and 100');
      return;
    }
    setAllocBusy(true);
    try {
      const result = await allocateBatch(batchId, recipient, allocCount);
      setAllocMsg(
        result.allocated === result.requested
          ? `Allocated ${result.allocated} cards to @${result.recipient}`
          : `Allocated ${result.allocated}/${result.requested} cards to @${result.recipient} (pool exhausted)`,
      );
      setAllocRecipient('');
      reload();
    } catch (err) {
      setAllocErr(err instanceof Error ? err.message : String(err));
    } finally {
      setAllocBusy(false);
    }
  }

  if (loading) {
    return html`<div class="ct"><div class="loading"><span class="spinner" /> Loading batch...</div></div>`;
  }

  if (error) {
    return html`
      <div class="ct">
        <p class="err">${error}</p>
        <a href="#batches" onClick=${(e: Event) => navigate('#batches', e)} class="sm">Back to batches</a>
      </div>
    `;
  }

  if (!batch) return null;

  const active = batch.cards.filter(c => c.status === 'active').length;
  const spent = batch.cards.filter(c => c.status === 'spent').length;
  const revoked = batch.cards.filter(c => c.status === 'revoked').length;
  const expired = new Date(batch.expiresAt) < new Date();
  const isAdmin = state.role === 'admin';
  const allocatedCount = batch.cards.filter(c => !!c.allocatedTo).length;
  const availableForAllocation = batch.cards.filter(c => !c.allocatedTo && c.status === 'active').length;

  return html`
    <div class="ct">
      <a href="#batches" onClick=${(e: Event) => navigate('#batches', e)} class="sm">← Back to batches</a>

      <div class="card mt1">
        <dl class="meta">
          <dt>Batch ID</dt>
          <dd class="mono">${batch.batchId}</dd>
          <dt>Created</dt>
          <dd>${formatDate(batch.createdAt)}</dd>
          <dt>Expires</dt>
          <dd>${formatDate(batch.expiresAt)}${expired ? html` <span class="badge badge-revoked">expired</span>` : ''}</dd>
          <dt>Cards</dt>
          <dd>${batch.count}</dd>
          <dt>Type</dt>
          <dd>${batch.promiseType}</dd>
          ${batch.declarationTx && html`
            <dt>Declaration TX</dt>
            <dd class="mono xs">${batch.declarationTx}</dd>
          `}
          ${batch.merkleRoot && html`
            <dt>Merkle Root</dt>
            <dd class="mono xs">${batch.merkleRoot.slice(0, 16)}...</dd>
          `}
          ${batch.note && html`
            <dt>Note</dt>
            <dd>${batch.note}</dd>
          `}
          ${batch.allocatable && html`
            <dt>Pool</dt>
            <dd><span class="badge badge-active">allocation pool</span> ${allocatedCount} allocated · ${availableForAllocation} available</dd>
          `}
        </dl>

        <div class="status-row mb">
          <span><span class="dot dot-active" />${active} active</span>
          <span><span class="dot dot-spent" />${spent} spent</span>
          <span><span class="dot dot-revoked" />${revoked} revoked</span>
        </div>

        <div class="fx">
          <button class="dl-btn"
            onClick=${() => downloadFile(`/api/batches/${batch.batchId}/pdf`, `${batch.batchId}.pdf`)}>
            Download PDF
          </button>
          <button class="dl-btn"
            onClick=${() => downloadFile(`/api/batches/${batch.batchId}/manifest`, `${batch.batchId}-manifest.json`)}>
            Download Manifest
          </button>
        </div>
      </div>

      ${isAdmin && batch.allocatable && html`
        <div class="card mt1">
          <h3 style="margin-top:0">Allocate cards</h3>
          <p class="sm mt mb">Assign unclaimed cards from this pool to another approved issuer. They'll see them under "My Allocations" and can print a PDF of just their cards.</p>
          <form onSubmit=${handleAllocate}>
            <div class="form-row">
              <label for="alloc-to">Recipient</label>
              <input id="alloc-to" type="text" placeholder="username"
                value=${allocRecipient}
                onInput=${(e: Event) => setAllocRecipient((e.target as HTMLInputElement).value)}
                disabled=${allocBusy} />
            </div>
            <div class="form-row">
              <label for="alloc-count">Count</label>
              <input id="alloc-count" type="number" min="1" max="100" step="1"
                value=${allocCount}
                onInput=${(e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v)) setAllocCount(v); }}
                disabled=${allocBusy} />
              <p class="form-hint">${availableForAllocation} cards available in this pool</p>
            </div>
            <button type="submit" disabled=${allocBusy || availableForAllocation === 0}>
              ${allocBusy ? 'Allocating...' : 'Allocate'}
            </button>
          </form>
          ${allocMsg && html`<p class="ok mt1">${allocMsg}</p>`}
          ${allocErr && html`<p class="err mt1">${allocErr}</p>`}
        </div>
      `}

      <h2>Cards (${batch.cards.length})</h2>
      <div style="overflow-x:auto">
        <table class="table">
          <thead>
            <tr>
              <th>Token Prefix</th>
              <th>Status</th>
              ${batch.allocatable && html`<th>Allocated To</th>`}
              <th>Claimed By</th>
              <th>Claimed At</th>
            </tr>
          </thead>
          <tbody>
            ${batch.cards.map(card => html`
              <tr key=${card.tokenPrefix}>
                <td class="mono">${card.tokenPrefix}...</td>
                <td>${statusBadge(card.status)}</td>
                ${batch.allocatable && html`<td>${card.allocatedTo ? `@${card.allocatedTo}` : '-'}</td>`}
                <td>${card.claimedBy ? `@${card.claimedBy}` : '-'}</td>
                <td class="sm">${formatDate(card.claimedAt)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
