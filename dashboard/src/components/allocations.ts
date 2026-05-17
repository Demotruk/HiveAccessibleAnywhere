import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { getMyAllocations, downloadAllocationPdf } from '../api.js';
import type { MyAllocationsResponse, AllocationBatchSummary, AllocatedCard } from '../types.js';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusBadge(status: AllocatedCard['status']) {
  const cls = status === 'active' ? 'badge-active'
    : status === 'spent' ? 'badge-spent'
    : 'badge-revoked';
  return html`<span class="badge ${cls}">${status}</span>`;
}

function BatchSummaryCard({
  summary,
  cards,
}: {
  summary: AllocationBatchSummary;
  cards: AllocatedCard[];
}) {
  const [busy, setBusy] = useState<'all' | 'unclaimed' | null>(null);
  const [err, setErr] = useState('');

  async function download(include: 'all' | 'unclaimed') {
    setBusy(include);
    setErr('');
    try {
      const filename = `allocated-${summary.batchId}-${include}.pdf`;
      await downloadAllocationPdf(summary.batchId, filename, { include });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const unclaimed = summary.active;

  return html`
    <div class="card mt1">
      <dl class="meta">
        <dt>From</dt>
        <dd>@${summary.batchProvider}</dd>
        <dt>Batch</dt>
        <dd class="mono xs">${summary.batchId}</dd>
        <dt>Expires</dt>
        <dd>${formatDate(summary.batchExpiresAt)}</dd>
        <dt>Allocated</dt>
        <dd>${summary.total}</dd>
      </dl>

      <div class="status-row mb">
        <span><span class="dot dot-active" />${summary.active} unclaimed</span>
        <span><span class="dot dot-spent" />${summary.spent} claimed</span>
      </div>

      <div class="fx">
        <button class="dl-btn"
          disabled=${busy !== null || unclaimed === 0}
          onClick=${() => download('unclaimed')}>
          ${busy === 'unclaimed' ? 'Preparing...' : `Print unclaimed (${unclaimed})`}
        </button>
        <button class="dl-btn"
          disabled=${busy !== null || summary.total === 0}
          onClick=${() => download('all')}>
          ${busy === 'all' ? 'Preparing...' : `Print all (${summary.total})`}
        </button>
      </div>
      ${err && html`<p class="err mt1">${err}</p>`}

      <details class="mt1">
        <summary class="sm">Card details (${cards.length})</summary>
        <div style="overflow-x:auto" class="mt1">
          <table class="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Status</th>
                <th>Claimed By</th>
                <th>Claimed At</th>
              </tr>
            </thead>
            <tbody>
              ${cards.map(c => html`
                <tr key=${c.tokenPrefix}>
                  <td class="mono">${c.tokenPrefix}...</td>
                  <td>${statusBadge(c.status)}</td>
                  <td>${c.claimedBy ? `@${c.claimedBy}` : '-'}</td>
                  <td class="sm">${formatDate(c.claimedAt)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;
}

export function Allocations() {
  const [data, setData] = useState<MyAllocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getMyAllocations()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return html`<div class="ct"><div class="loading"><span class="spinner" /> Loading allocations...</div></div>`;
  }

  if (error) {
    return html`<div class="ct"><p class="err">${error}</p></div>`;
  }

  if (!data || data.batches.length === 0) {
    return html`
      <div class="ct">
        <h2>My Allocations</h2>
        <div class="empty-state">
          <p>No cards have been allocated to you yet.</p>
          <p class="sm">When the dashboard operator allocates starter cards to your account, they'll appear here for printing.</p>
        </div>
      </div>
    `;
  }

  const cardsByBatch = new Map<string, AllocatedCard[]>();
  for (const c of data.cards) {
    const arr = cardsByBatch.get(c.batchId) ?? [];
    arr.push(c);
    cardsByBatch.set(c.batchId, arr);
  }

  return html`
    <div class="ct">
      <h2>My Allocations</h2>
      <p class="sm mt mb">
        Cards allocated to you by another issuer. The cards remain attributed to the issuer who created them — you're distributing them, not issuing them.
      </p>
      ${data.batches.map(b => html`
        <${BatchSummaryCard} key=${b.batchId} summary=${b} cards=${cardsByBatch.get(b.batchId) ?? []} />
      `)}
    </div>
  `;
}
