/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { AgentStepType, UserRole } from '../generated/prisma/enums';
import { AgentService } from './agent.service';
import { AgentStepService } from './agent-step.service';
import type { AiProvider } from './providers/ai-provider';
import { ToolRegistry } from './tool-registry';
import type { AgentTool } from './tools/agent-tool.interface';

describe('AgentService', () => {
  const aiProvider: AiProvider = { generateWithTools: jest.fn() };
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
        content: '{"answer":"offline","keyPoints":["device 1"]}',
      });
    (tool.schema.safeParse as jest.Mock).mockReturnValue({
      success: true,
      data: { deviceId: 1 },
    });
    (tool.execute as jest.Mock).mockResolvedValue({ id: 1, status: 'offline' });

    await expect(
      service.run([{ role: 'user', content: 'device?' }], context),
    ).resolves.toEqual({ answer: 'offline', keyPoints: ['device 1'] });

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
    expect(agentSteps.completeTask).toHaveBeenCalledWith(
      'final',
      context,
      '{"answer":"offline","keyPoints":["device 1"]}',
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
  });
});
