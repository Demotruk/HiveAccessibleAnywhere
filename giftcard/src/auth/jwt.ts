/**
 * JWT utilities for dashboard session management.
 */

import jwt from 'jsonwebtoken';

const TOKEN_EXPIRY = '24h';

/**
 * Create a signed JWT for an authenticated issuer.
 */
export function signJwt(username: string, secret: string): string {
  return jwt.sign({ sub: username }, secret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT. Returns the decoded payload or null if invalid.
 */
export function verifyJwt(token: string, secret: string): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, secret) as { sub?: string };
    if (typeof decoded.sub !== 'string') return null;
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}
