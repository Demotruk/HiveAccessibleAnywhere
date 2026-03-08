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
