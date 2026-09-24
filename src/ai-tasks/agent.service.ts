import { HttpException, Inject, Injectable } from '@nestjs/common';
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
  private readonly maxToolCallsPerStep = 4;

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
    for (let index = 0; index < this.maxSteps; index++) {
      this.assertActive(context);
      const modelStep = await this.agentSteps.createRunning(
        context,
        AgentStepType.MODEL_CALL,
        { messageCount: conversation.length },
      );
      let response: AiResponse;

      try {
        response = await this.aiProvider.generateWithTools({
          messages: conversation,
          tools,
        });
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
        // answer.delta 只发布已经解析、验证后的领域答案，避免把 JSON 转义字符泄漏到 UI。
        await this.events.publish(context.taskId, 'answer.delta', {
          delta: result.answer,
        });
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

      if (response.toolCalls.length === 0) {
        throw new Error('Model returned tool_call without tool');
      }
      if (response.toolCalls.length > this.maxToolCallsPerStep) {
        throw new Error('Model exceeded tool-call limit for one step');
      }

      // 同一模型响应可能包含多个函数调用。按顺序执行，避免未来加入副作用
      // Tool 后并行执行造成不可预测的顺序问题。
      for (const toolCall of response.toolCalls) {
        this.assertActive(context);
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

        conversation.push({
          role: 'assistant',
          content: JSON.stringify({
            toolCallId: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          }),
        });

        if (!parsed.success) {
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
              error: this.toolErrorForModel(error),
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
        conversation.push(
          this.toolMessage(toolCall.id, { result: toolResult }),
        );
      }
    }

    throw new Error('Agent exceeded maximum steps');
  }

  private toolMessage(
    toolCallId: string,
    value: Record<string, unknown>,
  ): AiMessage {
    return { role: 'tool', content: JSON.stringify({ toolCallId, ...value }) };
  }

  private toolErrorForModel(error: unknown): string {
    if (error instanceof HttpException) {
      switch (error.getStatus()) {
        case 400:
          return 'tool_request_invalid';
        case 404:
          return 'resource_not_found_or_inaccessible';
        case 409:
          return 'resource_conflict_refresh_required';
        case 503:
          return 'tool_dependency_temporarily_unavailable';
        default:
          break;
      }
    }
    return 'tool_execution_failed';
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
