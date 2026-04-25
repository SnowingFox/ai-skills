import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { createAuth } from './auth';

/**
 * Get the current session
 *
 * ⚠️ IMPORTANT: In Cloudflare Workers environment, auth must be created per-request
 * because Hyperdrive binding is only available in request context.
 *
 * The React cache() ensures that within a single request/render, we only create
 * the auth instance once, avoiding redundant initialization.
 *
 * NOTICE: do not call it from middleware
 */
export const getSession = cache(async () => {
  const auth = await createAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
});
