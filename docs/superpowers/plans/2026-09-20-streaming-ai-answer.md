# 流式 AI 回答 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最终 AI 回答以 SSE 文本增量实时显示，并在持久化消息可用时无闪烁地替换临时气泡。

**Architecture:** Provider 在工具调用完成后的最终回答请求中产生文本 delta；AgentService 发布 `answer.delta` 并累积完整 JSON 后沿用现有事务完成任务。前端为活动 task 保存临时回答，收到 delta 后追加渲染，待会话查询返回该 task 的正式 assistant 消息后才移除临时气泡。

**Tech Stack:** NestJS、Prisma、BullMQ、Redis Pub/Sub SSE、OpenAI SDK、Next.js、React、TanStack Query、Vitest、Jest。

**Spec:** `docs/superpowers/specs/2026-09-20-streaming-ai-answer-design.md`

## Global Constraints

- 保留 BullMQ、Redis 任务事件和现有 SSE 订阅端点；不更改鉴权。
- 不新增第三方依赖，不更改 Conversation/AiTask 数据库结构。
- 工具调用继续使用完整响应；只有工具结果后的最终回答走文本流。
- 流失败沿用现有 `AiProviderError`、任务重试和失败语义。
- SSE 断线时继续依赖既有任务轮询与最终会话刷新。

## Review Focus

- 空 delta 或结构错误的 `answer.delta` 不应改变临时回答；由 Task 1 测试。
- 流中 JSON 跨多个 chunk 时必须保持原样拼接；由 Task 2 测试。
- 工具调用轮次不能意外启用最终文本流；由 Task 2 测试。
- `task.completed` 先到、会话查询后到时临时气泡必须持续存在；由 Task 4 测试。
- SSE 断线但任务最终完成时，持久化 assistant 消息仍须显示；由 Task 4 测试。

---

### Task 1: 事件协议与前端流式状态归约

**Files:**
- Modify: `src/ai-tasks/ai-task-events.ts`
- Modify: `src/ai-tasks/ai-task-events.spec.ts` (create if absent)
- Modify: `apps/web/src/features/agent/types.ts`
- Modify: `apps/web/src/features/agent/stream.ts`
- Modify: `apps/web/src/features/agent/stream.test.ts`

**Interfaces:**
- Produces: `AiTaskEventType` and `AiTaskStreamEventType` include `'answer.delta'`.
- Produces: `extractAnswerDelta(event: AiTaskStreamEvent): string | null` for hook state updates.

- [ ] **Step 1: Write backend and frontend failing tests**

```ts
expect(isAiTaskStreamEvent({ taskId: 'task-1', type: 'answer.delta', data: { delta: 'he' }, emittedAt: 'now' })).toBe(true);
expect(extractAnswerDelta({ taskId: 'task-1', type: 'answer.delta', data: { delta: 'he' }, emittedAt: 'now' })).toBe('he');
expect(extractAnswerDelta({ taskId: 'task-1', type: 'answer.delta', data: { delta: '' }, emittedAt: 'now' })).toBeNull();
```

- [ ] **Step 2: Verify the tests fail for the missing event and extractor**

Run: `npm test -- --runInBand src/ai-tasks/ai-task-events.spec.ts` and `npm test --prefix apps/web -- stream.test.ts`

Expected: backend event validation rejects `answer.delta`; frontend test fails because `extractAnswerDelta` is not exported.

- [ ] **Step 3: Add the minimal event and extraction implementation**

```ts
export const AI_TASK_EVENT_TYPES = [...existingTypes, 'answer.delta'] as const;

export function extractAnswerDelta(event: AiTaskStreamEvent): string | null {
  if (event.type !== 'answer.delta' || typeof event.data !== 'object' || event.data === null) return null;
  const delta = (event.data as { delta?: unknown }).delta;
  return typeof delta === 'string' && delta.length > 0 ? delta : null;
}
```

Mirror the union change in the web type file; do not alter task-patch reducer semantics.

- [ ] **Step 4: Verify focused tests pass**

Run: `npm test -- --runInBand src/ai-tasks/ai-task-events.spec.ts` and `npm test --prefix apps/web -- stream.test.ts`

Expected: both commands exit 0.

### Task 2: DeepSeek 最终回答流与 Provider 抽象

**Files:**
- Modify: `src/ai-tasks/providers/ai-provider.ts`
- Modify: `src/ai-tasks/providers/deepseek.provider.ts`
- Modify: `src/ai-tasks/providers/deepseek.provider.spec.ts`
- Modify: `src/ai-tasks/providers/openai.provider.ts`
- Modify: `src/ai-tasks/providers/openai.provider.spec.ts`

**Interfaces:**
- Consumes: `AiGenerateWithToolsOptions` and existing `AiProviderError`.
- Produces: `AiProvider.streamFinalAnswer(options, onDelta): Promise<AiResponse>` where `onDelta(delta: string): void` receives non-empty text chunks and the resolved response has `type: 'final'`.

- [ ] **Step 1: Write failing DeepSeek provider tests**

```ts
const chunks = [{ choices: [{ delta: { content: '{"answer":"hel' } }] }, { choices: [{ delta: { content: 'lo","keyPoints":[]}' } }] }];
create.mockResolvedValue(asAsyncIterable(chunks));
const deltas: string[] = [];
await expect(provider.streamFinalAnswer(request, (delta) => deltas.push(delta))).resolves.toMatchObject({ type: 'final', content: '{"answer":"hello","keyPoints":[]}' });
expect(deltas).toEqual(['{"answer":"hel', 'lo","keyPoints":[]}']);
```

Also assert `stream: true`, JSON-object response format, and absence of `tools`/`tool_choice`; add a test that skips empty delta chunks. Add equivalent interface coverage for the OpenAI provider, or explicitly make it delegate to its existing non-streaming final response if Responses streaming cannot preserve the JSON schema under the installed SDK.

- [ ] **Step 2: Verify provider tests fail**

Run: `npm test -- --runInBand src/ai-tasks/providers/deepseek.provider.spec.ts src/ai-tasks/providers/openai.provider.spec.ts`

Expected: failure because `streamFinalAnswer` does not exist.

- [ ] **Step 3: Implement the provider contract and final-answer streaming**

```ts
export interface AiProvider {
  generateWithTools(options: AiGenerateWithToolsOptions): Promise<AiResponse>;
  streamFinalAnswer(options: AiGenerateWithToolsOptions, onDelta: (delta: string) => void): Promise<AiFinalResponse>;
}
```

DeepSeek calls `chat.completions.create` with `stream: true`, final-answer JSON format, no tool definitions, and iterates the returned async stream. Concatenate `choice.delta.content`, invoke `onDelta` for every non-empty chunk, and return the concatenated content plus final metadata. Preserve existing error normalization. Implement compatible behavior for OpenAI so all registered providers satisfy the interface.

- [ ] **Step 4: Verify provider tests pass**

Run: `npm test -- --runInBand src/ai-tasks/providers/deepseek.provider.spec.ts src/ai-tasks/providers/openai.provider.spec.ts`

Expected: all selected provider tests pass.

### Task 3: Agent 事件发布与持久化完成路径

**Files:**
- Modify: `src/ai-tasks/agent.service.ts`
- Modify: `src/ai-tasks/agent.service.spec.ts`
- Modify: `src/ai-tasks/ai-task-event-bus.ts` only if a narrow publish adapter is required

**Interfaces:**
- Consumes: `AiProvider.streamFinalAnswer(options, onDelta)` from Task 2.
- Consumes: `AiTaskEventBus.publish(taskId, 'answer.delta', { delta })`.
- Produces: final response remains parsed by `parseAiTaskResult` and saved through `AgentStepService.completeTask`.

- [ ] **Step 1: Write the failing AgentService test**

```ts
(aiProvider.generateWithTools as jest.Mock).mockResolvedValueOnce(toolCallResponse);
(aiProvider.streamFinalAnswer as jest.Mock).mockImplementation(async (_options, onDelta) => {
  onDelta('{"answer":"off');
  onDelta('line","keyPoints":[]}');
  return { type: 'final', model: 'test-model', content: '{"answer":"offline","keyPoints":[]}' };
});
await service.run([{ role: 'user', content: 'device?' }], context);
expect(events.publish).toHaveBeenNthCalledWith(1, 'task-1', 'answer.delta', { delta: '{"answer":"off' });
expect(agentSteps.completeTask).toHaveBeenCalledWith('final', context, '{"answer":"offline","keyPoints":[]}');
```

Update test construction to inject a mocked `AiTaskEventBus`; include a test asserting a first-round tool call does not call `streamFinalAnswer`.

- [ ] **Step 2: Verify the AgentService tests fail**

Run: `npm test -- --runInBand src/ai-tasks/agent.service.spec.ts`

Expected: failure because AgentService has no event bus dependency and still calls `generateWithTools` for final output.

- [ ] **Step 3: Implement the final-response branch**

After a tool result exists, create the model step as today but call `streamFinalAnswer`; publish only non-empty deltas with the current task id; complete the step and final task using the assembled provider response. Keep initial model and all tool-call rounds on `generateWithTools`, and retain existing lease/error behavior.

- [ ] **Step 4: Verify AgentService tests pass**

Run: `npm test -- --runInBand src/ai-tasks/agent.service.spec.ts`

Expected: selected suite exits 0 and verifies both tool and streaming branches.

### Task 4: 前端临时 assistant 气泡与无闪烁接管

**Files:**
- Modify: `apps/web/src/features/agent/hooks.ts`
- Modify: `apps/web/src/features/agent/components/agent-page.tsx`
- Modify: `apps/web/src/features/agent/components/conversation-message-list.tsx`
- Create: `apps/web/src/features/agent/hooks.test.tsx` or extend existing hook test file
- Create: `apps/web/src/features/agent/components/agent-page.test.tsx` if component-level coverage is needed

**Interfaces:**
- Consumes: `extractAnswerDelta` from Task 1 and task lifecycle from `useAiTaskRealtime`.
- Produces: `streamedAnswer: string` in the realtime hook result and a `temporaryMessage` render input.

- [ ] **Step 1: Write failing UI/hook tests**

```tsx
// after answer.delta { delta: 'Hel' } then { delta: 'lo' }
expect(result.current.streamedAnswer).toBe('Hello');
// after task.completed but before conversation includes task-1 assistant message
expect(screen.getByText('Hello')).toBeInTheDocument();
// after conversation contains { taskId: 'task-1', role: 'ASSISTANT', content: 'Hello' }
expect(screen.getAllByText('Hello')).toHaveLength(1);
```

Add a polling-fallback test: setting terminal task state and injecting the persisted message displays it even if no delta was received.

- [ ] **Step 2: Verify UI/hook tests fail**

Run: `npm test --prefix apps/web -- hooks.test.tsx agent-page.test.tsx`

Expected: failure because no streamed-answer state or temporary-message lifecycle exists.

- [ ] **Step 3: Implement temporary message lifecycle**

In `useAiTaskStream`, append valid answer deltas to local state and reset only when task id changes. Return the state through `useAiTaskRealtime`. In `AgentPage`, create a temporary `ConversationMessage` with id `streaming-${taskId}`, role `ASSISTANT`, and the accumulated content while a task exists. Keep it after terminal state until `messages` contains the task's persisted assistant message; then omit it. Extend `ConversationMessageList` with an optional `temporaryMessage` prop and render it after persisted messages with its stable temporary key.

- [ ] **Step 4: Verify UI/hook tests pass**

Run: `npm test --prefix apps/web -- hooks.test.tsx agent-page.test.tsx`

Expected: selected tests pass, including completion-before-refetch and polling-fallback cases.

### Task 5: 回归验证与提交准备

**Files:**
- Modify only files changed by Tasks 1–4.

**Interfaces:**
- Consumes: all prior task interfaces.
- Produces: verified, reviewable feature branch.

- [ ] **Step 1: Run format and focused test suites**

Run: `npm test -- --runInBand src/ai-tasks/ai-task-events.spec.ts src/ai-tasks/providers/deepseek.provider.spec.ts src/ai-tasks/providers/openai.provider.spec.ts src/ai-tasks/agent.service.spec.ts` and `npm test --prefix apps/web -- stream.test.ts hooks.test.tsx agent-page.test.tsx`

Expected: all targeted tests pass.

- [ ] **Step 2: Run repository validation**

Run: `npx prisma generate`; `npm run lint:check`; `npm test -- --runInBand`; `npm run build`; `npm run lint:web`; `npm run typecheck --prefix apps/web`; `npm test --prefix apps/web`; `npm run build --prefix apps/web`.

Expected: every command exits 0. Report any pre-existing failure by command and test name.

- [ ] **Step 3: Review the exact change set**

Run: `git status --short`; `git diff --check`; `git diff --stat`; `git diff`.

Expected: only streaming-answer implementation, tests, and the approved design/plan docs are present; no generated Prisma output is staged.

- [ ] **Step 4: Request commit approval**

Present the complete Conventional Commit message using the repository's Chinese format, then wait for explicit user confirmation before staging or committing implementation files.
