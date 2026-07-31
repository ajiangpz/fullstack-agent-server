import OpenAI from 'openai';
import type { AiProvider, GenerateTextInput } from './ai-provider';
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

  async generateText({ prompt }: GenerateTextInput): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: this.options.model,
        input: prompt,
        instructions: this.options.instructions,
        max_output_tokens: this.options.maxOutputTokens,
      });
      const output = response.output_text.trim();

      if (!output) {
        throw new AiProviderError(
          'OpenAI returned an empty text response',
          true,
        );
      }

      return output;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw this.normalizeError(error);
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
      if (status === 401 || status === 403) {
        return new AiProviderError('OpenAI authentication failed', false, {
          cause: error,
        });
      }
      if (status === 408 || status === 409 || status === 429 || status >= 500) {
        return new AiProviderError(
          `OpenAI request failed with status ${status}`,
          true,
          { cause: error },
        );
      }
      return new AiProviderError(
        `OpenAI request failed with status ${status}`,
        false,
        { cause: error },
      );
    }

    return new AiProviderError('OpenAI request failed', true, {
      cause: error,
    });
  }
}
