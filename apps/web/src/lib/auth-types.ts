import type { createAuth } from './auth';

// https://www.better-auth.com/docs/concepts/typescript#additional-fields
// Note: Since we use factory pattern (createAuth), we infer the auth type first
type Auth = Awaited<ReturnType<typeof createAuth>>;

export type Session = Auth['$Infer']['Session'];

export type SessionUser = Auth['$Infer']['Session']['user'];
