/**
 * Application page — "Become an Onboarder" form.
 *
 * Broadcasts propolis_issuer_apply custom_json via Keychain,
 * then registers the application with the backend.
 */

import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { state } from '../state.js';
import { isKeychainAvailable, broadcastCustomJson } from '../auth.js';
import { submitApplication } from '../api.js';
import type { IssuerRecord } from '../types.js';

declare const __API_BASE__: string;

export function Apply() {
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IssuerRecord | null>(null);

  // If user already has an issuer record, show status
  if (state.issuerStatus) {
    const s = state.issuerStatus;
    return html`
      <div class="ct">
        <div class="card center">
          <h2>Application Status</h2>
          <p>You applied on ${new Date(s.applied_at).toLocaleDateString()}.</p>
          <p>Status: <span class="badge badge-${s.status}">${s.status}</span></p>
          ${s.status === 'pending' && html`
            <p class="tm mt1">Your application is being reviewed. You'll receive a notification on Hive when it's approved.</p>
          `}
          ${s.status === 'approved' && html`
            <p class="mt1"><a href="#setup">Complete your setup →</a></p>
          `}
          ${s.status === 'active' && html`
            <p class="mt1"><a href="#batches">Go to your dashboard →</a></p>
          `}
        </div>
      </div>
    `;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!description.trim()) return;

    setError('');
    setSubmitting(true);

    try {
      if (!isKeychainAvailable()) {
        throw new Error('Hive Keychain extension is required. Please install it and refresh.');
      }

      // Determine service account from API base URL context
      const serviceAccount = __API_BASE__ ? 'haa-giftcard' : 'haa-giftcard';

      // Broadcast custom_json on-chain via Keychain
      const txResult = await broadcastCustomJson(
        state.username!,
        'propolis_issuer_apply',
        'Posting',
        {
          service: serviceAccount,
          description: description.trim(),
          contact: contact.trim() || undefined,
        },
        'Apply to become an onboarder on HiveInvite',
      );

      // Register with backend — txResult may be an object {id, tx_id, confirmed} or a string
      const txId = typeof txResult === 'object' && txResult !== null
        ? (txResult as Record<string, unknown>).tx_id as string ?? (txResult as Record<string, unknown>).id as string
        : String(txResult);
      const issuer = await submitApplication(
        description.trim(),
        contact.trim() || undefined,
        txId,
      );

      setResult(issuer);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return html`
      <div class="ct">
        <div class="card center">
          <h2 style="color:var(--ok)">Application Submitted</h2>
          <p>Your application has been recorded on-chain and is pending review.</p>
          <p class="tm mt1">You'll receive a notification on Hive when your application is approved.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="ct">
      <h1>Become an Onboarder</h1>
      <p class="tm">Apply to issue Hive gift cards and onboard new users to the Hive blockchain.</p>

      <form class="card" onSubmit=${handleSubmit}>
        <div class="form-row">
          <label for="description">Description *</label>
          <textarea
            id="description"
            rows="3"
            placeholder="Tell us about your community and how you plan to use gift cards..."
            value=${description}
            onInput=${(e: Event) => setDescription((e.target as HTMLTextAreaElement).value)}
            disabled=${submitting}
            required
          />
        </div>

        <div class="form-row">
          <label for="contact">Contact (optional)</label>
          <input
            id="contact"
            type="text"
            placeholder="Telegram, Discord, or other contact method"
            value=${contact}
            onInput=${(e: Event) => setContact((e.target as HTMLInputElement).value)}
            disabled=${submitting}
          />
        </div>

        <button type="submit" disabled=${submitting || !description.trim()}>
          ${submitting
            ? html`<span class="spinner" /> Broadcasting...`
            : 'Submit Application'}
        </button>

        ${error && html`<p class="err mt1">${error}</p>`}
      </form>

      <div class="notice mt1">
        <strong>What happens next?</strong>
        <p>Your application will be broadcast on the Hive blockchain (signed with your posting key) and reviewed by the service operator. Once approved, you'll receive a Hive transfer notification with a link to complete your setup.</p>
      </div>
    </div>
  `;
}
