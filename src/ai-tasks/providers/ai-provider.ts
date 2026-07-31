export interface GenerateTextInput {
  prompt: string;
}

export interface AiProvider {
  generateText(input: GenerateTextInput): Promise<string>;
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
