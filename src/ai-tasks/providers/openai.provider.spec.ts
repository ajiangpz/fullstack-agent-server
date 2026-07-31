import OpenAI from 'openai';
import { AiProviderError } from './ai-provider';
import { OpenAiProvider, OpenAiProviderOptions } from './openai.provider';

describe('OpenAiProvider', () => {
  const options: OpenAiProviderOptions = {
    apiKey: 'test-key',
    model: 'test-model',
    timeoutMs: 1_000,
    maxRetries: 0,
    maxOutputTokens: 100,
    instructions: 'Answer briefly.',
  };
  const create = jest.fn();
  const client = {
    responses: { create },
  } as unknown as Pick<OpenAI, 'responses'>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the Responses API and returns trimmed output text', async () => {
    create.mockResolvedValue({ output_text: ' answer ' });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).resolves.toBe(
      'answer',
    );
    expect(create).toHaveBeenCalledWith({
      model: 'test-model',
      input: 'hello',
      instructions: 'Answer briefly.',
      max_output_tokens: 100,
    });
  });

  it('treats an empty response as retryable', async () => {
    create.mockResolvedValue({ output_text: '  ' });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        message: 'OpenAI returned an empty text response',
        retryable: true,
      }),
    );
  });

  it('normalizes authentication errors as non-retryable', async () => {
    create.mockRejectedValue(
      new OpenAI.AuthenticationError(
        401,
        { message: 'invalid key' },
        'invalid key',
        new Headers(),
      ),
    );
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        message: 'OpenAI authentication failed',
        retryable: false,
      }),
    );
  });

  it('normalizes timeouts as retryable', async () => {
    create.mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        message: 'OpenAI request timed out',
        retryable: true,
      }),
    );
  });
});
