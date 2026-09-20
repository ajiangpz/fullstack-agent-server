# 流式 AI 回答设计

## 目标

用户发送消息后，页面立即显示用户消息与临时 assistant 气泡；模型最终回答生成期间，文本按增量显示。任务结束时，临时气泡由已持久化的会话消息替代，页面不出现空白、跳动或整段答案突然插入。

## 范围与约束

- 保留现有 BullMQ 异步任务、Redis 任务事件及 SSE 订阅端点。
- 工具调用继续使用当前完整响应路径；仅最终自然语言回答使用 token 流。
- SSE 不承载鉴权变更，不改变会话/任务数据库结构。
- SSE 断开时，现有任务详情轮询仍可得出终态；流式临时文本不会伪装成已持久化消息。
- 不新增第三方依赖。

## 架构

`AiProvider` 新增面向最终回答的流式能力。Provider 在最后一轮模型调用中以流模式读取文本 delta，并将每个非空 delta 回调给 `AgentService`。`AgentService` 将 delta 通过 `AiTaskEventBus` 发布为 `answer.delta`，同时累积完整 JSON 文本；流结束后仍沿用 `parseAiTaskResult`、`completeTask` 和事务持久化路径。

工具调用保持 `generateWithTools` 的既有行为：模型先请求并执行工具，再进行最终回答。为了保持这一边界，最终回答请求不再要求工具调用；它保留 JSON 结果格式，以便现有持久化和历史对话格式无需迁移。

## 事件协议

后端 `AI_TASK_EVENT_TYPES` 与前端 `AiTaskStreamEventType` 增加 `answer.delta`。事件数据为：

```ts
{ delta: string }
```

无效数据或空字符串不会改变前端状态。`task.completed` 继续携带当前任务补丁，作为最终状态的唯一来源。

## 前端状态与渲染

`useAiTaskRealtime` 维护当前 task 的流式答案缓存。每次收到 `answer.delta` 时追加缓存，同时更新 React 状态。`AgentPage` 将缓存映射为一个只在当前 task 活跃期间存在的临时 assistant 消息，传给 `ConversationMessageList`。

任务进入终态后，页面刷新会话查询；临时消息保持显示，直到查询结果中出现该 task 的 `ASSISTANT` 消息。随后移除临时消息，确保由稳定的数据库消息 key 接手 UI。任务失败时直接移除临时消息，不写入未完成回答。

## 错误与降级

- Provider 的流式请求异常沿用现有 `AiProviderError` 归一化，任务按既有重试/失败逻辑处理。
- SSE 订阅断开时，任务查询继续每秒轮询；不会补发历史 delta，但任务完成后会加载持久化消息。
- 解析最终 JSON 失败时，任务失败且不会创建 assistant 会话消息，符合当前事务语义。

## 验收标准

1. DeepSeek 最终回答的文本 delta 被发布为 `answer.delta` 事件。
2. 前端 reducer 能安全处理 `answer.delta`，并仅追加有效文本。
3. 活跃任务期间页面显示逐步增长的临时 assistant 气泡。
4. 完成后临时气泡平滑切换为与 task 关联的持久化 assistant 消息。
5. 既有工具调用、任务步骤、SSE 心跳和轮询降级行为保持可用。
6. 后端与前端的定向测试、类型检查和构建通过。
