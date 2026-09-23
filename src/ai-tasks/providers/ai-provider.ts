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
  // Final responses always contain user-visible text, never serialized JSON.
  content: string;
}

export interface AiToolCallResponse extends AiResponseMetadata {
  type: 'tool_call';
  toolCalls: AiToolCall[];
}

export interface AiKeyPointsResponse extends AiResponseMetadata {
  keyPoints: string[];
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
    onTextDelta: (delta: string) => void,
  ): Promise<AiFinalResponse>;
  generateKeyPoints(answer: string): Promise<AiKeyPointsResponse>;
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
