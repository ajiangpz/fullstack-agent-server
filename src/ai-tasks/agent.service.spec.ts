/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { AgentStepType, UserRole } from '../generated/prisma/enums';
import { AgentService } from './agent.service';
import { AgentStepService } from './agent-step.service';
import type { AiProvider } from './providers/ai-provider';
import { ToolRegistry } from './tool-registry';
import type { AgentTool } from './tools/agent-tool.interface';

describe('AgentService', () => {
  const aiProvider: AiProvider = {
    generateWithTools: jest.fn(),
    streamFinalAnswer: jest.fn(),
  };
  const tool: AgentTool = {
    name: 'get_device',
    description: 'Get device',
    schema: { safeParse: jest.fn() } as never,
    parameters: { type: 'object' },
    execute: jest.fn(),
  };
  const registry = { list: jest.fn(() => [tool]), get: jest.fn(() => tool) };
  const agentSteps = {
    createRunning: jest.fn(),
    completeStep: jest.fn(),
    completeTask: jest.fn(),
    failStep: jest.fn(),
  };
  const events = {
    publish: jest.fn().mockResolvedValue(true),
  };
  const context = {
    taskId: 'task-1',
    leaseToken: 'token-1',
    signal: new AbortController().signal,
    user: {
      id: 7,
      username: 'user',
      email: 'u@example.com',
      role: UserRole.USER,
    },
  };
  let service: AgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    registry.list.mockReturnValue([tool]);
    registry.get.mockReturnValue(tool);
    service = new AgentService(
      aiProvider,
      registry as unknown as ToolRegistry,
      agentSteps as unknown as AgentStepService,
      events as never,
    );
  });

  it('runs one tool call and then completes the final answer', async () => {
    agentSteps.createRunning
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ id: 'tool-call' })
      .mockResolvedValueOnce({ id: 'tool-result' })
      .mockResolvedValueOnce({ id: 'model-2' })
      .mockResolvedValueOnce({ id: 'final' });
    (aiProvider.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [
          { id: 'call-1', name: 'get_device', arguments: { deviceId: 1 } },
        ],
      })
      .mockResolvedValueOnce({
        type: 'final',
        model: 'test-model',
        content:
          '{"answer":"offline\\n\\nDevice 1","keyPoints":["device 1"]}',
      });
    (tool.schema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { deviceId: 1 },
    });
    (tool.execute as jest.Mock).mockResolvedValue({ id: 1, status: 'offline' });

    await expect(
      service.run([{ role: 'user', content: 'device?' }], context),
    ).resolves.toEqual({
      answer: 'offline\n\nDevice 1',
      keyPoints: ['device 1'],
    });

    expect(agentSteps.createRunning).toHaveBeenCalledWith(
      context,
      AgentStepType.TOOL_CALL,
      {
        toolCallId: 'call-1',
        name: 'get_device',
        arguments: { deviceId: 1 },
      },
    );
    expect(tool.execute).toHaveBeenCalledWith({ deviceId: 1 }, context);
    expect(aiProvider.generateWithTools).toHaveBeenCalledTimes(2);
    expect(aiProvider.streamFinalAnswer).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(
      'task-1',
      'answer.delta',
      { delta: 'offline\n\nDevice 1' },
    );
    expect(agentSteps.completeTask).toHaveBeenCalledWith(
      'final',
      context,
      '{"answer":"offline\\n\\nDevice 1","keyPoints":["device 1"]}',
    );
  });

  it('feeds invalid tool arguments back to the model', async () => {
    agentSteps.createRunning
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ id: 'tool-call' })
      .mockResolvedValueOnce({ id: 'model-2' })
      .mockResolvedValueOnce({ id: 'final' });
    (aiProvider.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [{ id: 'call-1', name: 'get_device', arguments: {} }],
      })
      .mockResolvedValueOnce({
        type: 'final',
        model: 'test-model',
        content: '{"answer":"need id","keyPoints":[]}',
      });
    (tool.schema.safeParse as jest.Mock).mockReturnValue({ success: false });

    await service.run([{ role: 'user', content: 'device?' }], context);

    expect(agentSteps.failStep).toHaveBeenCalledWith(
      'tool-call',
      context,
      'Invalid tool arguments',
    );
    expect(aiProvider.generateWithTools).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'tool' }),
        ]),
      }),
    );
    expect(aiProvider.streamFinalAnswer).not.toHaveBeenCalled();
  });

  it('returns a safe recoverable category for tool lookup failures', async () => {
    agentSteps.createRunning
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ id: 'tool-call' })
      .mockResolvedValueOnce({ id: 'model-2' })
      .mockResolvedValueOnce({ id: 'final' });
    (aiProvider.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [
          { id: 'call-1', name: 'get_device', arguments: { deviceId: 99 } },
        ],
      })
      .mockResolvedValueOnce({
        type: 'final',
        model: 'test-model',
        content: '{"answer":"not found","keyPoints":[]}',
      });
    (tool.schema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { deviceId: 99 },
    });
    (tool.execute as jest.Mock).mockRejectedValue(
      new NotFoundException('internal resource detail'),
    );

    await service.run([{ role: 'user', content: 'device 99?' }], context);

    expect(aiProvider.generateWithTools).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'tool',
            content: expect.stringContaining(
              'resource_not_found_or_inaccessible',
            ),
          }),
        ]),
      }),
    );
    expect(
      (aiProvider.generateWithTools as jest.Mock).mock.calls[1][0].messages,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('internal resource detail'),
        }),
      ]),
    );
  });

  it('allows another tool round after a successful tool result', async () => {
    agentSteps.createRunning
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ id: 'tool-call-1' })
      .mockResolvedValueOnce({ id: 'tool-result-1' })
      .mockResolvedValueOnce({ id: 'model-2' })
      .mockResolvedValueOnce({ id: 'tool-call-2' })
      .mockResolvedValueOnce({ id: 'tool-result-2' })
      .mockResolvedValueOnce({ id: 'model-3' })
      .mockResolvedValueOnce({ id: 'final' });

    (aiProvider.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [
          { id: 'call-1', name: 'get_device', arguments: { deviceId: 1 } },
        ],
      })
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [
          { id: 'call-2', name: 'get_device', arguments: { deviceId: 2 } },
        ],
      })
      .mockResolvedValueOnce({
        type: 'final',
        model: 'test-model',
        content: '{"answer":"two devices","keyPoints":[]}',
      });

    (tool.schema.safeParse as jest.Mock)
      .mockReturnValueOnce({ success: true, data: { deviceId: 1 } })
      .mockReturnValueOnce({ success: true, data: { deviceId: 2 } });
    (tool.execute as jest.Mock)
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });

    await service.run([{ role: 'user', content: 'compare devices' }], context);

    expect(tool.execute).toHaveBeenNthCalledWith(
      1,
      { deviceId: 1 },
      context,
    );
    expect(tool.execute).toHaveBeenNthCalledWith(
      2,
      { deviceId: 2 },
      context,
    );
    expect(aiProvider.generateWithTools).toHaveBeenCalledTimes(3);
  });

  it('executes multiple tool calls returned by one model step', async () => {
    agentSteps.createRunning
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ id: 'tool-call-1' })
      .mockResolvedValueOnce({ id: 'tool-result-1' })
      .mockResolvedValueOnce({ id: 'tool-call-2' })
      .mockResolvedValueOnce({ id: 'tool-result-2' })
      .mockResolvedValueOnce({ id: 'model-2' })
      .mockResolvedValueOnce({ id: 'final' });

    (aiProvider.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({
        type: 'tool_call',
        model: 'test-model',
        toolCalls: [
          { id: 'call-1', name: 'get_device', arguments: { deviceId: 1 } },
          { id: 'call-2', name: 'get_device', arguments: { deviceId: 2 } },
        ],
      })
      .mockResolvedValueOnce({
        type: 'final',
        model: 'test-model',
        content: '{"answer":"done","keyPoints":[]}',
      });

    (tool.schema.safeParse as jest.Mock)
      .mockReturnValueOnce({ success: true, data: { deviceId: 1 } })
      .mockReturnValueOnce({ success: true, data: { deviceId: 2 } });
    (tool.execute as jest.Mock)
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });

    await service.run([{ role: 'user', content: 'two devices' }], context);

    expect(tool.execute).toHaveBeenCalledTimes(2);
    expect(aiProvider.generateWithTools).toHaveBeenCalledTimes(2);
  });
});
