import { describe, expect, it } from 'vitest';
import { canPrompt, isAICommand } from '../../src/cli/ai-mode';

describe('ai mode helpers', () => {
  it('detects strict ai mode', () => {
    expect(isAICommand({ ai: true })).toBe(true);
    expect(isAICommand({ ai: false })).toBe(false);
    expect(isAICommand({})).toBe(false);
  });

  it('suppresses prompts in ai mode', () => {
    expect(canPrompt({ ai: true })).toBe(false);
  });
});
