/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import OpenAI from 'openai';
import {
  DeepSeekProvider,
  DeepSeekProviderOptions,
  normalizeDeepSeekBaseUrl,
} from './deepseek.provider';

describe('normalizeDeepSeekBaseUrl', () => {
  it('removes the chat completions suffix from a full endpoint URL', () => {
    expect(
      normalizeDeepSeekBaseUrl(
        'https://example.com/openai/v1/chat/completions/',
      ),
    ).toBe('https://example.com/openai/v1');
  });

  it('keeps an API root URL unchanged', () => {
    expect(normalizeDeepSeekBaseUrl('https://api.deepseek.com')).toBe(
      'https://api.deepseek.com',
    );
  });
});

describe('DeepSeekProvider', () => {
  const options: DeepSeekProviderOptions = {
    apiKey: 'test-key',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    timeoutMs: 1_000,
    maxRetries: 0,
  };
  const create = jest.fn();
  const client = { chat: { completions: { create } } } as unknown as Pick<
    OpenAI,
    'chat'
  >;
  const provider = new DeepSeekProvider(options, client);
  const request = {
    messages: [{ role: 'user' as const, content: 'device?' }],
    tools: [
      {
        name: 'get_device',
        description: 'Get device',
        parameters: { type: 'object' },
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns a tool-call response with parsed arguments', async () => {
    create.mockResolvedValue({
      model: 'deepseek-flash',
      usage: { prompt_tokens: 10, completion_tokens: 3 },
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'get_device',
                  arguments: '{"deviceId":1}',
                },
              },
            ],
          },
        },
      ],
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'tool_call',
      model: 'deepseek-flash',
      inputTokens: 10,
      outputTokens: 3,
      toolCalls: [
        { id: 'call-1', name: 'get_device', arguments: { deviceId: 1 } },
      ],
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-flash',
        response_format: { type: 'json_object' },
        tool_choice: 'auto',
        tools: [
          expect.objectContaining({
            function: expect.objectContaining({ name: 'get_device' }),
          }),
        ],
      }),
    );
  });

  it('returns a final response when no tool call is present', async () => {
    create.mockResolvedValue({
      model: 'deepseek-flash',
      choices: [
        {
          message: {
            content: '{"answer":"device 1","keyPoints":[]}',
          },
        },
      ],
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'final',
      model: 'deepseek-flash',
      content: '{"answer":"device 1","keyPoints":[]}',
    });
  });
});
