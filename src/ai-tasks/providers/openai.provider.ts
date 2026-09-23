import OpenAI from 'openai';
import {
  AI_TASK_KEY_POINTS_JSON_SCHEMA,
  parseAiTaskKeyPoints,
} from '../ai-task-result';
import type {
  AiFinalResponse,
  AiGenerateWithToolsOptions,
  AiKeyPointsResponse,
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
        input: this.toResponseInput(messages),
        instructions: this.finalAnswerInstructions(),
        max_output_tokens: this.options.maxOutputTokens,
        tools: tools.map((tool) => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          strict: true,
          parameters: tool.parameters,
        })),
        tool_choice: 'auto',
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
        return { type: 'tool_call', toolCalls, ...metadata };
      }

      const content = response.output_text.trim();
      if (!content) {
        throw new AiProviderError('OpenAI returned an empty response', true);
      }

      return { type: 'final', content, ...metadata };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw this.normalizeError(error);
    }
  }

  async streamFinalAnswer(
    { messages }: AiGenerateWithToolsOptions,
    onTextDelta: (delta: string) => void,
  ): Promise<AiFinalResponse> {
    try {
      const stream = await this.client.responses.create({
        model: this.options.model,
        input: this.toResponseInput(messages),
        instructions: this.finalAnswerInstructions(),
        max_output_tokens: this.options.maxOutputTokens,
        tools: [],
        stream: true,
      });

      let content = '';
      let model = this.options.model;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          if (!event.delta) continue;
          content += event.delta;
          onTextDelta(event.delta);
          continue;
        }

        if (event.type === 'response.completed') {
          model = event.response.model;
          inputTokens = event.response.usage?.input_tokens;
          outputTokens = event.response.usage?.output_tokens;
        }
      }

      const finalContent = content.trim();
      if (!finalContent) {
        throw new AiProviderError('OpenAI returned an empty response', true);
      }

      return {
        type: 'final',
        model,
        inputTokens,
        outputTokens,
        content: finalContent,
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw this.normalizeError(error);
    }
  }

  async generateKeyPoints(answer: string): Promise<AiKeyPointsResponse> {
    try {
      const response = await this.client.responses.create({
        model: this.options.model,
        instructions:
          'Extract concise key points from the supplied final answer. ' +
          'Do not rewrite the answer. Return only the requested structured data.',
        input: [{ role: 'user', content: answer }],
        max_output_tokens: this.options.maxOutputTokens,
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_task_key_points',
            strict: true,
            schema: AI_TASK_KEY_POINTS_JSON_SCHEMA,
          },
        },
      });

      let keyPoints: string[];
      try {
        keyPoints = parseAiTaskKeyPoints(response.output_text);
      } catch (error) {
        throw new AiProviderError('OpenAI returned invalid key points', false, {
          cause: error,
        });
      }

      return {
        model: response.model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        keyPoints,
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw this.normalizeError(error);
    }
  }

  private toResponseInput(messages: AiGenerateWithToolsOptions['messages']) {
    return messages.map((message) => ({
      role: message.role === 'tool' ? ('user' as const) : message.role,
      content: message.content,
    }));
  }

  private finalAnswerInstructions(): string {
    return [
      this.options.instructions,
      'When answering the user, return only the user-visible answer in Markdown. Do not wrap the answer in JSON.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parseToolArguments(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch (error) {
      throw new AiProviderError(
        'OpenAI returned invalid tool arguments',
        true,
        { cause: error },
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
