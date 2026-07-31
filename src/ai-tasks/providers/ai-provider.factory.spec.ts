import { createAiProvider } from './ai-provider.factory';
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
