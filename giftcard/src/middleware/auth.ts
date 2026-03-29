/**
 * JWT authentication middleware for dashboard API routes.
 *
 * Validates the Bearer token from the Authorization header,
 * checks that the issuer is in the allowed providers list,
 * and sets req.issuer for downstream handlers.
 */

import type { Request, Response, NextFunction } from 'express';
import type { GiftcardConfig } from '../config.js';
import { verifyJwt } from '../auth/jwt.js';

/**
 * Express middleware that requires a valid JWT from an allowed issuer.
 */
export function requireAuth(config: GiftcardConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    if (!config.jwtSecret) {
      res.status(500).json({ error: 'Dashboard API not configured' });
      return;
    }

    const decoded = verifyJwt(token, config.jwtSecret);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const username = decoded.sub.toLowerCase();

    // Check issuer is allowed
    if (config.allowedProviders) {
      if (!config.allowedProviders.has(username)) {
        res.status(403).json({ error: 'Not an authorized issuer' });
        return;
      }
    } else {
      // Single-tenant: must match the configured provider
      if (username !== config.providerAccount.toLowerCase()) {
        res.status(403).json({ error: 'Not an authorized issuer' });
        return;
      }
    }

    req.issuer = username;
    next();
  };
}
