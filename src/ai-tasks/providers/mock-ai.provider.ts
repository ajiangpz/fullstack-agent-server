import type { AiProvider, GenerateTextInput } from './ai-provider';

export class MockAiProvider implements AiProvider {
  constructor(private readonly delayMs: number) {}

  async generateText({ prompt }: GenerateTextInput): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return `模拟 AI 响应：${prompt}`;
  }
}
