import { apiKeyClient } from '@better-auth/api-key/client';
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { createAuth } from './auth';
import { getBaseUrl } from './urls';

/**
 * https://www.better-auth.com/docs/installation#create-client-instance
 *
 * Note: Since we use factory pattern (createAuth), we infer the type using:
 * Awaited<ReturnType<typeof createAuth>>
 */
export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    // https://www.better-auth.com/docs/plugins/admin#add-the-client-plugin
    adminClient(),
    // https://www.better-auth.com/docs/plugins/api-key#add-the-client-plugin
    apiKeyClient(),
    // https://www.better-auth.com/docs/concepts/typescript#inferring-additional-fields-on-client
    inferAdditionalFields<Awaited<ReturnType<typeof createAuth>>>(),
  ],
});
