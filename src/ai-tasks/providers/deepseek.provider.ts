import OpenAI from 'openai';
import type {
  AiGenerateWithToolsOptions,
  AiProvider,
  AiResponse,
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
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [
          {
            role: 'system',
            content: [
              this.options.instructions,
              'Return the final answer as a JSON object with answer and keyPoints fields.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          ...messages.map((message) => ({
            role: message.role === 'tool' ? ('user' as const) : message.role,
            content: message.content,
          })),
        ],
        max_tokens: this.options.maxOutputTokens,
        response_format: { type: 'json_object' },
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
              tool_choice: 'auto' as const,
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

      return { type: 'final', content, ...metadata };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
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
