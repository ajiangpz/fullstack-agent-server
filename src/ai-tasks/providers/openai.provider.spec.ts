/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ text: expect.anything() }),
    );
  });

  it('returns user-visible text when no tool call is present', async () => {
    create.mockResolvedValue({
      model: 'test-model',
      output: [],
      output_text: 'device 1',
    });

    await expect(provider.generateWithTools(request)).resolves.toEqual({
      type: 'final',
      model: 'test-model',
      content: 'device 1',
    });
  });

  it('streams only user-visible text deltas', async () => {
    async function* events() {
      await Promise.resolve();
      yield { type: 'response.output_text.delta', delta: 'device ' };
      yield { type: 'response.output_text.delta', delta: '1' };
      yield {
        type: 'response.completed',
        response: {
          model: 'test-model',
          usage: { input_tokens: 12, output_tokens: 4 },
        },
      };
    }

    create.mockResolvedValue(events());
    const deltas: string[] = [];

    await expect(
      provider.streamFinalAnswer(request, (delta) => deltas.push(delta)),
    ).resolves.toEqual({
      type: 'final',
      model: 'test-model',
      inputTokens: 12,
      outputTokens: 4,
      content: 'device 1',
    });

    expect(deltas).toEqual(['device ', '1']);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        tools: [],
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ text: expect.anything() }),
    );
  });

  it('extracts key points with a separate structured-output call', async () => {
    create.mockResolvedValue({
      model: 'test-model',
      usage: { input_tokens: 8, output_tokens: 2 },
      output_text: '{"keyPoints":["device 1"]}',
    });

    await expect(provider.generateKeyPoints('device 1')).resolves.toEqual({
      model: 'test-model',
      inputTokens: 8,
      outputTokens: 2,
      keyPoints: ['device 1'],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [{ role: 'user', content: 'device 1' }],
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'ai_task_key_points',
          }),
        }),
      }),
    );
  });
});
