/**
 * Wallet chunk fetcher — loads and verifies the Propolis wallet from
 * on-chain Hive posts.
 *
 * Replicates the logic from the standalone bootstrap HTML files
 * (docs/propolis-bootstrap-*.html) as a proper TypeScript module.
 */

import type { HiveClient, DiscussionPost } from './client';

/** The publisher account whose posts contain the wallet code. */
const PUBLISHER = 'propolis-publish';

/** Single entry in the on-chain wallet manifest. */
export interface ManifestEntry {
  permlink: string;
  hash: string;
}

/** Metadata stored in the root post's json_metadata.propolis field. */
export interface WalletManifest {
  version: string;
  locale: string;
  hash: string;
  manifest: ManifestEntry[];
}

/** Progress callback: (currentChunk, totalChunks) */
export type ProgressCallback = (current: number, total: number) => void;

/** Result of fetchWalletDiscussion — cached for reuse across phases. */
export interface WalletDiscussion {
  manifest: WalletManifest;
  comments: Record<string, string>;
}

/**
 * SHA-256 hex digest of a string (Web Crypto API).
 */
async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Strip code fences (``` blocks) from a comment body to extract raw content.
 */
function stripCodeFences(body: string): string {
  const m = body.match(/```\n([\s\S]*?)\n```/);
  if (m) return m[1];
  return body.replace(/^```\n?/, '').replace(/\n?```$/, '');
}

/**
 * Fetch the discussion tree for a wallet post and extract the manifest
 * and comment bodies. The result can be cached and reused across the
 * bootstrap file generation (Phase 2) and wallet loading (Phase 3).
 */
export async function fetchWalletDiscussion(
  client: HiveClient,
  locale: string,
): Promise<WalletDiscussion> {
  const permlink = `propolis-wallet-v1-${locale}`;
  const discussion = await client.getDiscussion(PUBLISHER, permlink);

  // Find the root post and parse its manifest
  const rootKey = `${PUBLISHER}/${permlink}`;
  const rootPost = discussion[rootKey];
  if (!rootPost) {
    throw new Error(`Root post not found: ${rootKey}`);
  }

  // bridge.get_discussion returns json_metadata as object or string depending on node
  let metadata: { propolis?: WalletManifest };
  if (typeof rootPost.json_metadata === 'string') {
    try {
      metadata = JSON.parse(rootPost.json_metadata);
    } catch {
      throw new Error('Failed to parse root post json_metadata');
    }
  } else {
    metadata = rootPost.json_metadata as unknown as { propolis?: WalletManifest };
  }

  if (!metadata.propolis) {
    throw new Error('Root post missing propolis metadata');
  }

  const manifest = metadata.propolis;
  if (!manifest.manifest || !manifest.hash) {
    throw new Error('Invalid propolis manifest: missing manifest array or hash');
  }

  // Extract comment bodies keyed by permlink (publisher-authored only)
  const comments: Record<string, string> = {};
  for (const key of Object.keys(discussion)) {
    const post = discussion[key];
    if (post.author === PUBLISHER && post.parent_author === PUBLISHER) {
      comments[post.permlink] = post.body;
    }
  }

  return { manifest, comments };
}

/**
 * Assemble and verify the wallet HTML from a previously fetched discussion.
 *
 * Walks the manifest entries, extracts code-fenced content from comments,
 * verifies each chunk's SHA-256 hash, then verifies the assembled whole.
 *
 * @param discussion - Result from fetchWalletDiscussion()
 * @param onProgress - Optional callback fired after each chunk is verified
 * @returns The complete wallet HTML string
 */
export async function assembleWallet(
  discussion: WalletDiscussion,
  onProgress?: ProgressCallback,
): Promise<string> {
  const { manifest, comments } = discussion;
  const chunks: string[] = [];
  const total = manifest.manifest.length;

  for (let i = 0; i < total; i++) {
    const entry = manifest.manifest[i];
    const body = comments[entry.permlink];
    if (!body) {
      throw new Error(`Missing chunk comment: ${entry.permlink}`);
    }

    const content = stripCodeFences(body);

    // Verify individual chunk hash
    const h = await sha256hex(content);
    if (h !== entry.hash) {
      throw new Error(
        `Hash mismatch for ${entry.permlink}: expected ${entry.hash.slice(0, 16)}..., got ${h.slice(0, 16)}...`,
      );
    }

    chunks.push(content);
    onProgress?.(i + 1, total);
  }

  // Verify assembled whole
  const assembled = chunks.join('');
  const fullHash = await sha256hex(assembled);
  if (fullHash !== manifest.hash) {
    throw new Error(
      `Full wallet hash mismatch: expected ${manifest.hash.slice(0, 16)}..., got ${fullHash.slice(0, 16)}...`,
    );
  }

  return assembled;
}

/**
 * High-level: fetch wallet from chain and return assembled HTML.
 * Convenience wrapper that calls fetchWalletDiscussion + assembleWallet.
 */
export async function fetchWalletFromChain(
  client: HiveClient,
  locale: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const discussion = await fetchWalletDiscussion(client, locale);
  return assembleWallet(discussion, onProgress);
}
