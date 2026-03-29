import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { getBatchDetail, downloadFile } from '../api.js';
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

  useEffect(() => {
    setLoading(true);
    setError('');
    getBatchDetail(batchId)
      .then(b => { setBatch(b); setLoading(false); })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [batchId]);

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

      <h2>Cards (${batch.cards.length})</h2>
      <div style="overflow-x:auto">
        <table class="table">
          <thead>
            <tr>
              <th>Token Prefix</th>
              <th>Status</th>
              <th>Claimed By</th>
              <th>Claimed At</th>
            </tr>
          </thead>
          <tbody>
            ${batch.cards.map(card => html`
              <tr key=${card.tokenPrefix}>
                <td class="mono">${card.tokenPrefix}...</td>
                <td>${statusBadge(card.status)}</td>
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
