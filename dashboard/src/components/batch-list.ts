import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { listBatches, downloadFile } from '../api.js';
import { state, setState } from '../state.js';
import type { Batch } from '../types.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function navigate(hash: string, e: Event) {
  e.preventDefault();
  window.location.hash = hash;
}

function BatchRow({ batch }: { batch: Batch }) {
  const { status } = batch;
  const expired = new Date(batch.expiresAt) < new Date();

  function handleDownloadPdf(e: Event) {
    e.stopPropagation();
    downloadFile(`/api/batches/${batch.batchId}/pdf`, `${batch.batchId}.pdf`);
  }

  function handleDownloadManifest(e: Event) {
    e.stopPropagation();
    downloadFile(`/api/batches/${batch.batchId}/manifest`, `${batch.batchId}-manifest.json`);
  }

  return html`
    <tr onClick=${(e: Event) => navigate(`#batches/${batch.batchId}`, e)} style="cursor:pointer">
      <td class="mono">
        <a href="#batches/${batch.batchId}" onClick=${(e: Event) => navigate(`#batches/${batch.batchId}`, e)}>
          ${batch.batchId.length > 24 ? batch.batchId.slice(0, 24) + '...' : batch.batchId}
        </a>
      </td>
      <td>${formatDate(batch.createdAt)}</td>
      <td>${batch.count}</td>
      <td>
        <div class="status-row">
          ${status.active > 0 && html`<span><span class="dot dot-active" />${status.active}</span>`}
          ${status.spent > 0 && html`<span><span class="dot dot-spent" />${status.spent}</span>`}
          ${status.revoked > 0 && html`<span><span class="dot dot-revoked" />${status.revoked}</span>`}
          ${expired && status.active > 0 && html`<span class="badge badge-revoked">expired</span>`}
        </div>
      </td>
      <td>
        <div class="fx">
          <button class="dl-btn" onClick=${handleDownloadPdf} title="Download PDF">PDF</button>
          <button class="dl-btn" onClick=${handleDownloadManifest} title="Download Manifest">JSON</button>
        </div>
      </td>
    </tr>
  `;
}

export function BatchList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const batches = state.batches;

  useEffect(() => {
    setLoading(true);
    setError('');
    listBatches()
      .then(b => {
        setState({ batches: b });
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return html`<div class="ct"><div class="loading"><span class="spinner" /> Loading batches...</div></div>`;
  }

  if (error) {
    return html`<div class="ct"><p class="err">${error}</p></div>`;
  }

  return html`
    <div class="ct">
      <div class="fx mb" style="justify-content:space-between">
        <h2 style="margin-bottom:0">Batches</h2>
        <button class="btn-sm btn-ok" onClick=${(e: Event) => navigate('#batches/generate', e)}>
          + Generate New Batch
        </button>
      </div>

      ${batches.length === 0 ? html`
        <div class="empty-state">
          <p>No batches yet.</p>
          <button onClick=${(e: Event) => navigate('#batches/generate', e)} style="width:auto;display:inline-block">
            Generate Your First Batch
          </button>
        </div>
      ` : html`
        <div style="overflow-x:auto">
          <table class="table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Created</th>
                <th>Cards</th>
                <th>Status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              ${batches.map(b => html`<${BatchRow} batch=${b} key=${b.batchId} />`)}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}
