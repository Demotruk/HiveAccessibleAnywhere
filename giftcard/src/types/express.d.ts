import 'express';

declare module 'express' {
  interface Request {
    /** Authenticated issuer's Hive username, set by requireAuth middleware */
    issuer?: string;
  }
}
