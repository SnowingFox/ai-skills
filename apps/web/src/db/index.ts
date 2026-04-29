import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

/**
 * Get database connection for all routes
 *
 * Uses async getCloudflareContext({ async: true }) for compatibility.
 * Wrapped with React cache() to ensure single connection per request.
 *
 * Key improvements over original implementation:
 * 1. Uses React cache() instead of global variable for better request isolation
 * 2. Adds performance optimizations (max: 5, fetch_types: false)
 * 3. Each request gets a fresh connection, avoiding cross-request pollution
 *
 * Performance optimizations:
 * - max: 5 - Limit connections per Worker request (Cloudflare Workers limit)
 * - fetch_types: false - Disable fetch_types to avoid unnecessary round-trip
 *
 * Reference:
 * - https://opennext.js.org/cloudflare/howtos/db#hyperdrive-example
 * - https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/
 */
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });

  const sql = postgres(env.HYPERDRIVE.connectionString, {
    // Limit connections per Worker request (Cloudflare Workers limit on concurrent external connections)
    max: 5,
    // Disable fetch_types to avoid an additional round-trip for better performance
    // Only disable if you are not using array types in your Postgres schema
    fetch_types: false,
  });

  return drizzle(sql, { schema });
});
