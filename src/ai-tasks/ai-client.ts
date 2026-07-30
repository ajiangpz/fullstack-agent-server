import { Injectable } from '@nestjs/common';

export interface AiClient {
  generate(prompt: string): Promise<string>;
}

@Injectable()
export class MockAiClient implements AiClient {
  async generate(prompt: string): Promise<string> {
    const delay = Number(process.env.MOCK_AI_DELAY_MS ?? 500);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return `模拟 AI 响应：${prompt}`;
  }
}
