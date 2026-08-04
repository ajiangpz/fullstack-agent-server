/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

  it('requests structured output and returns a validated result', async () => {
    create.mockResolvedValue({
      output_text: ' {"answer":"answer","keyPoints":["point"]} ',
    });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).resolves.toEqual({
      answer: 'answer',
      keyPoints: ['point'],
    });
    expect(create).toHaveBeenCalledWith({
      model: 'test-model',
      input: 'hello',
      instructions: 'Answer briefly.',
      max_output_tokens: 100,
      text: {
        format: expect.objectContaining({
          type: 'json_schema',
          name: 'ai_task_result',
          strict: true,
        }),
      },
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

  it('rejects JSON that does not match the runtime schema', async () => {
    create.mockResolvedValue({
      output_text: '{"answer":"answer","keyPoints":"not-an-array"}',
    });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        message: expect.stringContaining('AI response validation failed'),
        retryable: true,
      }),
    );
  });

  it('cleans a fenced JSON response before parsing and validation', async () => {
    create.mockResolvedValue({
      output_text: '```json\n{"answer":"answer","keyPoints":["point"]}\n```',
    });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).resolves.toEqual({
      answer: 'answer',
      keyPoints: ['point'],
    });
  });

  it('rejects JSON mixed with explanatory text', async () => {
    create.mockResolvedValue({
      output_text: 'Result: {"answer":"answer","keyPoints":["point"]}',
    });
    const provider = new OpenAiProvider(options, client);

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        message: 'AI response is not valid JSON',
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
