import { Inject, Injectable } from '@nestjs/common';
import { AgentStepType } from '../generated/prisma/enums';
import { parseAiTaskResult, type AiTaskResult } from './ai-task-result';
import { AiTaskEventBus } from './ai-task-event-bus';
import { AI_PROVIDER } from './ai-task.constants';
import { AgentStepService } from './agent-step.service';
import type {
  AiMessage,
  AiProvider,
  AiResponse,
} from './providers/ai-provider';
import { ToolRegistry } from './tool-registry';
import type { AgentContext } from './tools/agent-tool.interface';
import { LeaseLostError } from './task-lease.service';

@Injectable()
export class AgentService {
  // 限制模型与工具的往返次数，避免模型持续请求工具导致任务无法结束。
  private readonly maxSteps = 5;

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly agentSteps: AgentStepService,
    private readonly events: AiTaskEventBus,
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
    let hasSuccessfulToolResult = false;

    for (let index = 0; index < this.maxSteps; index++) {
      this.assertActive(context);
      const modelStep = await this.agentSteps.createRunning(
        context,
        AgentStepType.MODEL_CALL,
        { messageCount: conversation.length },
      );
      let response: AiResponse;

      try {
        if (hasSuccessfulToolResult) {
          let publishChain = Promise.resolve();
          response = await this.aiProvider.streamFinalAnswer(
            {
              messages: conversation,
              tools,
            },
            (delta) => {
              if (delta.length === 0) return;
              publishChain = publishChain.then(async () => {
                await this.events.publish(context.taskId, 'answer.delta', {
                  delta,
                });
              });
            },
          );
          await publishChain;
        } else {
          response = await this.aiProvider.generateWithTools({
            messages: conversation,
            tools,
          });
        }
        this.assertActive(context);
        await this.agentSteps.completeStep(modelStep.id, context, {
          responseType: response.type,
          model: response.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        });
      } catch (error) {
        await this.agentSteps.failStep(
          modelStep.id,
          context,
          this.errorMessage(error),
        );
        throw error;
      }

      if (response.type === 'final') {
        const result = parseAiTaskResult(response.content);
        const finalStep = await this.agentSteps.createRunning(
          context,
          AgentStepType.FINAL_ANSWER,
        );
        await this.agentSteps.completeTask(
          finalStep.id,
          context,
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
        context,
        AgentStepType.TOOL_CALL,
        {
          toolCallId: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      );
      const parsed = tool.schema.safeParse(toolCall.arguments);

      if (!parsed.success) {
        // 参数错误属于模型可自行修正的问题，将错误反馈给下一轮而不终止任务。
        await this.agentSteps.failStep(
          toolStep.id,
          context,
          'Invalid tool arguments',
        );
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
        this.assertActive(context);
        toolResult = await tool.execute(parsed.data, context);
        this.assertActive(context);
        await this.agentSteps.completeStep(toolStep.id, context, {
          success: true,
        });
      } catch (error) {
        if (error instanceof LeaseLostError || context.signal.aborted) {
          throw new LeaseLostError();
        }
        await this.agentSteps.failStep(
          toolStep.id,
          context,
          this.errorMessage(error),
        );
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
        context,
        AgentStepType.TOOL_RESULT,
      );
      await this.agentSteps.completeStep(resultStep.id, context, {
        result: toolResult,
      });
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
      hasSuccessfulToolResult = true;
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

  private assertActive(context: AgentContext): void {
    if (context.signal.aborted) throw new LeaseLostError();
  }
}
