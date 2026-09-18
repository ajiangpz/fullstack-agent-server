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
        tool_choice: 'required',
        tools: [
          expect.objectContaining({
            function: expect.objectContaining({ name: 'get_device' }),
          }),
        ],
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ response_format: expect.anything() }),
    );
  });

  it('converts a content-based tool request into a tool call', async () => {
    create.mockResolvedValue({
      id: 'completion-1',
      model: 'deepseek-flash',
      choices: [
        {
          message: {
            content: '{"name":"get_device","arguments":{"deviceId":1}}',
          },
        },
      ],
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'tool_call',
      model: 'deepseek-flash',
      inputTokens: undefined,
      outputTokens: undefined,
      toolCalls: [
        {
          id: 'completion-1-content-tool-call',
          name: 'get_device',
          arguments: { deviceId: 1 },
        },
      ],
    });
  });

  it('converts a serialized native tool call into a tool call', async () => {
    create.mockResolvedValue({
      id: 'completion-2',
      model: 'deepseek-flash',
      choices: [
        {
          message: {
            content: JSON.stringify({
              id: 'call-2',
              type: 'function',
              function: {
                name: 'get_device',
                arguments: '{"deviceId":2}',
              },
            }),
          },
        },
      ],
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'tool_call',
      model: 'deepseek-flash',
      inputTokens: undefined,
      outputTokens: undefined,
      toolCalls: [
        {
          id: 'call-2',
          name: 'get_device',
          arguments: { deviceId: 2 },
        },
      ],
    });
  });

  it('allows a final answer after a tool result is available', async () => {
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

    await provider.generateWithTools({
      ...request,
      messages: [
        ...request.messages,
        {
          role: 'assistant',
          content:
            '{"toolCallId":"call-1","name":"get_device","arguments":{"deviceId":1}}',
        },
        {
          role: 'tool',
          content: '{"toolCallId":"call-1","result":{"id":1}}',
        },
      ],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          {
            role: 'assistant',
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
          {
            role: 'tool',
            tool_call_id: 'call-1',
            content: '{"result":{"id":1}}',
          },
        ]),
      }),
    );
  });

  it('rejects a final response before a required tool call', async () => {
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

    await expect(provider.generateWithTools(request)).rejects.toThrow(
      'DeepSeek did not return a required tool call',
    );
  });
});
