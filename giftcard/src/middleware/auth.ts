/**
 * JWT authentication middleware for dashboard API routes.
 *
 * Three tiers:
 * - requireAuth: validates JWT, determines role, sets req.issuer + req.role
 * - requireIssuer: requireAuth + role must be 'issuer' or 'admin'
 * - requireAdmin: requireAuth + role must be 'admin'
 */

import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import type { GiftcardConfig } from '../config.js';
import { isAdmin } from '../config.js';
import { verifyJwt } from '../auth/jwt.js';
import { isIssuerActive } from '../db.js';

/**
 * Express middleware that requires a valid JWT and determines the user's role.
 *
 * Role resolution order:
 * 1. Admin: matches serviceAccount, providerAccount (single-tenant), or adminAccounts
 * 2. Issuer: DB status='active' OR in allowedProviders env var (backward compat)
 * 3. Applicant: any other authenticated user
 */
export function requireAuth(config: GiftcardConfig, db: Database.Database) {
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
    req.issuer = username;

    // Determine role
    if (isAdmin(config, username)) {
      req.role = 'admin';
    } else if (isIssuerActive(db, username) || config.allowedProviders?.has(username)) {
      req.role = 'issuer';
    } else {
      req.role = 'applicant';
    }

    next();
  };
}

/**
 * Middleware that requires an active issuer or admin.
 */
export function requireIssuer(config: GiftcardConfig, db: Database.Database) {
  const auth = requireAuth(config, db);
  return (req: Request, res: Response, next: NextFunction): void => {
    auth(req, res, () => {
      if (req.role !== 'issuer' && req.role !== 'admin') {
        res.status(403).json({ error: 'Not an authorized issuer' });
        return;
      }
      next();
    });
  };
}

/**
 * Middleware that requires admin access.
 */
export function requireAdmin(config: GiftcardConfig, db: Database.Database) {
  const auth = requireAuth(config, db);
  return (req: Request, res: Response, next: NextFunction): void => {
    auth(req, res, () => {
      if (req.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }
      next();
    });
  };
}
