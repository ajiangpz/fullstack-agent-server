import OpenAI from 'openai';
import { OpenAiProvider, OpenAiProviderOptions } from './openai.provider';

describe('OpenAiProvider', () => {
  const options: OpenAiProviderOptions = {
    apiKey: 'test-key',
    model: 'test-model',
    timeoutMs: 1_000,
    maxRetries: 0,
  };
  const create = jest.fn();
  const client = { responses: { create } } as unknown as Pick<
    OpenAI,
    'responses'
  >;
  const provider = new OpenAiProvider(options, client);
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
      model: 'test-model',
      usage: { input_tokens: 10, output_tokens: 3 },
      output: [
        {
          type: 'function_call',
          call_id: 'call-1',
          name: 'get_device',
          arguments: '{"deviceId":1}',
        },
      ],
      output_text: '',
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'tool_call',
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 3,
      toolCalls: [
        { id: 'call-1', name: 'get_device', arguments: { deviceId: 1 } },
      ],
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: 'auto',
        tools: [expect.objectContaining({ name: 'get_device' })],
      }),
    );
  });

  it('returns a final response when no tool call is present', async () => {
    create.mockResolvedValue({
      model: 'test-model',
      output: [],
      output_text: '{"answer":"device 1","keyPoints":[]}',
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'final',
      model: 'test-model',
      content: '{"answer":"device 1","keyPoints":[]}',
    });
  });
  it('adapts the final response to the streaming provider contract', async () => {
    create.mockResolvedValue({
      model: 'test-model',
      output: [],
      output_text: '{"answer":"device 1","keyPoints":[]}',
    });
    const deltas: string[] = [];

    await expect(
      provider.streamFinalAnswer(request, (delta) => deltas.push(delta)),
    ).resolves.toEqual({
      type: 'final',
      model: 'test-model',
      content: '{"answer":"device 1","keyPoints":[]}',
    });

    expect(deltas).toEqual(['{"answer":"device 1","keyPoints":[]}']);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [],
        text: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema' }),
        }),
      }),
    );
  });

});
