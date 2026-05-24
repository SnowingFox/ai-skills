import { cache } from 'react';
import {
  type CursorPlugin,
  HttpCursorMarketplaceUpstream,
} from './cursor-upstream';

const upstream = new HttpCursorMarketplaceUpstream();

/**
 * Request-scoped fetch of the full Cursor plugin catalog. The Cursor API
 * returns ~140 plugins in a single call, so we cache the full list and let
 * callers (detail page / owner page / leaderboard) filter in-memory.
 */
export const getCursorPlugins = cache(async (): Promise<CursorPlugin[]> => {
  return upstream.listPlugins();
});

/**
 * Find a plugin by owner + Cursor plugin name. Owner is the GitHub owner
 * derived from `repositoryUrl`, not the Cursor publisher.
 */
export async function findCursorPlugin(
  owner: string,
  name: string
): Promise<CursorPlugin | null> {
  const plugins = await getCursorPlugins();
  return (
    plugins.find((plugin) => plugin.owner === owner && plugin.name === name) ??
    null
  );
}

/**
 * List all plugins owned by a given GitHub owner.
 */
export async function listCursorPluginsByOwner(
  owner: string
): Promise<CursorPlugin[]> {
  const plugins = await getCursorPlugins();
  return plugins.filter((plugin) => plugin.owner === owner);
}
