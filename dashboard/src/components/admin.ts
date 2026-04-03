/**
 * Admin panel — manage issuer applications and view active issuers.
 */

import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { state } from '../state.js';
import { listIssuers, approveIssuer as apiApprove } from '../api.js';
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
      .then(data => { setIssuers(data); setLoading(false); })
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

      // Remove from pending list
      setIssuers(prev => prev.filter(i => i.username !== username));
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

  useEffect(() => {
    listIssuers()
      .then(data => {
        setIssuers(data.filter(i => i.status === 'active' || i.status === 'approved'));
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

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
        </tr>
      </thead>
      <tbody>
        ${issuers.map(i => html`
          <tr key=${i.username}>
            <td class="mono">@${i.username}</td>
            <td><span class="badge badge-${i.status}">${i.status}</span></td>
            <td>${i.batch_count}</td>
            <td>${i.total_cards}</td>
            <td>${i.claimed_cards}</td>
            <td>${formatDate(i.approved_at || i.applied_at)}</td>
          </tr>
        `)}
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
