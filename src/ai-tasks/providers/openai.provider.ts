import OpenAI from 'openai';
import { AI_TASK_RESULT_JSON_SCHEMA } from '../ai-task-result';
import type {
  AiGenerateWithToolsOptions,
  AiProvider,
  AiResponse,
} from './ai-provider';
import { AiProviderError } from './ai-provider';

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens?: number;
  instructions?: string;
}

type ResponsesClient = Pick<OpenAI, 'responses'>;

export class OpenAiProvider implements AiProvider {
  private readonly client: ResponsesClient;

  constructor(
    private readonly options: OpenAiProviderOptions,
    client?: ResponsesClient,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        timeout: options.timeoutMs,
        maxRetries: options.maxRetries,
      });
  }

  async generateWithTools({
    messages,
    tools,
  }: AiGenerateWithToolsOptions): Promise<AiResponse> {
    try {
      const response = await this.client.responses.create({
        model: this.options.model,
        // 当前请求使用普通消息重放工具结果；tool 角色映射为 API 接受的 user 角色。
        input: messages.map((message) => ({
          role: message.role === 'tool' ? ('user' as const) : message.role,
          content: message.content,
        })),
        instructions: this.options.instructions,
        max_output_tokens: this.options.maxOutputTokens,
        tools: tools.map((tool) => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          strict: true,
          parameters: tool.parameters,
        })),
        tool_choice: 'auto',
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_task_result',
            strict: true,
            schema: AI_TASK_RESULT_JSON_SCHEMA,
          },
        },
      });
      const metadata = {
        model: response.model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      };
      const toolCalls = response.output
        .filter((item) => item.type === 'function_call')
        .map((item) => ({
          id: item.call_id,
          name: item.name,
          arguments: this.parseToolArguments(item.arguments),
        }));

      if (toolCalls.length > 0) {
        // 只要响应包含函数调用，就交给 Agent 执行，不把伴随文本视为最终答案。
        return { type: 'tool_call', toolCalls, ...metadata };
      }

      const content = response.output_text.trim();
      if (!content) {
        throw new AiProviderError('OpenAI returned an empty response', true);
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
        'OpenAI returned invalid tool arguments',
        true,
        {
          cause: error,
        },
      );
    }
  }

  private normalizeError(error: unknown): AiProviderError {
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new AiProviderError('OpenAI request timed out', true, {
        cause: error,
      });
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return new AiProviderError('OpenAI connection failed', true, {
        cause: error,
      });
    }
    if (error instanceof OpenAI.APIError) {
      const status = (error as { status?: unknown }).status;
      if (typeof status !== 'number') {
        return new AiProviderError('OpenAI request failed', true, {
          cause: error,
        });
      }
      const retryable =
        status === 408 || status === 409 || status === 429 || status >= 500;
      const message =
        status === 401 || status === 403
          ? 'OpenAI authentication failed'
          : `OpenAI request failed with status ${status}`;
      return new AiProviderError(message, retryable, { cause: error });
    }
    return new AiProviderError('OpenAI request failed', true, { cause: error });
  }
}
