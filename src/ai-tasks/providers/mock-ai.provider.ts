import type {
  AiFinalResponse,
  AiGenerateWithToolsOptions,
  AiKeyPointsResponse,
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
      content: `当前工具结果：${toolResult.content}`,
    };
  }

  async streamFinalAnswer(
    options: AiGenerateWithToolsOptions,
    onTextDelta: (delta: string) => void,
  ): Promise<AiFinalResponse> {
    const response = await this.generateWithTools(options);
    if (response.type !== 'final') {
      throw new Error(
        'Mock provider expected a final answer after tool result',
      );
    }

    onTextDelta(response.content);
    return response;
  }

  async generateKeyPoints(): Promise<AiKeyPointsResponse> {
    return {
      model: 'mock',
      keyPoints: ['已完成工具调用'],
    };
  }
}
