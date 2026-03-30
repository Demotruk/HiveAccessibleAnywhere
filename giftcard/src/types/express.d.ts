import 'express';

declare module 'express' {
  interface Request {
    /** Authenticated user's Hive username, set by requireAuth middleware */
    issuer?: string;
    /** User's role: admin, issuer (active), or applicant (default) */
    role?: 'admin' | 'issuer' | 'applicant';
  }
}
