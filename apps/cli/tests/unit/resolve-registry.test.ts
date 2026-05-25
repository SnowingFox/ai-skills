import { describe, expect, it } from 'vitest';
import { resolveRegistry } from '../../src/registries/resolve';

describe('resolveRegistry', () => {
  it('resolves GitHub shorthand to github', () => {
    expect(resolveRegistry('vercel-labs/skills')).toBe('github');
  });

  it('resolves GitHub full URL to github', () => {
    expect(resolveRegistry('https://github.com/mattpocock/skills')).toBe(
      'github'
    );
  });

  it('resolves github: prefix to github', () => {
    expect(resolveRegistry('github:owner/repo')).toBe('github');
  });

  it('resolves gitlab URL containing "gitlab" to gitlab', () => {
    expect(resolveRegistry('https://gitlab.example.com/group/repo.git')).toBe(
      'gitlab'
    );
  });

  it('resolves gitlab: prefix to gitlab', () => {
    expect(resolveRegistry('gitlab:group/repo')).toBe('gitlab');
  });

  it('resolves SSH URLs to gitlab via isFullGitCloneUrl', () => {
    expect(resolveRegistry('git@git.example.com:team/skills.git')).toBe(
      'gitlab'
    );
  });

  it('respects explicit registry override for shorthand', () => {
    expect(resolveRegistry('lynx/skills', 'gitlab')).toBe('gitlab');
  });

  it('resolves non-GitHub HTTPS URLs to gitlab (bug fix)', () => {
    expect(resolveRegistry('https://code.my-gitlab.org/story/skills')).toBe(
      'gitlab'
    );
  });

  it('resolves HTTP URLs to gitlab', () => {
    expect(resolveRegistry('http://git.internal.com/team/repo')).toBe('gitlab');
  });

  it('resolves non-GitHub SSH URLs to gitlab', () => {
    expect(resolveRegistry('git@code.my-gitlab.org:story/skills.git')).toBe(
      'gitlab'
    );
  });

  it('resolves file: prefix to file', () => {
    expect(resolveRegistry('file:./local')).toBe('file');
  });

  it('resolves relative path to file', () => {
    expect(resolveRegistry('./relative')).toBe('file');
  });

  it('resolves absolute path to file', () => {
    expect(resolveRegistry('/absolute/path')).toBe('file');
  });
});
