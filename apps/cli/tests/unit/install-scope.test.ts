import { describe, expect, it } from 'vitest';
import { resolveInstallScope } from '../../src/lib/install-scope';

describe('resolveInstallScope', () => {
  it('resolves explicit scope flags', async () => {
    await expect(resolveInstallScope({ global: true }, false)).resolves.toBe(
      true
    );
    await expect(resolveInstallScope({ project: true }, false)).resolves.toBe(
      false
    );
  });

  it('requires explicit scope in non-interactive mode', async () => {
    await expect(resolveInstallScope({}, false)).rejects.toThrow(
      'Install scope not specified. Use --project or --global.'
    );
  });

  it('rejects conflicting scope flags', async () => {
    await expect(
      resolveInstallScope({ project: true, global: true }, false)
    ).rejects.toThrow('--project and --global are mutually exclusive');
  });
});
