import { Inject, Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { parseAiTaskResult, type AiTaskResult } from './ai-task-result';
import { AI_PROVIDER } from './ai-task.constants';
import { AgentStepService } from './agent-step.service';
import type {
  AiMessage,
  AiProvider,
  AiResponse,
} from './providers/ai-provider';
import { ToolRegistry } from './tool-registry';
import type { AgentContext } from './tools/agent-tool.interface';

@Injectable()
export class AgentService {
  // 限制模型与工具的往返次数，避免模型持续请求工具导致任务无法结束。
  private readonly maxSteps = 5;

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly agentSteps: AgentStepService,
  ) {}

  async run(
    messages: AiMessage[],
    context: AgentContext,
  ): Promise<AiTaskResult> {
    const conversation = [...messages];
    // 只向模型暴露工具元数据，真正的执行函数始终保留在服务端。
    const tools = this.toolRegistry.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    for (let index = 0; index < this.maxSteps; index++) {
      const modelStep = await this.agentSteps.createRunning(
        context.taskId,
        AgentStepType.MODEL_CALL,
        { messageCount: conversation.length },
      );
      let response: AiResponse;

      try {
        response = await this.aiProvider.generateWithTools({
          messages: conversation,
          tools,
        });
        await this.agentSteps.completeStep(modelStep.id, {
          responseType: response.type,
          model: response.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        });
      } catch (error) {
        await this.agentSteps.failStep(modelStep.id, this.errorMessage(error));
        throw error;
      }

      if (response.type === 'final') {
        const result = parseAiTaskResult(response.content);
        const finalStep = await this.agentSteps.createRunning(
          context.taskId,
          AgentStepType.FINAL_ANSWER,
        );
        await this.agentSteps.completeTask(
          finalStep.id,
          context.taskId,
          JSON.stringify(result),
        );
        return result;
      }

      const toolCall = response.toolCalls[0];
      if (!toolCall) {
        throw new Error('Model returned tool_call without tool');
      }
      const tool = this.toolRegistry.get(toolCall.name);
      const toolStep = await this.agentSteps.createRunning(
        context.taskId,
        AgentStepType.TOOL_CALL,
        { toolCallId: toolCall.id, arguments: toolCall.arguments },
      );
      const parsed = tool.schema.safeParse(toolCall.arguments);

      if (!parsed.success) {
        // 参数错误属于模型可自行修正的问题，将错误反馈给下一轮而不终止任务。
        await this.agentSteps.failStep(toolStep.id, 'Invalid tool arguments');
        conversation.push(
          this.toolMessage(toolCall.id, {
            success: false,
            error: 'Invalid tool arguments',
          }),
        );
        continue;
      }

      let toolResult: unknown;
      try {
        toolResult = await tool.execute(parsed.data, context);
        await this.agentSteps.completeStep(toolStep.id, { success: true });
      } catch (error) {
        await this.agentSteps.failStep(toolStep.id, this.errorMessage(error));
        // 不把内部异常细节交给模型，避免泄露数据库或服务实现信息。
        conversation.push(
          this.toolMessage(toolCall.id, {
            success: false,
            error: 'Tool execution failed',
          }),
        );
        continue;
      }

      const resultStep = await this.agentSteps.createRunning(
        context.taskId,
        AgentStepType.TOOL_RESULT,
      );
      await this.agentSteps.completeStep(resultStep.id, { result: toolResult });
      // 同时补充工具请求和结果，使下一轮模型拥有完整的调用上下文。
      conversation.push({
        role: 'assistant',
        content: JSON.stringify({
          toolCallId: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        }),
      });
      conversation.push(this.toolMessage(toolCall.id, { result: toolResult }));
    }

    throw new Error('Agent exceeded maximum steps');
  }

  private toolMessage(
    toolCallId: string,
    value: Record<string, unknown>,
  ): AiMessage {
    return { role: 'tool', content: JSON.stringify({ toolCallId, ...value }) };
  }

  private errorMessage(error: unknown): string {
    return (
      error instanceof Error ? error.message : 'Unknown agent error'
    ).slice(0, 2_000);
  }
}
