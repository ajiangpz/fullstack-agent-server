import OpenAI from 'openai';
import { parseAiTaskKeyPoints } from '../ai-task-result';
import type {
  AiFinalResponse,
  AiGenerateWithToolsOptions,
  AiKeyPointsResponse,
  AiMessage,
  AiProvider,
  AiResponse,
  AiToolCall,
} from './ai-provider';
import { AiProviderError } from './ai-provider';

export interface DeepSeekProviderOptions {
  apiKey: string;
  baseURL: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens?: number;
  instructions?: string;
}

type ChatClient = Pick<OpenAI, 'chat'>;

export function normalizeDeepSeekBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/chat\/completions\/?$/, '');
}

export class DeepSeekProvider implements AiProvider {
  private readonly client: ChatClient;

  constructor(
    private readonly options: DeepSeekProviderOptions,
    client?: ChatClient,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: normalizeDeepSeekBaseUrl(options.baseURL),
        timeout: options.timeoutMs,
        maxRetries: options.maxRetries,
      });
  }

  async generateWithTools({
    messages,
    tools,
  }: AiGenerateWithToolsOptions): Promise<AiResponse> {
    try {
      const hasToolResult = messages.some((message) => message.role === 'tool');
      const requiresToolCall = tools.length > 0 && !hasToolResult;
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [
          {
            role: 'system',
            content: [
              this.options.instructions,
              requiresToolCall
                ? 'Call exactly one available tool before answering the user.'
                : 'Answer the user directly in Markdown. Do not wrap the answer in JSON.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          ...messages.map((message) => this.toDeepSeekMessage(message)),
        ],
        max_tokens: this.options.maxOutputTokens,
        ...(tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                type: 'function' as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  strict: true,
                  parameters: tool.parameters,
                },
              })),
              tool_choice: hasToolResult
                ? ('auto' as const)
                : ('required' as const),
            }
          : {}),
      });
      const message = response.choices[0]?.message;
      const metadata = {
        model: response.model,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
      const toolCalls = (message?.tool_calls ?? [])
        .filter((item) => item.type === 'function')
        .map((item) => ({
          id: item.id,
          name: item.function.name,
          arguments: this.parseToolArguments(item.function.arguments),
        }));

      if (toolCalls.length > 0) {
        return { type: 'tool_call', toolCalls, ...metadata };
      }

      const content = message?.content?.trim();
      if (!content) {
        throw new AiProviderError('DeepSeek returned an empty response', true);
      }

      const contentToolCall = this.parseContentToolCall(
        content,
        response.id,
        new Set(tools.map((tool) => tool.name)),
      );
      if (contentToolCall) {
        return { type: 'tool_call', toolCalls: [contentToolCall], ...metadata };
      }
      if (requiresToolCall) {
        throw new AiProviderError(
          'DeepSeek did not return a required tool call',
          true,
        );
      }

      return { type: 'final', content, ...metadata };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw this.normalizeError(error);
    }
  }

  async streamFinalAnswer(
    { messages }: AiGenerateWithToolsOptions,
    onTextDelta: (delta: string) => void,
  ): Promise<AiFinalResponse> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [
          {
            role: 'system',
            content: [
              this.options.instructions,
              'Answer the user directly in Markdown. Do not wrap the answer in JSON.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          ...messages.map((message) => this.toDeepSeekMessage(message)),
        ],
        max_tokens: this.options.maxOutputTokens,
        stream: true,
      });

      let content = '';
      let model = this.options.model;

      for await (const chunk of stream) {
        model = chunk.model || model;
        const delta = chunk.choices[0]?.delta?.content;
        if (typeof delta !== 'string' || delta.length === 0) continue;
        content += delta;
        onTextDelta(delta);
      }

      if (!content.trim()) {
        throw new AiProviderError('DeepSeek returned an empty response', true);
      }

      return { type: 'final', model, content: content.trim() };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw this.normalizeError(error);
    }
  }

  async generateKeyPoints(answer: string): Promise<AiKeyPointsResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [
          {
            role: 'system',
            content:
              'Extract concise key points from the supplied final answer. ' +
              'Do not rewrite the answer. Return a JSON object with only a keyPoints array.',
          },
          { role: 'user', content: answer },
        ],
        max_tokens: this.options.maxOutputTokens,
        response_format: { type: 'json_object' as const },
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new AiProviderError('DeepSeek returned empty key points', false);
      }

      let keyPoints: string[];
      try {
        keyPoints = parseAiTaskKeyPoints(content);
      } catch (error) {
        throw new AiProviderError(
          'DeepSeek returned invalid key points',
          false,
          { cause: error },
        );
      }

      return {
        model: response.model,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        keyPoints,
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw this.normalizeError(error);
    }
  }

  private parseToolArguments(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch (error) {
      throw new AiProviderError(
        'DeepSeek returned invalid tool arguments',
        true,
        { cause: error },
      );
    }
  }

  private parseContentToolCall(
    value: string,
    responseId: string | undefined,
    toolNames: Set<string>,
  ): AiToolCall | undefined {
    const parsed = this.parseObject(value);
    if (typeof parsed?.name === 'string' && 'arguments' in parsed) {
      return this.createContentToolCall(
        `${responseId ?? 'deepseek'}-content-tool-call`,
        parsed.name,
        parsed.arguments,
        toolNames,
      );
    }
    const fn = parsed?.function;
    if (
      parsed?.type === 'function' &&
      typeof fn === 'object' &&
      fn !== null &&
      'name' in fn &&
      typeof fn.name === 'string' &&
      'arguments' in fn
    ) {
      return this.createContentToolCall(
        typeof parsed.id === 'string'
          ? parsed.id
          : `${responseId ?? 'deepseek'}-content-tool-call`,
        fn.name,
        fn.arguments,
        toolNames,
      );
    }
    return undefined;
  }

  private createContentToolCall(
    id: string,
    name: string,
    args: unknown,
    toolNames: Set<string>,
  ): AiToolCall | undefined {
    if (!toolNames.has(name)) return undefined;
    return {
      id,
      name,
      arguments:
        typeof args === 'string' ? this.parseToolArguments(args) : args,
    };
  }

  private toDeepSeekMessage(
    message: AiMessage,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    const payload = this.parseObject(message.content);
    if (
      message.role === 'assistant' &&
      typeof payload?.toolCallId === 'string' &&
      typeof payload.name === 'string' &&
      'arguments' in payload
    ) {
      return {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: payload.toolCallId,
            type: 'function',
            function: {
              name: payload.name,
              arguments: JSON.stringify(payload.arguments),
            },
          },
        ],
      };
    }
    if (message.role === 'tool' && typeof payload?.toolCallId === 'string') {
      const { toolCallId, ...result } = payload;
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result),
      };
    }
    return {
      role: message.role === 'tool' ? 'user' : message.role,
      content: message.content,
    };
  }

  private parseObject(value: string): Record<string, unknown> | undefined {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeError(error: unknown): AiProviderError {
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new AiProviderError('DeepSeek request timed out', true, {
        cause: error,
      });
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return new AiProviderError('DeepSeek connection failed', true, {
        cause: error,
      });
    }
    if (error instanceof OpenAI.APIError) {
      const status = (error as { status?: unknown }).status;
      if (typeof status !== 'number') {
        return new AiProviderError('DeepSeek request failed', true, {
          cause: error,
        });
      }
      const retryable =
        status === 408 || status === 409 || status === 429 || status >= 500;
      const message =
        status === 401 || status === 403
          ? 'DeepSeek authentication failed'
          : `DeepSeek request failed with status ${status}`;
      return new AiProviderError(message, retryable, { cause: error });
    }
    return new AiProviderError('DeepSeek request failed', true, {
      cause: error,
    });
  }
}
