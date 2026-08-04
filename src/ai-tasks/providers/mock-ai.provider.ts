import type { AiTaskResult } from '../ai-task-result';
import type { AiProvider, GenerateTextInput } from './ai-provider';

export class MockAiProvider implements AiProvider {
  constructor(private readonly delayMs: number) {}

  async generateText({ prompt }: GenerateTextInput): Promise<AiTaskResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return {
      answer: `模拟 AI 响应：${prompt}`,
      keyPoints: [],
    };
  }
}
