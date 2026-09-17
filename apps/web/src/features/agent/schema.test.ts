import { describe, expect, it } from 'vitest';
import { agentPromptSchema } from './schema';

describe('agentPromptSchema', () => {
  it('trims a valid prompt', () => {
    const result = agentPromptSchema.parse({ prompt: '  show offline devices  ' });
    expect(result.prompt).toBe('show offline devices');
  });

  it('rejects an empty prompt', () => {
    expect(agentPromptSchema.safeParse({ prompt: '   ' }).success).toBe(false);
  });

  it('rejects prompts longer than the backend limit', () => {
    expect(agentPromptSchema.safeParse({ prompt: 'a'.repeat(10_001) }).success).toBe(false);
  });
});
