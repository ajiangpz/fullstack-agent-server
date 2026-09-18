# Conversation 多轮上下文设计

日期：2026-09-18  
状态：已确认设计，待实现

## 1. 目标

在现有 AI Task / Agent Runtime / BullMQ / AgentStep / SSE 架构上增加 Conversation 多轮上下文能力，使同一会话中的后续问题能够携带之前已成功完成的 user/assistant 消息，同时保证：

- 同一 Conversation 内最多只有一个 PENDING / PROCESSING Task。
- 每个 Task 对应一条 USER 消息，成功完成时对应一条 ASSISTANT 消息。
- Processor 只加载可信、已持久化的会话历史。
- 历史上下文有明确裁剪上限，避免 token 随会话无限增长。
- 不改变现有 AgentStep 的职责；ConversationMessage 用于聊天历史，AgentStep 继续用于 Runtime 可观测性。
- 保留现有 BullMQ Retry、Task Lease、SSE 和 Tool Runtime 行为。

## 2. 非目标

本阶段不实现：

- 同一 Conversation 内并发 Task。
- Conversation 列表页、搜索、重命名、删除或归档。
- LLM 自动摘要。
- 跨 Conversation Memory。
- 把 Tool Call / Tool Result 持久化为 ConversationMessage。
- 把失败 Task 的 user 消息注入后续模型上下文。
- URL locale 或与 Conversation 绑定的语言设置。

## 3. 数据模型

新增枚举：

```prisma
enum ConversationMessageRole {
  USER
  ASSISTANT
}
```

新增 Conversation：

```prisma
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
```

新增 ConversationMessage：

```prisma
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

扩展 AiTask：

```prisma
model AiTask {
  ...
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  messages       ConversationMessage[]

  @@index([conversationId, createdAt])
}
```

扩展 User：

```prisma
model User {
  ...
  conversations Conversation[]
}
```

### 3.1 为什么 Conversation 使用 busy

第一版采用同一会话串行执行。Conversation.busy 是创建 Task 时的并发闸门，不依赖前端按钮状态。

提交新 Task 时必须通过原子更新：

```text
busy = false -> busy = true
```

只有更新成功的请求可以创建 Task。

这避免两个并发请求都读取到空闲状态后同时创建任务。

### 3.2 Message 唯一约束

`@@unique([taskId, role])` 保证：

- 一个 Task 最多一条 USER 消息。
- 一个 Task 最多一条 ASSISTANT 消息。
- Worker Retry 不会重复插入 assistant 回复。

`@@unique([conversationId, sequence])` 保证会话展示顺序稳定。

## 4. API 契约

### 4.1 创建 Conversation

```http
POST /conversations
Authorization: Bearer <token>
```

响应：

```json
{
  "id": "conversation-id",
  "busy": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Conversation.ownerId 永远来自 JWT user，不接受客户端 ownerId。

### 4.2 查询 Conversation Messages

```http
GET /conversations/:id/messages
Authorization: Bearer <token>
```

普通用户只能读取自己的 Conversation；ADMIN 本阶段也不跨用户读取聊天内容，保持聊天内容按 owner 隔离。

响应：

```json
{
  "conversation": {
    "id": "conversation-id",
    "busy": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "messages": [
    {
      "id": "message-id",
      "taskId": "task-id",
      "role": "USER",
      "content": "哪些设备离线？",
      "sequence": 1,
      "createdAt": "..."
    }
  ],
  "activeTaskId": "task-id"
}
```

`activeTaskId` 动态查询状态为 PENDING / PROCESSING 的 AiTask，不额外持久化。

### 4.3 创建 AI Task

原请求：

```json
{
  "prompt": "..."
}
```

改为：

```json
{
  "conversationId": "conversation-id",
  "prompt": "..."
}
```

`conversationId` 为必填。

后端必须验证 Conversation 属于当前用户。

## 5. 创建 Task 的事务

`AiTasksService.create()` 使用数据库事务完成以下步骤：

1. 根据 `conversationId + ownerId` 查找 Conversation。
2. 原子将 Conversation.busy 从 false 更新为 true。
3. 若更新 count != 1，返回 409 Conflict。
4. 查询当前 Conversation 最大 message sequence。
5. 创建 AiTask，关联 conversationId 和 ownerId。
6. 创建 USER ConversationMessage：
   - role = USER
   - content = prompt
   - taskId = 新 Task
   - sequence = lastSequence + 1
7. 提交事务。
8. 提交成功后向 BullMQ enqueue。

如果 BullMQ enqueue 失败：

- AiTask 标记 FAILED。
- Conversation.busy 释放为 false。
- USER ConversationMessage 保留，用于 UI 展示失败回合。
- 不创建 ASSISTANT 消息。

队列异常的回滚不删除用户已经提交的消息，因为该消息属于已发生的用户行为。

## 6. Processor 上下文加载

当前 Processor 构造：

```text
system
current user prompt
```

改为：

```text
system
completed historical user
completed historical assistant
...
current user
```

Processor 通过独立 `ConversationContextService` 构造模型上下文。

职责：

```ts
buildForTask(taskId: string): Promise<AiMessage[]>
```

该 Service 负责：

- 加载 Task、Conversation、owner。
- 读取 ConversationMessage。
- 只保留：
  - 已 COMPLETED Task 的 USER + ASSISTANT 消息。
  - 当前 Task 的 USER 消息。
- 排除：
  - FAILED Task 的 USER 消息。
  - PENDING / PROCESSING 的其他消息。
  - Tool Call / Tool Result。
- 应用上下文裁剪规则。
- 返回普通 `AiMessage[]`，AgentService 不感知数据库或 Conversation。

Processor 只负责：

```text
acquire lease
-> load trusted task owner
-> build conversation context
-> prepend system prompt
-> AgentService.run()
```

## 7. 历史裁剪规则

第一版不调用额外 LLM 做摘要，采用双限制：

```text
MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_CHARS = 12_000
```

定义：

- “历史”不包含 system prompt。
- 当前 Task 的 USER 消息必须保留。
- 从最新历史消息向旧消息倒序选择。
- 选择消息时同时满足：
  - 总消息数不超过 20。
  - 总 content 字符数不超过 12,000。
- 最终再恢复为原始 sequence 顺序。

建议算法：

```text
current USER -> always include

remainingMessageBudget = 19
remainingCharBudget = 12000 - currentUser.length

history newest -> oldest
  if count exceeded -> stop
  if next message chars exceeded -> stop
  include

reverse selected history
append current USER
```

如果当前 USER 自身超过 12,000 字符：

- 仍完整保留当前 USER。
- 历史消息为空。
- CreateAiTaskDto 仍保留现有 10,000 字符上限，因此正常情况下不会发生。

这里使用字符预算而非 token 精确计算，是为了避免 Provider 绑定和额外 tokenizer 依赖。后续可替换为 provider-aware token budget。

## 8. Task 完成事务

当前最终结果在 `AgentStepService.completeTask()` 落库。

扩展为同一个 transaction：

1. 校验 Task lease ownership。
2. FINAL_ANSWER AgentStep -> COMPLETED。
3. AiTask -> COMPLETED。
4. 解析已经验证过的 AiTaskResult。
5. 创建 ASSISTANT ConversationMessage：
   - role = ASSISTANT
   - content = result.answer
   - taskId = 当前 taskId
   - sequence = 当前最大 sequence + 1
6. Conversation.busy -> false。
7. commit。
8. commit 后继续发送现有 SSE `step.updated` / `task.completed`。

Assistant Message 只保存 `answer`，不保存整个 JSON result。

`keyPoints` 继续保存在 AiTask.result，以保持聊天消息简洁。

## 9. Task 失败与 Retry

### 9.1 非最终失败

BullMQ 仍将重试：

```text
AiTask -> PENDING
Conversation.busy -> true
USER message -> 保留
ASSISTANT message -> 不存在
```

不允许用户发送下一轮。

### 9.2 最终失败

```text
AiTask -> FAILED
Conversation.busy -> false
USER message -> 保留
ASSISTANT message -> 不创建
```

失败的 USER 消息可在 UI 显示，但后续 Processor 构造历史时排除该回合。

### 9.3 Lease Lost

Lease lost 不改变 Conversation.busy。

新的 Worker 通过现有 lease recovery 继续该 Task。

## 10. 串行并发控制

后端是唯一可信闸门。

前端：

- Conversation.busy=true 时 disable 输入与发送按钮。
- 展示当前 active Task 状态。

后端：

- 无论前端状态如何，都通过数据库 CAS 拒绝并发 Task。
- 冲突返回 409。

建议错误消息：

```text
Conversation already has an active AI task
```

不依赖 Redis lock，因为 Conversation 状态本身需要持久化并用于页面恢复。

## 11. 前端状态模型

Agent 页面从“单任务结果页”改为“单 Conversation Chat”。

新增：

```ts
interface ConversationMessage {
  id: string;
  taskId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sequence: number;
  createdAt: string;
}
```

新增 Conversation API：

```ts
createConversation()
getConversationMessages(conversationId)
```

Task 创建：

```ts
createAiTask({
  conversationId,
  prompt,
})
```

## 12. activeConversationId

前端维护：

```text
network-agent-active-conversation
```

保存在 localStorage。

页面启动：

```text
read activeConversationId
  -> GET conversation messages
  -> render messages
  -> if activeTaskId
       -> reconnect existing Task SSE
```

无 activeConversationId 时，不自动创建空 Conversation。

用户第一次发送消息时：

```text
POST /conversations
-> save activeConversationId
-> POST /ai-tasks
```

“New conversation”：

- 清除当前 activeConversationId。
- 清除当前页面 task state。
- 不删除服务端旧 Conversation。
- 下一次发送时创建新 Conversation。

## 13. SSE 与前端刷新

现有 Task SSE 保持 Task 维度，不改成 Conversation SSE。

理由：

- AgentStep 和 Task 状态天然属于 Task。
- 不扩大现有事件协议。
- 降低 SSE 变更风险。

流程：

```text
Task SSE task.completed
  -> existing AiTask Query Cache updated
  -> invalidate/refetch Conversation messages
  -> ASSISTANT message appears
```

Task FAILED：

```text
task.failed
  -> invalidate Conversation messages
  -> busy becomes false
  -> UI can submit next prompt
```

如果 SSE 不可用，现有 Polling fallback 在 Task 到终态后同样触发 Conversation refresh。

## 14. UI

Agent 页面主要结构：

```text
Header
  Network Agent
  New conversation

Message list
  User bubble
  Assistant bubble
  User bubble
  Agent working / failed state

Composer
  textarea
  send
```

保留：

- Suggested prompts。
- SSE connection 状态。
- Execution Trace 链接。
- Task status。
- 中英文切换。

移除当前重复的：

- 单独 “Your request” Card。
- 单独 Final Answer Card 作为主交互。

Final Answer 转为 ASSISTANT message；Trace 仍从对应 Task 进入。

## 15. i18n

新增中英文 key：

- conversation.new
- conversation.empty
- conversation.user
- conversation.agent
- conversation.loading
- conversation.busy
- conversation.send
- conversation.failed
- conversation.restoreError
- conversation.createError

Conversation message content 不翻译。

Agent 的回答语言仍由模型上下文和用户输入决定，本阶段不强制 Provider 按 UI locale 输出。

## 16. 权限

Conversation 永远属于一个 User。

所有 Conversation API：

- USER 只能操作自己的 Conversation。
- 本阶段 ADMIN 不自动获得读取其他用户 Conversation 内容的能力。
- AiTask 创建时同时验证：
  - conversation.ownerId == JWT user.id
  - task.ownerId == JWT user.id

这样避免管理员角色逻辑意外扩大聊天隐私范围。

## 17. 迁移策略

现有 AiTask 没有 conversationId，因此新增字段不能直接设为必填而不处理历史数据。

采用一次迁移：

1. 新建 Conversation / ConversationMessage 表。
2. 为每个已有 AiTask 创建一个独立 Conversation。
3. Conversation.ownerId = AiTask.ownerId。
4. 为已有 Task 创建 USER message，content = prompt。
5. 对 COMPLETED 且 result 可解析的 Task 创建 ASSISTANT message，content = result.answer。
6. 回填 AiTask.conversationId。
7. 将 AiTask.conversationId 改为 NOT NULL。
8. 历史 Conversation.busy = false。

这保证现有 Task Trace / Task History 仍然可用，且数据模型没有 nullable conversationId 的长期兼容负担。

如果 Prisma migration 无法方便地在纯 schema migration 内解析 result JSON，应使用 SQL/脚本只回填 USER message；旧 COMPLETED Task 不强制生成 ASSISTANT message。此时迁移说明必须明确历史会话只保证 USER 消息完整，不能伪造 assistant 内容。

## 18. 测试

### Backend

ConversationService：

- 创建 Conversation 使用 JWT owner。
- 非 owner 无法读取 messages。
- activeTaskId 正确返回。

AiTasksService：

- conversationId 必填。
- owner 不匹配返回 404/403，统一采用现有资源隐藏策略时返回 404。
- busy=false 可创建。
- busy=true 返回 409。
- Task + USER message + busy=true 同事务创建。
- enqueue 失败后释放 busy。

ConversationContextService：

- 只加载 COMPLETED 回合。
- FAILED 回合不进入上下文。
- 当前 USER 必保留。
- 消息数最多 20。
- 历史字符最多 12,000。
- 裁剪后 sequence 顺序正确。

AgentStepService：

- Task COMPLETED + assistant message + busy=false 同 transaction。
- Worker Retry 不重复 assistant message。
- 最终失败释放 busy。
- 非最终失败保持 busy=true。

Processor：

- 使用 ConversationContextService 输出，而不是只传当前 prompt。

### Frontend

- 第一次发送自动创建 Conversation。
- 后续请求携带同一 conversationId。
- 恢复 localStorage conversation。
- messages 按 sequence 展示。
- busy 时禁用 Composer。
- terminal Task 后刷新 Conversation messages。
- New conversation 清空本地 activeConversationId。
- 中英文 Conversation 文案。

### CI

继续要求现有：

```text
Backend: lint + test + build
Frontend: lint + typecheck + test + build
```

全部通过。

## 19. 实施顺序

1. Prisma schema + migration。
2. Conversation backend module/service/controller。
3. ConversationContextService。
4. AiTask create conversationId + 串行 CAS。
5. AgentStepService 完成/失败释放 Conversation。
6. Processor 接入 ConversationContextService。
7. Backend tests。
8. Frontend Conversation API/types/hooks/store。
9. AgentPage 重构为多轮聊天。
10. i18n 文案。
11. Frontend tests。
12. GitHub CI 验证与修复。

## 20. 后续演进

第一版稳定后可以增加：

```text
Conversation.summary
summaryThroughSequence
+
recent messages
```

摘要触发条件可以基于上下文预算，而不是每个 Step 生成摘要。

未来还可扩展：

- Conversation list / rename / archive。
- Provider-aware token counting。
- Conversation title 自动生成。
- 跨 Conversation Memory retrieve/inject。
- Conversation-level realtime events。

这些均不属于当前实现范围。
