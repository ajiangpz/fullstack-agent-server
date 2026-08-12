import type {
  AiGenerateWithToolsOptions,
  AiProvider,
  AiResponse,
} from './ai-provider';

export class MockAiProvider implements AiProvider {
  constructor(private readonly delayMs: number) {}

  async generateWithTools({
    messages,
  }: AiGenerateWithToolsOptions): Promise<AiResponse> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const toolResult = [...messages]
      .reverse()
      .find((message) => message.role === 'tool');

    if (!toolResult) {
      return {
        type: 'tool_call',
        model: 'mock',
        toolCalls: [
          {
            id: 'mock-tool-call',
            name: 'get_device',
            arguments: { deviceId: 1 },
          },
        ],
      };
    }

    return {
      type: 'final',
      model: 'mock',
      content: JSON.stringify({
        answer: `当前工具结果：${toolResult.content}`,
        keyPoints: ['已完成工具调用'],
      }),
    };
  }
}
