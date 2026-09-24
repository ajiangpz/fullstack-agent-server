import {
  buildAgentInstructions,
  createAiProvider,
} from './ai-provider.factory';
import { DeepSeekProvider } from './deepseek.provider';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiProvider } from './openai.provider';

describe('createAiProvider', () => {
  it('uses the mock provider by default', () => {
    expect(createAiProvider({})).toBeInstanceOf(MockAiProvider);
  });

  it('creates the OpenAI provider when required configuration exists', () => {
    expect(
      createAiProvider({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL: 'test-model',
      }),
    ).toBeInstanceOf(OpenAiProvider);
  });

  it('fails fast when OpenAI credentials are missing', () => {
    expect(() =>
      createAiProvider({
        AI_PROVIDER: 'openai',
        OPENAI_MODEL: 'test-model',
      }),
    ).toThrow('OPENAI_API_KEY is required');
  });

  it('creates the DeepSeek provider when required configuration exists', () => {
    expect(
      createAiProvider({
        AI_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
        DEEPSEEK_MODEL: 'deepseek-flash',
      }),
    ).toBeInstanceOf(DeepSeekProvider);
  });

  it('fails fast when DeepSeek credentials are missing', () => {
    expect(() =>
      createAiProvider({
        AI_PROVIDER: 'deepseek',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
        DEEPSEEK_MODEL: 'deepseek-flash',
      }),
    ).toThrow('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek');
  });

  it('always keeps topology tool-grounding instructions', () => {
    const instructions = buildAgentInstructions('Custom product guidance.');

    expect(instructions).toContain('use the available tools instead of guessing');
    expect(instructions).toContain('not an L3 routing-table');
    expect(instructions).toContain('Custom product guidance.');
  });

  it('rejects unsupported providers', () => {
    expect(() => createAiProvider({ AI_PROVIDER: 'unknown' })).toThrow(
      'Unsupported AI_PROVIDER "unknown"',
    );
  });

  it('rejects invalid numeric configuration', () => {
    expect(() =>
      createAiProvider({
        AI_PROVIDER: 'mock',
        MOCK_AI_DELAY_MS: '-1',
      }),
    ).toThrow('MOCK_AI_DELAY_MS must be an integer');
  });
});
