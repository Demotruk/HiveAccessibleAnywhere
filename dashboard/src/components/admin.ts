/**
 * Admin panel — manage issuer applications and view active issuers.
 */

import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { state, setState } from '../state.js';
import { listIssuers, approveIssuer as apiApprove, revokeIssuer as apiRevoke, banIssuer as apiBan } from '../api.js';
import { isKeychainAvailable, broadcastCustomJson } from '../auth.js';
import type { IssuerWithStats, IssuerRecord } from '../types.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function PendingList() {
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    listIssuers('pending')
      .then(data => { setIssuers(data); setState({ pendingCount: data.length }); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  async function handleApprove(username: string) {
    setError('');
    setApproving(username);

    try {
      if (!isKeychainAvailable()) {
        throw new Error('Hive Keychain required to broadcast approval.');
      }

      // Broadcast approval custom_json on-chain
      const txResult = await broadcastCustomJson(
        state.username!,
        'propolis_issuer_approve',
        'Posting',
        {
          issuer: username,
          approved_at: new Date().toISOString(),
        },
        `Approve @${username} as an issuer`,
      );

      // Register approval with backend — txResult may be an object {id, tx_id, confirmed}
      const txId = typeof txResult === 'object' && txResult !== null
        ? (txResult as Record<string, unknown>).tx_id as string ?? (txResult as Record<string, unknown>).id as string
        : String(txResult);
      await apiApprove(username, txId);

      // Remove from pending list and update badge count
      setIssuers(prev => prev.filter(i => i.username !== username));
      setState({ pendingCount: Math.max(0, state.pendingCount - 1) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(null);
    }
  }

  if (loading) return html`<div class="loading"><span class="spinner" /> Loading...</div>`;
  if (error) return html`<p class="err">${error}</p>`;

  if (issuers.length === 0) {
    return html`<p class="tm">No pending applications.</p>`;
  }

  return html`
    <table class="table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Description</th>
          <th>Contact</th>
          <th>Applied</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${issuers.map(i => html`
          <tr key=${i.username}>
            <td class="mono">@${i.username}</td>
            <td>${i.description || '-'}</td>
            <td>${i.contact || '-'}</td>
            <td>${formatDate(i.applied_at)}</td>
            <td>
              <button
                class="btn-sm"
                onClick=${() => handleApprove(i.username)}
                disabled=${approving === i.username}
              >
                ${approving === i.username
                  ? html`<span class="spinner" />`
                  : 'Approve'}
              </button>
            </td>
          </tr>
        `)}
      </tbody>
    </table>
  `;
}

function ActiveList() {
  const [issuers, setIssuers] = useState<IssuerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  // Track pending status changes per issuer (dropdown value differs from current)
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    listIssuers()
      .then(data => {
        setIssuers(data.filter(i => i.status !== 'pending'));
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  function handleStatusSelect(username: string, newStatus: string) {
    setPendingStatus(prev => ({ ...prev, [username]: newStatus }));
  }

  async function handleApply(username: string) {
    const target = pendingStatus[username];
    if (!target) return;

    const issuer = issuers.find(i => i.username === username);
    if (!issuer || issuer.status === target) return;

    const messages: Record<string, string> = {
      active: `Re-activate @${username}?`,
      revoked: `Revoke @${username}? They will lose dashboard access. Existing cards remain redeemable.`,
      banned: `Ban @${username}? This will also block redemption of their existing cards.`,
    };
    if (!confirm(messages[target] || `Change @${username} to ${target}?`)) return;

    setError('');
    setActing(username);
    try {
      let updated: IssuerRecord;
      if (target === 'revoked') {
        updated = await apiRevoke(username);
      } else if (target === 'banned') {
        updated = await apiBan(username);
      } else {
        setError(`Cannot transition to '${target}' from admin panel`);
        return;
      }
      setIssuers(prev => prev.map(i => i.username === username ? { ...i, status: updated.status } as IssuerWithStats : i));
      setPendingStatus(prev => { const next = { ...prev }; delete next[username]; return next; });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(null);
    }
  }

  if (loading) return html`<div class="loading"><span class="spinner" /> Loading...</div>`;
  if (error) return html`<p class="err">${error}</p>`;

  if (issuers.length === 0) {
    return html`<p class="tm">No active issuers yet.</p>`;
  }

  return html`
    <table class="table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Status</th>
          <th>Batches</th>
          <th>Cards</th>
          <th>Claimed</th>
          <th>Since</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${issuers.map(i => {
          const selected = pendingStatus[i.username] || i.status;
          const changed = selected !== i.status;
          return html`
            <tr key=${i.username}>
              <td class="mono">@${i.username}</td>
              <td>
                <select
                  value=${selected}
                  onInput=${(e: Event) => handleStatusSelect(i.username, (e.target as HTMLSelectElement).value)}
                  disabled=${acting === i.username}
                  style="width:auto;margin:0;padding:4px 8px;font-size:.85rem"
                >
                  ${i.status === 'approved' && html`<option value="approved">Approved</option>`}
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                  <option value="banned">Banned</option>
                </select>
              </td>
              <td>${i.batch_count}</td>
              <td>${i.total_cards}</td>
              <td>${i.claimed_cards}</td>
              <td>${formatDate(i.approved_at || i.applied_at)}</td>
              <td>
                ${changed && html`
                  <button
                    class="btn-sm"
                    onClick=${() => handleApply(i.username)}
                    disabled=${acting === i.username}
                  >
                    ${acting === i.username ? html`<span class="spinner" />` : 'Apply'}
                  </button>
                `}
              </td>
            </tr>
          `;
        })}
      </tbody>
    </table>
  `;
}

export function Admin() {
  const [tab, setTab] = useState<'pending' | 'active'>('pending');

  return html`
    <div class="ct">
      <h1>Admin Panel</h1>

      <div class="tabs">
        <button
          class="tab ${tab === 'pending' ? 'active' : ''}"
          onClick=${() => setTab('pending')}
        >Pending Applications</button>
        <button
          class="tab ${tab === 'active' ? 'active' : ''}"
          onClick=${() => setTab('active')}
        >Active Issuers</button>
      </div>

      <div class="mt1">
        ${tab === 'pending' ? html`<${PendingList} />` : html`<${ActiveList} />`}
      </div>
    </div>
  `;
}
