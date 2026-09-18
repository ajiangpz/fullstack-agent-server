# Conversation Multi-Turn Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent multi-turn Conversation / ConversationMessage support so each AI task carries a conversationId, the Processor loads bounded trusted history, and the Agent UI displays and restores multi-turn user/assistant messages.

**Architecture:** Conversation is a durable owner-scoped aggregate. Each task writes one USER message at creation, one ASSISTANT message only on successful completion, and uses Conversation.busy as the database CAS gate that guarantees one active task per conversation. A dedicated ConversationContextService converts persisted successful history into bounded `AiMessage[]` for the Processor; AgentStep remains the runtime trace model, and existing task SSE remains task-scoped.

**Tech Stack:** NestJS 11, TypeScript, Prisma/PostgreSQL, BullMQ, Jest, Next.js 16 App Router, React 19, TanStack Query, Zustand, React Hook Form, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-conversation-context-design.md`

## Global Constraints

- Same Conversation executes at most one PENDING / PROCESSING Task at a time.
- Conversation.busy is the authoritative database concurrency gate.
- Each Task has exactly one USER message and at most one ASSISTANT message.
- FAILED Task user messages remain visible but are excluded from later model context.
- Conversation history injected into the model is capped at 20 messages and 12,000 characters, with the current USER message always retained.
- AgentStep remains runtime observability data; Tool Call / Tool Result are not stored as ConversationMessage.
- Existing BullMQ retry, Task Lease, SSE, Tool Runtime and Task Trace behavior must remain intact.
- Existing API fields, database enums and Tool names unrelated to Conversation must remain compatible.
- Frontend active conversation ID is persisted under `network-agent-active-conversation`.
- Existing CI gates remain mandatory: backend lint + test + build; frontend lint + typecheck + test + build.

---

## File Structure

### New backend files

- `src/conversations/conversations.module.ts` — Nest module for Conversation API and context services.
- `src/conversations/conversations.controller.ts` — owner-scoped create/read endpoints.
- `src/conversations/conversations.service.ts` — Conversation creation and message retrieval.
- `src/conversations/conversation-context.service.ts` — builds bounded trusted `AiMessage[]`.
- `src/conversations/conversations.service.spec.ts` — CRUD, owner isolation, activeTaskId tests.
- `src/conversations/conversation-context.service.spec.ts` — history filtering and trimming tests.
- `prisma/migrations/<timestamp>_add_conversations/migration.sql` — schema/backfill migration.

### Modified backend files

- `prisma/schema.prisma` — Conversation / ConversationMessage models and AiTask relation.
- `src/app.module.ts` — imports ConversationsModule.
- `src/ai-tasks/dto/create-ai-task.dto.ts` — requires conversationId.
- `src/ai-tasks/ai-tasks.module.ts` — imports ConversationsModule.
- `src/ai-tasks/ai-tasks.service.ts` — transactional task + USER message creation and busy CAS.
- `src/ai-tasks/ai-tasks.service.spec.ts` — conversation ownership, busy conflict, enqueue failure release tests.
- `src/ai-tasks/ai-task.processor.ts` — delegates model history construction to ConversationContextService.
- `src/ai-tasks/ai-task.processor.spec.ts` — verifies trusted context is passed to AgentService.
- `src/ai-tasks/agent-step.service.ts` — writes ASSISTANT message and releases busy on terminal state.
- `src/ai-tasks/agent-step.service.spec.ts` — completion/failure transaction semantics.

### New frontend files

- `apps/web/src/features/agent/conversation-api.ts` — create/fetch Conversation calls.
- `apps/web/src/features/agent/conversation-hooks.ts` — Query hooks and active conversation lifecycle.
- `apps/web/src/features/agent/conversation-store.ts` — localStorage-backed activeConversationId.
- `apps/web/src/features/agent/conversation-store.test.ts` — local state behavior.
- `apps/web/src/features/agent/components/conversation-message-list.tsx` — user/assistant bubble rendering.

### Modified frontend files

- `apps/web/src/features/agent/api.ts` — createAiTask sends conversationId.
- `apps/web/src/features/agent/types.ts` — Conversation / ConversationMessage types and create-task response.
- `apps/web/src/features/agent/hooks.ts` — conversation refresh on task terminal state.
- `apps/web/src/features/agent/components/agent-page.tsx` — multi-turn chat UI and composer.
- `apps/web/src/i18n/locales/en.ts` — Conversation UI copy.
- `apps/web/src/i18n/locales/zh-CN.ts` — Chinese Conversation UI copy.
- `apps/web/src/features/agent/*.test.ts` — request and state behavior tests as listed below.

---

### Task 1: Add Conversation Persistence Model and Backfill Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_conversations/migration.sql`

**Interfaces:**
- Produces: Prisma models `Conversation`, `ConversationMessage`, enum `ConversationMessageRole`.
- Produces: non-null `AiTask.conversationId: string`.
- Produces: `User.conversations`, `Conversation.tasks`, `AiTask.messages`.

- [ ] **Step 1: Add the Prisma enum and relations to the schema**

Add:

```prisma
enum ConversationMessageRole {
  USER
  ASSISTANT
}

model Conversation {
  id        String   @id @default(cuid())
  ownerId   Int
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  busy      Boolean  @default(false)
  messages  ConversationMessage[]
  tasks     AiTask[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId, updatedAt])
  @@map("conversations")
}

model ConversationMessage {
  id             String                  @id @default(cuid())
  conversationId String
  conversation   Conversation            @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  taskId         String
  task           AiTask                  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  role           ConversationMessageRole
  content        String                  @db.Text
  sequence       Int
  createdAt      DateTime                @default(now())

  @@unique([conversationId, sequence])
  @@unique([taskId, role])
  @@index([conversationId, createdAt])
  @@map("conversation_messages")
}
```

Modify `AiTask`:

```prisma
conversationId String
conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
messages       ConversationMessage[]

@@index([conversationId, createdAt])
```

Modify `User`:

```prisma
conversations Conversation[]
```

- [ ] **Step 2: Generate a migration with a temporary nullable conversationId**

Migration must:

1. Create `ConversationMessageRole`.
2. Create `conversations`.
3. Create `conversation_messages`.
4. Add nullable `conversationId` to `ai_tasks`.
5. Backfill one Conversation per existing AiTask with the same owner.
6. Backfill USER message from `ai_tasks.prompt`.
7. Set `ai_tasks.conversationId` NOT NULL.
8. Add FK/indexes/unique constraints.
9. Leave historical `COMPLETED` tasks without synthetic ASSISTANT messages unless the migration can reliably parse `result.answer`; do not fabricate content.

The SQL backfill for USER messages must use the task prompt exactly:

```sql
INSERT INTO "conversation_messages"
  ("id", "conversationId", "taskId", "role", "content", "sequence", "createdAt")
SELECT
  concat('legacy_user_', t."id"),
  t."conversationId",
  t."id",
  'USER'::"ConversationMessageRole",
  t."prompt",
  1,
  t."createdAt"
FROM "ai_tasks" t;
```

- [ ] **Step 3: Generate Prisma client and validate schema**

Run:

```bash
npx prisma validate
npx prisma generate
```

Expected: both commands exit 0.

- [ ] **Step 4: Run backend build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message:

```text
feat: 增加 Conversation 数据模型

【修改原因】
Agent 需要持久化多轮 user/assistant 会话历史，并将每个 AI Task 关联到明确的 Conversation。

【修改内容】
1、增加 Conversation 和 ConversationMessage Prisma 模型及消息角色枚举。
2、为 AiTask 增加必填 conversationId 关系并补充索引。
3、增加历史 AiTask 回填迁移，为旧任务创建独立 Conversation 和 USER 消息。
4、保留历史 Trace 数据，不伪造无法可靠恢复的 ASSISTANT 消息。
```

---

### Task 2: Add Conversation API and Bounded Context Builder

**Files:**
- Create: `src/conversations/conversations.module.ts`
- Create: `src/conversations/conversations.controller.ts`
- Create: `src/conversations/conversations.service.ts`
- Create: `src/conversations/conversation-context.service.ts`
- Create: `src/conversations/conversations.service.spec.ts`
- Create: `src/conversations/conversation-context.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Produces: `ConversationsService.create(user): Promise<Conversation>`.
- Produces: `ConversationsService.getMessages(id, user)`.
- Produces: `ConversationContextService.buildForTask(taskId): Promise<AiMessage[]>`.
- Context constants: `MAX_HISTORY_MESSAGES = 20`, `MAX_HISTORY_CHARS = 12_000`.

- [ ] **Step 1: Write failing owner-isolation tests**

`conversations.service.spec.ts` must cover:

```ts
it('creates conversations for the authenticated user', async () => {
  prisma.conversation.create.mockResolvedValue({
    id: 'conv-1',
    ownerId: user.id,
    busy: false,
  });

  await service.create(user);

  expect(prisma.conversation.create).toHaveBeenCalledWith({
    data: { ownerId: user.id },
    select: expect.objectContaining({
      id: true,
      busy: true,
      createdAt: true,
      updatedAt: true,
    }),
  });
});

it('returns only owner-scoped conversations and active task id', async () => {
  prisma.conversation.findFirst.mockResolvedValue({
    id: 'conv-1',
    busy: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    tasks: [{ id: 'task-1' }],
  });

  const result = await service.getMessages('conv-1', user);

  expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'conv-1', ownerId: user.id },
    }),
  );
  expect(result.activeTaskId).toBe('task-1');
});
```

Run:

```bash
npm test -- conversations.service.spec.ts --runInBand
```

Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement ConversationsService and controller**

Controller endpoints:

```ts
@Post()
create(@Req() request: AuthenticatedRequest) {
  return this.conversations.create(request.user);
}

@Get(':id/messages')
messages(
  @Param('id') id: string,
  @Req() request: AuthenticatedRequest,
) {
  return this.conversations.getMessages(id, request.user);
}
```

`getMessages` must use:

```ts
where: { id, ownerId: user.id }
```

and select:

```ts
{
  id: true,
  busy: true,
  createdAt: true,
  updatedAt: true,
  messages: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      taskId: true,
      role: true,
      content: true,
      sequence: true,
      createdAt: true,
    },
  },
  tasks: {
    where: { status: { in: ['PENDING', 'PROCESSING'] } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true },
  },
}
```

If not found, throw:

```ts
throw new NotFoundException(`Conversation ${id} not found`);
```

Return:

```ts
{
  conversation: {
    id,
    busy,
    createdAt,
    updatedAt,
  },
  messages,
  activeTaskId: tasks[0]?.id ?? null,
}
```

- [ ] **Step 3: Write failing context trimming tests**

`conversation-context.service.spec.ts` must cover:

```ts
it('includes completed history and the current user message', async () => {
  // completed task user + assistant, failed task user, current user
  // expect failed task user excluded
});

it('keeps at most 20 messages including the current user message', async () => {
  // seed > 20 eligible messages
  // expect result.length === 20
});

it('stops adding old history after the 12000 character budget', async () => {
  // use two large old messages + current prompt
  // expect newest history retained, oldest omitted
});

it('always retains the current user message', async () => {
  // current prompt is large
  // expect final message is current USER
});
```

Run:

```bash
npm test -- conversation-context.service.spec.ts --runInBand
```

Expected: FAIL because service does not exist.

- [ ] **Step 4: Implement ConversationContextService**

Constants:

```ts
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_CHARS = 12_000;
```

Method:

```ts
async buildForTask(taskId: string): Promise<AiMessage[]>
```

Query the current task with:

```ts
select: {
  id: true,
  conversationId: true,
  messages: {
    where: { role: 'USER' },
    take: 1,
    select: { content: true, sequence: true },
  },
  conversation: {
    select: {
      messages: {
        where: {
          OR: [
            {
              task: { status: 'COMPLETED' },
              role: { in: ['USER', 'ASSISTANT'] },
            },
            {
              taskId,
              role: 'USER',
            },
          ],
        },
        orderBy: { sequence: 'asc' },
        select: {
          taskId: true,
          role: true,
          content: true,
          sequence: true,
        },
      },
    },
  },
}
```

Algorithm:

```ts
const current = messages.find(
  (message) => message.taskId === taskId && message.role === 'USER',
);
if (!current) throw new Error('Current conversation user message not found');

const history = messages.filter((message) => message.taskId !== taskId);
const selected = [];
let remainingCount = MAX_HISTORY_MESSAGES - 1;
let remainingChars = Math.max(0, MAX_HISTORY_CHARS - current.content.length);

for (let index = history.length - 1; index >= 0; index--) {
  const message = history[index];
  if (remainingCount <= 0) break;
  if (message.content.length > remainingChars) break;
  selected.push(message);
  remainingCount -= 1;
  remainingChars -= message.content.length;
}

selected.reverse();
return [
  ...selected.map(toAiMessage),
  { role: 'user', content: current.content },
];
```

Map only USER → `user`, ASSISTANT → `assistant`.

- [ ] **Step 5: Register module and run tests**

Run:

```bash
npm test -- conversations.service.spec.ts conversation-context.service.spec.ts --runInBand
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

```text
feat: 增加 Conversation API 与上下文构建

【修改原因】
多轮 Agent 需要读取 owner 隔离的会话消息，并在进入模型前对历史消息做稳定裁剪。

【修改内容】
1、增加 Conversation 创建和消息查询 API。
2、普通用户和管理员均仅能读取自己拥有的 Conversation。
3、增加 ConversationContextService，仅注入已完成回合和当前 USER 消息。
4、限制模型历史最多 20 条消息和 12000 字符，并始终保留当前 USER 消息。
5、补充 Conversation 权限、activeTaskId 和上下文裁剪单元测试。
```

---

### Task 3: Make AI Task Creation Conversation-Aware and Serial

**Files:**
- Modify: `src/ai-tasks/dto/create-ai-task.dto.ts`
- Modify: `src/ai-tasks/ai-tasks.module.ts`
- Modify: `src/ai-tasks/ai-tasks.service.ts`
- Modify: `src/ai-tasks/ai-tasks.service.spec.ts`

**Interfaces:**
- Consumes: `conversationId: string`.
- Produces: `AiTasksService.create({ conversationId, prompt }, user)`.
- Produces: 409 `Conversation already has an active AI task` when busy CAS fails.

- [ ] **Step 1: Update DTO tests/service tests first**

Add expectations:

```ts
await service.create(
  { conversationId: 'conv-1', prompt: 'hello' },
  user,
);
```

Test transaction semantics:

```ts
expect(tx.conversation.updateMany).toHaveBeenCalledWith({
  where: {
    id: 'conv-1',
    ownerId: user.id,
    busy: false,
  },
  data: { busy: true },
});
```

Test `count: 0` throws:

```ts
await expect(
  service.create({ conversationId: 'conv-1', prompt: 'hello' }, user),
).rejects.toThrow(ConflictException);
```

Test USER message:

```ts
expect(tx.conversationMessage.create).toHaveBeenCalledWith({
  data: {
    conversationId: 'conv-1',
    taskId: 'task-1',
    role: 'USER',
    content: 'hello',
    sequence: 1,
  },
});
```

Run:

```bash
npm test -- ai-tasks.service.spec.ts --runInBand
```

Expected: FAIL against old create path.

- [ ] **Step 2: Require conversationId in CreateAiTaskDto**

Add:

```ts
@ApiProperty({
  example: 'cm123...',
  description: 'Conversation ID',
})
@IsString()
@MinLength(1)
@MaxLength(100)
conversationId!: string;
```

Keep existing prompt validation.

- [ ] **Step 3: Implement transactional create**

`AiTasksService.create` must:

```ts
const task = await this.prisma.$transaction(async (tx) => {
  const claimed = await tx.conversation.updateMany({
    where: {
      id: dto.conversationId,
      ownerId: user.id,
      busy: false,
    },
    data: { busy: true },
  });

  if (claimed.count !== 1) {
    const exists = await tx.conversation.findFirst({
      where: { id: dto.conversationId, ownerId: user.id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(
        `Conversation ${dto.conversationId} not found`,
      );
    }
    throw new ConflictException(
      'Conversation already has an active AI task',
    );
  }

  const last = await tx.conversationMessage.findFirst({
    where: { conversationId: dto.conversationId },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });

  const task = await tx.aiTask.create({
    data: {
      prompt: dto.prompt,
      ownerId: user.id,
      conversationId: dto.conversationId,
    },
    select: { id: true, conversationId: true },
  });

  await tx.conversationMessage.create({
    data: {
      conversationId: dto.conversationId,
      taskId: task.id,
      role: 'USER',
      content: dto.prompt,
      sequence: (last?.sequence ?? 0) + 1,
    },
  });

  return task;
});
```

- [ ] **Step 4: Release busy on queue enqueue failure**

On `queue.add` failure, use one transaction:

```ts
await this.prisma.$transaction([
  this.prisma.aiTask.update({
    where: { id: task.id },
    data: {
      status: 'FAILED',
      errorMessage: 'Task could not be queued',
      completedAt: new Date(),
    },
  }),
  this.prisma.conversation.update({
    where: { id: task.conversationId },
    data: { busy: false },
  }),
]);
```

Do not delete USER message.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- ai-tasks.service.spec.ts --runInBand
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

```text
feat: 将 AI Task 绑定到 Conversation

【修改原因】
多轮会话要求每个 AI Task 明确归属 Conversation，并阻止同一会话并发创建多个运行中任务。

【修改内容】
1、创建 AI Task 时要求传入 conversationId。
2、通过 Conversation.busy 数据库 CAS 保证同一会话串行执行。
3、Task 与 USER ConversationMessage 在同一事务创建并生成稳定 sequence。
4、队列入队失败时标记 Task FAILED 并释放 Conversation busy。
5、补充 owner 校验、busy 冲突和消息创建测试。
```

---

### Task 4: Load Conversation History in Processor and Persist Assistant Replies

**Files:**
- Modify: `src/ai-tasks/ai-tasks.module.ts`
- Modify: `src/ai-tasks/ai-task.processor.ts`
- Modify: `src/ai-tasks/ai-task.processor.spec.ts`
- Modify: `src/ai-tasks/agent-step.service.ts`
- Modify: `src/ai-tasks/agent-step.service.spec.ts`

**Interfaces:**
- Consumes: `ConversationContextService.buildForTask(taskId)`.
- Produces: system prompt + bounded conversation messages passed to AgentService.
- Produces: ASSISTANT ConversationMessage on success.
- Produces: busy=false on terminal success/failure; busy stays true on retryable failure.

- [ ] **Step 1: Write failing Processor context test**

Change processor mock to include ConversationContextService:

```ts
const conversationContext = {
  buildForTask: jest.fn(),
};
```

Test:

```ts
conversationContext.buildForTask.mockResolvedValue([
  { role: 'user', content: 'first question' },
  { role: 'assistant', content: 'first answer' },
  { role: 'user', content: 'follow up' },
]);

await processor.process(createJob());

expect(agent.run).toHaveBeenCalledWith(
  [
    {
      role: 'system',
      content:
        'You are a network device troubleshooting agent. Use tools when required.',
    },
    { role: 'user', content: 'first question' },
    { role: 'assistant', content: 'first answer' },
    { role: 'user', content: 'follow up' },
  ],
  expect.objectContaining({ taskId: 'task-1' }),
);
```

Run:

```bash
npm test -- ai-task.processor.spec.ts --runInBand
```

Expected: FAIL because Processor does not use context service.

- [ ] **Step 2: Update Processor**

Keep owner lookup trusted from DB, but only select owner identity:

```ts
const task = await this.prisma.aiTask.findFirstOrThrow({
  where: { id: job.data.taskId, leaseToken: lease.token },
  select: {
    owner: {
      select: { id: true, username: true, email: true, role: true },
    },
  },
});

const history = await this.conversationContext.buildForTask(job.data.taskId);

await this.agent.run(
  [
    {
      role: 'system',
      content:
        'You are a network device troubleshooting agent. Use tools when required.',
    },
    ...history,
  ],
  { ...context },
);
```

- [ ] **Step 3: Write failing AgentStep success/failure tests**

Success must assert one transaction writes:

```ts
expect(tx.conversationMessage.create).toHaveBeenCalledWith({
  data: {
    conversationId: 'conv-1',
    taskId: 'task-1',
    role: 'ASSISTANT',
    content: 'offline',
    sequence: 2,
  },
});

expect(tx.conversation.update).toHaveBeenCalledWith({
  where: { id: 'conv-1' },
  data: { busy: false },
});
```

Final failure must assert:

```ts
expect(prisma.conversation.update).toHaveBeenCalledWith({
  where: { id: 'conv-1' },
  data: { busy: false },
});
```

Non-final failure must assert Conversation update is not called.

Run:

```bash
npm test -- agent-step.service.spec.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 4: Extend completeTask transaction**

Change `completeTask` to parse the already validated result:

```ts
const parsedResult = parseAiTaskResult(result);
```

Inside transaction, read task relation needed for conversation:

```ts
const task = await tx.aiTask.update({
  where: { id: ownership.taskId },
  data: { ...completed fields... },
  select: {
    id: true,
    conversationId: true,
    status: true,
    result: true,
    errorMessage: true,
    attempts: true,
    retryCount: true,
    startedAt: true,
    completedAt: true,
    updatedAt: true,
  },
});
```

Find last sequence:

```ts
const last = await tx.conversationMessage.findFirst({
  where: { conversationId: task.conversationId },
  orderBy: { sequence: 'desc' },
  select: { sequence: true },
});
```

Create ASSISTANT:

```ts
await tx.conversationMessage.create({
  data: {
    conversationId: task.conversationId,
    taskId: task.id,
    role: 'ASSISTANT',
    content: parsedResult.answer,
    sequence: (last?.sequence ?? 0) + 1,
  },
});
```

Release busy:

```ts
await tx.conversation.update({
  where: { id: task.conversationId },
  data: { busy: false },
});
```

- [ ] **Step 5: Release busy only on final failure**

After successful final `aiTask.updateMany`, load:

```ts
select: {
  id: true,
  conversationId: true,
  status: true,
  ...
}
```

If `isFinalAttempt`:

```ts
await this.prisma.conversation.update({
  where: { id: task.conversationId },
  data: { busy: false },
});
```

For non-final retry, keep busy true.

- [ ] **Step 6: Run focused and full backend tests**

Run:

```bash
npm test -- ai-task.processor.spec.ts agent-step.service.spec.ts --runInBand
npm test -- --runInBand
npm run lint:check
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message:

```text
feat: 接入多轮 Conversation 上下文

【修改原因】
Processor 需要使用已完成会话历史生成模型上下文，并在 Task 成功或最终失败时维护 Conversation 的持久化状态。

【修改内容】
1、Processor 通过 ConversationContextService 加载裁剪后的多轮 user/assistant 历史。
2、继续从数据库 Task owner 构造 Agent 权限上下文，不信任队列载荷身份。
3、Task 成功时在同一事务写入 ASSISTANT 消息并释放 Conversation busy。
4、最终失败释放 busy，BullMQ 非最终重试继续保持会话锁定。
5、补充 Processor、成功消息写入和失败释放测试。
```

---

### Task 5: Add Frontend Conversation State, API and Recovery

**Files:**
- Create: `apps/web/src/features/agent/conversation-api.ts`
- Create: `apps/web/src/features/agent/conversation-hooks.ts`
- Create: `apps/web/src/features/agent/conversation-store.ts`
- Create: `apps/web/src/features/agent/conversation-store.test.ts`
- Modify: `apps/web/src/features/agent/api.ts`
- Modify: `apps/web/src/features/agent/types.ts`
- Modify: `apps/web/src/features/agent/hooks.ts`

**Interfaces:**
- Produces: `createConversation()`.
- Produces: `getConversationMessages(conversationId)`.
- Produces: `useConversation(conversationId)`.
- Produces: `useActiveConversationStore` with `activeConversationId`, `setActiveConversationId`, `clearActiveConversation`.
- Changes: `createAiTask({ conversationId, prompt })`.

- [ ] **Step 1: Add frontend types**

Add:

```ts
export type ConversationMessageRole = 'USER' | 'ASSISTANT';

export interface ConversationMessage {
  id: string;
  taskId: string;
  role: ConversationMessageRole;
  content: string;
  sequence: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  busy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessagesResult {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
  activeTaskId: string | null;
}

export interface CreateConversationResponse extends ConversationSummary {}

export interface CreateAiTaskInput {
  conversationId: string;
  prompt: string;
}
```

- [ ] **Step 2: Write active conversation store tests**

```ts
it('sets and clears the active conversation id', () => {
  useActiveConversationStore.getState().setActiveConversationId('conv-1');
  expect(useActiveConversationStore.getState().activeConversationId).toBe(
    'conv-1',
  );

  useActiveConversationStore.getState().clearActiveConversation();
  expect(useActiveConversationStore.getState().activeConversationId).toBeNull();
});
```

Also test hydration from:

```text
network-agent-active-conversation
```

Run:

```bash
npm test --prefix apps/web -- conversation-store.test.ts
```

Expected: FAIL before store implementation.

- [ ] **Step 3: Implement localStorage-backed store**

State:

```ts
interface ActiveConversationState {
  activeConversationId: string | null;
  hasHydrated: boolean;
  setActiveConversationId(id: string): void;
  clearActiveConversation(): void;
  hydrate(): void;
}
```

Storage key:

```ts
const STORAGE_KEY = 'network-agent-active-conversation';
```

Do not automatically create a Conversation on hydrate.

- [ ] **Step 4: Implement Conversation API and Query hook**

`conversation-api.ts`:

```ts
export function createConversation() {
  return apiRequest<CreateConversationResponse>('/conversations', {
    method: 'POST',
  });
}

export function getConversationMessages(id: string) {
  return apiRequest<ConversationMessagesResult>(
    `/conversations/${encodeURIComponent(id)}/messages`,
  );
}
```

`conversation-hooks.ts`:

```ts
export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversationMessages(id as string),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 5: Update createAiTask contract**

```ts
export function createAiTask(input: CreateAiTaskInput) {
  return apiRequest<CreateAiTaskResponse>('/ai-tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
```

Do not reuse `AgentPromptInput` as the transport type because conversationId is not a form field.

- [ ] **Step 6: Invalidate Conversation after task terminal state**

Extend realtime hook so when current task becomes `COMPLETED` or `FAILED`, call:

```ts
await queryClient.invalidateQueries({
  queryKey: ['conversation', conversationId],
});
```

Pass `conversationId` into the realtime hook explicitly:

```ts
useAiTaskRealtime(taskId, conversationId)
```

Polling fallback must trigger the same invalidation when it observes a terminal task.

- [ ] **Step 7: Run frontend tests/typecheck**

Run:

```bash
npm test --prefix apps/web
npm run typecheck --prefix apps/web
```

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message:

```text
feat: 增加前端 Conversation 状态与恢复

【修改原因】
多轮 Agent 前端需要持久化当前 Conversation、恢复历史消息并在创建 Task 时携带 conversationId。

【修改内容】
1、增加 Conversation API、类型和 TanStack Query hooks。
2、增加 localStorage-backed activeConversationId 状态。
3、AI Task 创建请求改为携带 conversationId。
4、Task 到达终态后刷新 Conversation messages，兼容 SSE 和 Polling fallback。
5、补充 Conversation 本地状态测试。
```

---

### Task 6: Convert Agent Page to Multi-Turn Chat UI

**Files:**
- Create: `apps/web/src/features/agent/components/conversation-message-list.tsx`
- Modify: `apps/web/src/features/agent/components/agent-page.tsx`
- Modify: `apps/web/src/i18n/locales/en.ts`
- Modify: `apps/web/src/i18n/locales/zh-CN.ts`
- Test: `apps/web/src/features/agent/conversation-flow.test.ts` or focused pure state tests if component testing infrastructure is absent.

**Interfaces:**
- Consumes: Conversation types, active conversation store, createConversation, createAiTask, useConversation, useAiTaskRealtime.
- Produces: restored multi-turn chat page with New conversation and busy-aware composer.

- [ ] **Step 1: Add i18n keys in both locales**

English:

```ts
'conversation.new': 'New conversation',
'conversation.empty': 'Start a conversation with the Network Agent.',
'conversation.user': 'You',
'conversation.agent': 'Agent',
'conversation.loading': 'Loading conversation…',
'conversation.busy': 'Agent is working. Wait for this task to finish before sending another message.',
'conversation.send': 'Send',
'conversation.failed': 'The previous Agent task failed. You can send another message.',
'conversation.restoreError': 'Unable to restore this conversation.',
'conversation.createError': 'Unable to create a conversation.',
```

Chinese:

```ts
'conversation.new': '新建会话',
'conversation.empty': '向 Network Agent 发送第一条消息。',
'conversation.user': '你',
'conversation.agent': 'Agent',
'conversation.loading': '正在加载会话…',
'conversation.busy': 'Agent 正在执行，请等待当前任务结束后再发送下一条消息。',
'conversation.send': '发送',
'conversation.failed': '上一条 Agent 任务执行失败，你可以继续发送消息。',
'conversation.restoreError': '无法恢复该会话。',
'conversation.createError': '无法创建会话。',
```

- [ ] **Step 2: Implement ConversationMessageList**

Render messages in sequence order:

```tsx
{ordered.map((message) => (
  <article
    key={message.id}
    className={
      message.role === 'USER'
        ? 'ml-auto max-w-3xl rounded-2xl bg-cyan-500/10 ...'
        : 'mr-auto max-w-3xl rounded-2xl border border-zinc-800 ...'
    }
  >
    <p className="text-xs ...">
      {message.role === 'USER'
        ? t('conversation.user')
        : t('conversation.agent')}
    </p>
    <p className="mt-2 whitespace-pre-wrap ...">{message.content}</p>
  </article>
))}
```

Do not render raw Task result JSON.

- [ ] **Step 3: Refactor AgentPage state flow**

On mount:

1. hydrate activeConversationId.
2. if ID exists, query messages.
3. if response has `activeTaskId`, set taskId and reconnect SSE.
4. display messages.

On submit:

```ts
let conversationId = activeConversationId;

if (!conversationId) {
  const created = await createConversation();
  conversationId = created.id;
  setActiveConversationId(created.id);
}

const createdTask = await createAiTask({
  conversationId,
  prompt: values.prompt,
});

setTaskId(createdTask.taskId);
reset({ prompt: '' });
await queryClient.invalidateQueries({
  queryKey: ['conversation', conversationId],
});
```

Composer disabled when:

```ts
const isBusy =
  conversationQuery.data?.conversation.busy === true ||
  createTaskMutation.isPending;
```

- [ ] **Step 4: Add New conversation behavior**

Button:

```tsx
<Button
  variant="secondary"
  onClick={() => {
    clearActiveConversation();
    setTaskId(null);
    reset({ prompt: '' });
  }}
>
  {t('conversation.new')}
</Button>
```

Do not delete server Conversation.

- [ ] **Step 5: Preserve task observability without duplicating final answer**

While active task exists:

- Show TaskStatusBadge.
- Show SSE connected/fallback state.
- Show execution trace link.
- On FAILED show task error.
- Do not render a separate Final Answer card; completed assistant answer comes from ConversationMessage after refresh.

Suggested prompts remain and set the composer prompt.

- [ ] **Step 6: Add pure conversation flow tests**

If no React Testing Library is installed, test helper/state functions instead of introducing a new dependency.

At minimum:

```ts
it('sorts messages by sequence', () => {
  expect(sortConversationMessages([
    { sequence: 2, ...assistant },
    { sequence: 1, ...user },
  ]).map((message) => message.sequence)).toEqual([1, 2]);
});
```

and transport test:

```ts
expect(createAiTaskPayload('conv-1', 'hello')).toEqual({
  conversationId: 'conv-1',
  prompt: 'hello',
});
```

- [ ] **Step 7: Run complete frontend checks**

Run:

```bash
npm run lint:web
npm run typecheck --prefix apps/web
npm test --prefix apps/web
npm run build --prefix apps/web
```

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message:

```text
feat: 将 Network Agent 升级为多轮会话

【修改原因】
Agent 页面需要展示并恢复同一 Conversation 的多轮 user/assistant 消息，而不是只展示当前单个 Task 的请求和最终结果。

【修改内容】
1、将 Agent 页面改为多轮聊天消息列表和底部 Composer。
2、首次发送时自动创建 Conversation，后续 Task 复用同一 conversationId。
3、刷新页面后从 localStorage 恢复 Conversation，并重新连接 active Task SSE。
4、Conversation busy 时禁止并发发送，终态后刷新 assistant 消息。
5、增加 New conversation、失败状态和中英文会话文案。
```

---

### Task 7: Full Regression Verification and Documentation Sync

**Files:**
- Modify: `docs/frontend-product-plan.md` if its current Agent capability list does not mention multi-turn Conversation.
- Modify: `docs/superpowers/plans/2026-09-18-conversation-multi-turn-context.md` only to check completed boxes if execution workflow tracks plan status.

**Interfaces:**
- Consumes all prior tasks.
- Produces a green master branch with documented multi-turn Conversation capability.

- [ ] **Step 1: Run full backend verification**

Run:

```bash
npx prisma validate
npx prisma generate
npm run lint:check
npm test -- --runInBand
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Run full frontend verification**

Run:

```bash
npm run lint:web
npm run typecheck --prefix apps/web
npm test --prefix apps/web
npm run build --prefix apps/web
```

Expected: all PASS.

- [ ] **Step 3: Verify critical behavior manually or through focused API tests**

Verify:

```text
POST /conversations -> conv-1
POST /ai-tasks { conversationId: conv-1, prompt: Q1 } -> task-1
second POST while busy -> 409
task-1 completes -> assistant message exists and busy=false
POST /ai-tasks { conversationId: conv-1, prompt: Q2 } -> task-2
Processor input contains Q1, A1, Q2
GET /conversations/conv-1/messages -> USER, ASSISTANT, USER ordered by sequence
```

- [ ] **Step 4: Update product capability documentation**

Add to Agent capability section:

```text
- Persistent Conversation / ConversationMessage history
- One active Task per Conversation
- Multi-turn Agent context
- History trimming: max 20 messages / 12,000 characters
- Browser conversation restore
```

Do not claim LLM summary support in this version.

- [ ] **Step 5: Push and verify GitHub Actions**

After commits reach `master`, inspect the workflow run for the latest SHA.

Required green jobs:

```text
Backend
├─ Prisma generate
├─ Lint
├─ Test
└─ Build

Frontend
├─ Lint
├─ Typecheck
├─ Test
└─ Build
```

- [ ] **Step 6: Final documentation commit if needed**

Commit message:

```text
docs: 更新 Agent 多轮会话能力说明
```

---

## Self-Review

### Spec coverage

- Conversation / ConversationMessage data model: Task 1.
- conversationId on task creation: Task 3 and Task 5.
- same-conversation serial execution: Task 3.
- Processor loads historical messages: Task 2 and Task 4.
- only successful history injected: Task 2.
- 20-message / 12,000-character trimming: Task 2.
- assistant message written on completion: Task 4.
- final failure releases busy; retry keeps busy: Task 4.
- frontend multi-turn user/assistant display: Task 6.
- localStorage conversation recovery: Task 5 and Task 6.
- existing task SSE preserved: Task 5 and Task 6.
- i18n additions: Task 6.
- historical AiTask migration: Task 1.
- full CI verification: Task 7.

### Type consistency

- Backend uses `conversationId: string` everywhere.
- Conversation message role is persisted as `USER | ASSISTANT` and mapped to Provider `user | assistant` only in ConversationContextService.
- Frontend transport type `CreateAiTaskInput` contains `conversationId + prompt`; form type remains `AgentPromptInput` containing only `prompt`.
- SSE remains Task-scoped; Conversation refresh is Query invalidation, not a new SSE protocol.
