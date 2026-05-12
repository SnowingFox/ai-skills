import { SilentError } from '../errors';
import type { SourceRegistry } from './types';

/**
 * Stub registry for the marketplace provider. All operations throw
 * {@link SilentError} until marketplace zip installation is implemented.
 */
export const marketplaceRegistry: SourceRegistry = {
  kind: 'marketplace',
  resolve: async () => {
    throw new SilentError(
      'Marketplace zip installation is not implemented yet'
    );
  },
  materialize: async () => {
    throw new SilentError(
      'Marketplace zip installation is not implemented yet'
    );
  },
  update: async () => {
    throw new SilentError('Marketplace updates are not implemented yet');
  },
};
