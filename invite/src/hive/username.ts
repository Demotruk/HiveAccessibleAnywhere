/**
 * Hive account name validation.
 * Copied from giftcard/src/hive/username.ts — pure function, no dependencies.
 */

export function isValidUsername(name: string): string | null {
  if (!name || typeof name !== 'string') return 'Username required';
  if (name !== name.toLowerCase()) return 'Username must be lowercase';
  if (name.length < 3) return 'Username must be at least 3 characters';
  if (name.length > 16) return 'Username must be 16 characters or fewer';
  if (!/^[a-z]/.test(name)) return 'Username must start with a letter';
  if (/[^a-z0-9\-.]/.test(name)) return 'Username may only contain lowercase letters, digits, hyphens, and dots';
  if (/[.\-]$/.test(name)) return 'Username must not end with a hyphen or dot';
  if (/\.\./.test(name)) return 'Username must not contain consecutive dots';
  if (/--/.test(name)) return 'Username must not contain consecutive hyphens';

  const segments = name.split('.');
  for (const seg of segments) {
    if (seg.length < 3) {
      return `Each segment must be at least 3 characters (segment "${seg}" is too short)`;
    }
  }

  return null;
}

/**
 * Generate alternative username candidates when a desired name is taken.
 * All returned candidates pass isValidUsername().
 */
export function generateSuggestions(base: string): string[] {
  const candidates: string[] = [];

  // Append single digits
  for (const n of [1, 2, 3]) {
    candidates.push(`${base}${n}`);
  }

  // Append double digits
  candidates.push(`${base}12`);
  candidates.push(`${base}01`);

  // Hyphen + digit
  candidates.push(`${base}-1`);

  // Suffix
  candidates.push(`${base}-hive`);

  // If base is long, try truncated variants
  if (base.length > 12) {
    const short = base.slice(0, 12);
    candidates.push(`${short}1`);
    candidates.push(`${short}-1`);
  }

  // Deduplicate and filter to valid names only
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return isValidUsername(c) === null;
  });
}
