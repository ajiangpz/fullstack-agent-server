export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

interface AiResponseMetadata {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiFinalResponse extends AiResponseMetadata {
  type: 'final';
  content: string;
}

export interface AiToolCallResponse extends AiResponseMetadata {
  type: 'tool_call';
  toolCalls: AiToolCall[];
}

export type AiResponse = AiFinalResponse | AiToolCallResponse;

export interface AiGenerateWithToolsOptions {
  messages: AiMessage[];
  tools: AiToolDefinition[];
}

export interface AiProvider {
  generateWithTools(options: AiGenerateWithToolsOptions): Promise<AiResponse>;
  streamFinalAnswer(
    options: AiGenerateWithToolsOptions,
    onDelta: (delta: string) => void,
  ): Promise<AiFinalResponse>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}
