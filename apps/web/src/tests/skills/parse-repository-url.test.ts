import { describe, expect, it } from 'vitest';
import { parseRepositoryUrl } from '@/skills/parse-repository-url';

describe('parseRepositoryUrl', () => {
  it('parses an https GitHub URL', () => {
    expect(parseRepositoryUrl('https://github.com/Foo/Bar')).toEqual({
      owner: 'Foo',
      repo: 'Bar',
    });
  });

  it('strips a .git suffix', () => {
    expect(parseRepositoryUrl('https://github.com/Foo/Bar.git')).toEqual({
      owner: 'Foo',
      repo: 'Bar',
    });
  });

  it('keeps only owner/repo when the URL has deeper segments', () => {
    expect(
      parseRepositoryUrl('https://github.com/Foo/Bar/tree/main/sub')
    ).toEqual({ owner: 'Foo', repo: 'Bar' });
  });

  it('parses an SSH URL', () => {
    expect(parseRepositoryUrl('git@github.com:Foo/Bar.git')).toEqual({
      owner: 'Foo',
      repo: 'Bar',
    });
  });

  it.each([
    [''],
    ['https://github.com/'],
    ['https://github.com/Foo'],
    ['not-a-url'],
    [null],
    [undefined],
  ])('returns null for invalid input %s', (input) => {
    expect(parseRepositoryUrl(input as string | null | undefined)).toBeNull();
  });
});
