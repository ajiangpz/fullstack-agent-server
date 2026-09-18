# Network Agent 前端产品与架构规划

## 1. 产品定位

项目建议定位为：

> **Network Agent — AI 驱动的网络设备管理与运维平台**

目标不是仅实现一个传统网络设备 CRUD 后台，而是将现有的设备管理能力、AI Task、Agent Runtime、Tool Calling、AgentStep、BullMQ 等能力通过前端产品化，形成一个可演示、可扩展、适合作为全栈 / AI Agent 工程项目展示的完整系统。

核心价值：

- 管理网络设备及其运行状态。
- 通过自然语言让 Agent 查询、分析和操作网络设备。
- 可视化 Agent 的模型调用、工具调用、工具结果和最终回答过程。
- 展示异步任务、重试、执行状态和审计过程。
- 后续扩展端口、VLAN、PoE、流量、告警、拓扑等网络管理能力。

---

## 2. 当前后端基础

当前后端已经具备以下能力：

### 2.1 用户与权限

- JWT Authentication
- Passport JWT
- RBAC
- `ADMIN / USER`

### 2.2 设备管理

当前 `Device` 主要包含：

- `name`
- `ip`
- `portCount`
- `status`
- `ownerId`
- `createdAt`
- `updatedAt`

已具备：

- 设备列表
- 设备详情
- 新建设备
- 修改设备
- 删除设备
- 分页
- 关键词搜索
- 在线 / 离线筛选
- 端口数量筛选

### 2.3 AI Task

当前已有：

- 创建 AI Task
- 查询 AI Task
- BullMQ 异步任务
- Redis
- Worker
- Retry
- Task Lease
- Heartbeat
- 持久化 Conversation / ConversationMessage
- 每个 Conversation 同时最多一个运行中 Task
- 多轮 user / assistant 历史上下文
- 历史上下文最多 20 条消息 / 12,000 字符
- 浏览器恢复当前 Conversation

### 2.4 Agent Runtime

当前 Agent Runtime 已具备：

- Model Call
- Tool Call
- Tool Result
- Final Answer
- 最大 Step 限制
- Tool 参数 Schema 校验
- AgentStep 持久化
- OpenAI Provider
- Mock Provider
- Tool Registry

因此前端重点应该围绕这些现有能力设计，而不是先建设大量后端尚未存在的网络功能。

---

# 3. 产品整体信息架构

建议采用典型 SaaS / 运维控制台布局。

```text
┌──────────────────────────────────────────────────────────────┐
│ Network Agent                           Notifications  User   │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│ Overview     │                                               │
│              │                                               │
│ Devices      │                                               │
│  ├ All       │                 Main Content                  │
│  ├ Online    │                                               │
│  └ Offline   │                                               │
│              │                                               │
│ AI Agent     │                                               │
│              │                                               │
│ Tasks        │                                               │
│              │                                               │
│ Audit Logs   │                                               │
│              │                                               │
│ Settings     │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

建议路由：

```text
/login

/dashboard

/devices
/devices/[id]

/agent

/tasks
/tasks/[id]

/audit

/settings
```

---

# 4. MVP 页面规划

## 4.1 Login

路由：

```text
/login
```

功能：

- Username / Email
- Password
- 登录
- JWT 保存
- 登录状态恢复
- 401 自动退出

第一版不需要复杂视觉效果，保持干净、专业的 Network Operations 风格即可。

---

# 4.2 Dashboard

路由：

```text
/dashboard
```

目标：让用户进入系统以后快速看到当前设备和 Agent 系统状态。

建议模块：

```text
Devices
────────────────────
Total       128
Online      119
Offline       9

Agent Tasks
────────────────────
Running       3
Completed   218
Failed        4

Device Availability
────────────────────
92.9%
```

可以增加：

- 在线率图表
- 在线 / 离线设备分布
- 最近 AI Task
- 最近设备操作
- 最近 Audit Log

第一版数据不足时优先使用现有真实数据，不为了页面丰富而伪造复杂统计。

---

# 4.3 Devices

路由：

```text
/devices
```

页面主要结构：

```text
Devices

[ Search devices... ] [Status ▾] [Port Count ▾] [+ Add Device]

Name            IP               Ports     Status       Updated
-----------------------------------------------------------------
SW-Core-01      192.168.1.1       48       ● Online     1 min ago
SW-Access-01    192.168.1.10      24       ● Online     3 min ago
SW-Access-02    192.168.1.11      24       ● Offline    8 min ago

                           < 1 2 3 4 >
```

功能：

- 分页
- 搜索
- 状态筛选
- 最小端口数
- 最大端口数
- 新增设备
- 修改设备
- 删除设备
- 点击进入设备详情

推荐组件：

- DataTable
- Badge
- Dropdown
- Dialog
- Form
- Pagination
- Confirm Dialog

---

# 4.4 Device Detail

路由：

```text
/devices/[id]
```

第一版只展示当前后端实际存在的数据。

示例：

```text
SW-Core-01                         ONLINE
192.168.1.1

Device Information
──────────────────────────────────
Name            SW-Core-01
IP              192.168.1.1
Ports           48
Status          Online
Owner           John
Created         2026-08-01
Updated         2026-09-17

[ Edit Device ] [ Delete Device ]
```

不要在第一版展示后端还不存在的 CPU、Memory、VLAN、PoE 等真实指标。

这些能力应放入第二阶段。

---

# 4.5 AI Agent

路由：

```text
/agent
```

这是平台的核心页面之一。

页面不是普通 ChatGPT Clone，而应该突出 Network Operations 场景。

建议示例 Prompt：

```text
有哪些设备离线？

查询 24 口以上的交换机。

查看 SW-Core-01 的设备信息。

帮我分析当前设备状态。
```

页面布局建议：

```text
┌─────────────────────────────────────────────┐
│ AI Network Agent                            │
│                                             │
│ Ask questions about your network devices.  │
│                                             │
│ User                                        │
│ 哪些设备当前离线？                           │
│                                             │
│ Agent                                       │
│ 正在查询设备...                              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Tool: get_device / search_devices       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 当前发现 3 台离线设备……                      │
│                                             │
│ [ Ask about your network...            ] ↑ │
└─────────────────────────────────────────────┘
```

需要明确区分：

- User Message
- Agent Thinking State（仅展示产品状态，不展示模型私有推理）
- Tool Call
- Tool Result
- Final Answer

当前多轮会话实现：

- 首次发送时创建 Conversation，后续 Task 复用同一 conversationId。
- User / Assistant 消息持久化到 ConversationMessage。
- 同一 Conversation 串行执行，运行中禁止提交下一条消息。
- Processor 仅加载已完成回合，并对模型历史做 20 条消息 / 12,000 字符裁剪。
- 刷新页面后通过 localStorage 恢复当前 Conversation 和 active Task。
- Task SSE 继续保持 Task 维度，任务终态后刷新 Conversation messages。
- 当前版本不包含 LLM 历史摘要，后续可扩展 summary + recent messages。

---

# 4.6 Tasks

路由：

```text
/tasks
```

用于查看 Agent 历史任务。

表格建议：

```text
Task                  Status       Steps     Created
---------------------------------------------------------
Check offline devices Completed      5       16:32
Inspect SW-Core-01    Processing     3       16:35
Analyze devices       Failed         4       16:38
```

状态：

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

功能：

- Task 列表
- 状态筛选
- 查看详情
- 错误状态展示
- Retry 信息展示

如果后端暂时没有 Task List API，应在前端实现前补充对应接口，而不是使用本地假数据长期代替。

---

# 4.7 Agent Task Detail / Execution Trace

路由：

```text
/tasks/[id]
```

这是整个项目最值得重点建设的页面。

它直接展示自研 Agent Runtime 的内部执行流程。

示例：

```text
Task
Check offline network devices

Status: COMPLETED
Duration: 3.7s
Steps: 5

Execution Trace
────────────────────────────────────────────

● MODEL CALL
  Model: GPT
  Input tokens: 845
  Output tokens: 121

        ↓

● TOOL CALL
  Tool: search_devices

  Arguments
  {
    "status": "offline"
  }

        ↓

● TOOL RESULT

  Result
  {
    "count": 3,
    "devices": [...]
  }

        ↓

● MODEL CALL

        ↓

✓ FINAL ANSWER

  当前检测到 3 台离线设备……
```

每种 Step 使用不同视觉卡片：

### MODEL_CALL

显示：

- Model
- Input Token
- Output Token
- Duration
- Sequence

### TOOL_CALL

显示：

- Tool Name
- Tool Call ID
- Arguments
- Sequence

### TOOL_RESULT

显示：

- Tool Result
- Success / Failed
- Sequence

### FINAL_ANSWER

显示：

- 最终结果
- Task Status

后续可以支持：

- Collapse / Expand
- JSON Viewer
- Copy JSON
- Timeline
- Retry 标记
- Error Step 标记

---

# 4.8 Audit Logs

路由：

```text
/audit
```

显示系统关键操作记录。

示例：

```text
Action              User       Resource        Time
-----------------------------------------------------
DEVICE_CREATED      John       SW-Core-01      16:32
DEVICE_UPDATED      John       SW-Core-02      16:40
USER_LOGGED_IN      John       User            16:42
```

后期可增加：

- 用户筛选
- Action 筛选
- Resource 筛选
- 时间范围
- JSON Metadata 查看

---

# 5. 前端技术栈

建议：

```text
Next.js
React
TypeScript

Tailwind CSS
shadcn/ui

TanStack Query
Zustand

React Hook Form
Zod

ECharts
React Flow
```

职责划分：

## Next.js

负责：

- Routing
- Layout
- Page
- Authentication 页面结构
- App Shell

推荐使用 App Router。

---

## TanStack Query

负责所有 Server State：

```text
devices
ai-tasks
audit logs
current user
```

解决：

- Fetch
- Cache
- Loading
- Error
- Refetch
- Polling
- Mutation

不要把 API 数据大量存到 Zustand。

---

## Zustand

只管理 UI / Client State，例如：

- Sidebar 状态
- Agent Panel 状态
- Theme
- 用户界面偏好

---

## React Hook Form + Zod

用于：

- 登录
- 创建设备
- 修改设备
- Agent Prompt 表单

实现前后端一致的输入校验体验。

---

## shadcn/ui

用于：

- Button
- Input
- Dialog
- Sheet
- Dropdown
- Table
- Badge
- Form
- Tooltip
- Command

适合构建现代 SaaS 管理控制台。

---

## ECharts

后续用于：

- 在线率
- Device Status
- CPU
- Memory
- Port Traffic
- Error Rate
- Network Metrics

---

## React Flow

第二阶段用于网络拓扑：

```text
Internet
   │
Router
   │
Core Switch
   ├──────── Access Switch A
   │             ├── AP
   │             └── PC
   │
   └──────── Access Switch B
                 └── Camera
```

---

# 6. 前后端架构

整体架构：

```text
                    TypeScript

       Frontend                      Backend

   Next.js + React                  NestJS
          │                           │
   TanStack Query                    │
          │                           │
          └──────── REST API ─────────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                         ▼            ▼            ▼
                     PostgreSQL      Redis        OpenAI
                         │            │
                       Prisma       BullMQ
                                      │
                                    Worker
                                      │
                               Agent Runtime
                                      │
                                  ToolRegistry
```

---

# 7. Agent Task 前端交互设计

当前接口已经可以：

```text
POST /ai-tasks
GET /ai-tasks/:id
```

因此 MVP 可以采用 Polling。

流程：

```text
User Prompt
     │
     ▼
POST /ai-tasks
     │
     ▼
Task ID
     │
     ▼
GET /ai-tasks/:id
     │
     ├── PENDING
     │
     ├── PROCESSING
     │
     ├── COMPLETED
     │
     └── FAILED
```

前端：

```text
每 1 秒
GET /ai-tasks/:id
```

直到：

```text
COMPLETED
FAILED
```

即可停止 Polling。

推荐由 TanStack Query 负责：

```text
refetchInterval
```

---

# 8. SSE 实时更新

第二阶段增加：

```text
GET /ai-tasks/:id/events
```

采用 Server-Sent Events。

流程：

```text
Agent Runtime
     │
     ├── MODEL_CALL
     ├── TOOL_CALL
     ├── TOOL_RESULT
     └── FINAL_ANSWER
            │
            ▼
           SSE
            │
            ▼
         Browser
```

用户即可实时看到：

```text
Thinking...

Calling get_device...

Tool completed

Generating answer...
```

相比 WebSocket，这个场景第一版更适合 SSE，因为主要是服务端向浏览器单向推送任务状态。

---

# 9. AI Agent 与网络设备结合

AI Agent 不应该只是聊天。

应该围绕网络设备提供实际 Tool。

第一阶段：

```text
get_device
search_devices
list_devices
```

用户可以问：

```text
有哪些设备离线？

找出端口数超过 24 的设备。

查询 SW-Core-01。
```

第二阶段：

```text
get_device_ports
get_device_metrics
get_vlan_config
get_poe_status
get_device_events
```

用户可以问：

```text
为什么 SW-Core-01 流量突然升高？

哪个端口错误包最多？

检查 VLAN 10 是否存在异常。

哪些 PoE 端口功耗异常？
```

第三阶段再考虑带副作用操作：

```text
disable_port
restart_device
update_vlan
change_poe
```

所有有副作用的 Tool 都应该增加：

```text
Permission Check
        ↓
Parameter Validation
        ↓
User Confirmation
        ↓
Tool Execution
        ↓
Audit Log
```

---

# 10. 网络设备管理能力演进

当前 Device 数据模型比较基础。

后续建议逐渐扩展成：

```text
Device
│
├── Interfaces
│   ├── name
│   ├── linkStatus
│   ├── speed
│   ├── rxTraffic
│   ├── txTraffic
│   ├── errors
│   └── vlan
│
├── VLAN
│
├── PoE
│
├── Metrics
│   ├── CPU
│   ├── Memory
│   ├── Temperature
│   └── Uptime
│
├── Events
│
└── Config
```

---

# 11. Device Detail 第二阶段形态

后续设备详情页面可以升级为：

```text
SW-Core-01                         ONLINE
192.168.1.10

CPU        31%
Memory     54%
Uptime     32d

Ports
────────────────────────────────────────────
1       UP       1G       VLAN 10
2       UP       1G       VLAN 20
3       DOWN     --       VLAN 10
4       UP       10G      Trunk

Traffic
────────────────────────────────────────────
RX        ───────────╮
                    ╰─────────
TX        ─────╮
               ╰──────────────
```

Tabs 可以设计为：

```text
Overview
Ports
VLAN
PoE
Traffic
Events
Configuration
```

---

# 12. 网络拓扑

后续增加：

```text
/topology
```

使用 React Flow。

第一版拓扑不需要实现真实 LLDP Discovery，可以先由数据库中的关系数据生成。

后续再增加：

- LLDP
- MAC Table
- ARP
- Neighbor Discovery

最终让 Agent 可以回答：

```text
AP-Office-01 连接在哪台交换机？

SW-Access-03 的上联设备是什么？

从 Camera-01 到 Gateway 的路径是什么？
```

---

# 13. 前端目录结构建议

建议前端单独目录：

```text
apps/web
```

未来项目可以演进成：

```text
fullstack-agent-server
│
├── apps
│   └── web
│       ├── app
│       ├── components
│       ├── features
│       ├── hooks
│       ├── lib
│       ├── stores
│       └── types
│
├── src
│   ├── auth
│   ├── devices
│   ├── ai-tasks
│   ├── audit
│   └── ...
│
├── prisma
│
└── docs
```

如果不希望立即进行 Monorepo 重构，也可以先建立独立前端仓库。

从作品完整性角度，更推荐最终形成 Monorepo。

---

# 14. 前端 feature 目录建议

```text
features
│
├── auth
│   ├── api
│   ├── components
│   ├── hooks
│   └── types
│
├── devices
│   ├── api
│   ├── components
│   ├── hooks
│   └── types
│
├── agent
│   ├── api
│   ├── components
│   ├── hooks
│   └── types
│
├── tasks
│
└── audit
```

避免把所有业务组件都堆到：

```text
components/
```

---

# 15. UI 设计方向

建议视觉风格：

```text
Modern SaaS
+
Network Operations Console
+
AI Developer Tool
```

参考方向可以关注：

- Vercel Dashboard
- Linear
- Grafana
- Cloudflare Dashboard
- Datadog
- Sentry

设计原则：

- 信息密度高但不过度拥挤
- 大量使用灰阶
- 状态颜色只承担状态含义
- Online / Success 使用绿色
- Failed / Offline 使用红色
- Processing 使用蓝色
- Pending 使用灰色
- Agent Trace 优先保证信息可读性

不要使用大量渐变、玻璃拟态和无意义动画影响运维信息展示。

---

# 16. MVP 范围

第一阶段只完成：

```text
Login
  ↓
Dashboard
  ↓
Devices
  ↓
Device Detail
  ↓
AI Agent
  ↓
Agent Task Trace
  ↓
Audit Log
```

核心重点：

```text
Device CRUD
+
Agent
+
Agent Trace
+
Audit
```

暂时不做：

- 真实 SNMP
- LLDP Discovery
- VLAN 配置
- PoE 配置
- 网络拓扑自动发现
- Prometheus
- 大规模 Metrics

这些能力放到后续阶段。

---

# 17. 开发阶段建议

## Phase 1：Frontend Foundation

目标：搭建前端基本框架。

实现：

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- App Layout
- Login
- API Client
- JWT
- TanStack Query

---

## Phase 2：Device Management

实现：

- Devices List
- Pagination
- Search
- Status Filter
- Port Filter
- Create Device
- Edit Device
- Delete Device
- Device Detail

---

## Phase 3：AI Agent

实现：

- Agent Prompt
- Create AI Task
- Polling
- Task Status
- Final Answer

---

## Phase 4：Agent Trace

实现：

- Task Detail
- MODEL_CALL
- TOOL_CALL
- TOOL_RESULT
- FINAL_ANSWER
- Error Step
- JSON Viewer
- Token Usage

这一阶段是作品展示重点。

---

## Phase 5：Realtime Agent

实现：

- SSE
- Agent Step Streaming
- 实时 Task Status

---

## Phase 6：Network Management Enhancement

逐步增加：

- Interface
- Port Status
- Traffic
- VLAN
- PoE
- Metrics
- Events

---

## Phase 7：Topology

实现：

- React Flow
- Device Relationships
- Topology View
- Agent Topology Query

---

# 18. 项目最终展示重点

这个项目最终不应被描述成：

> 一个 NestJS CRUD 项目。

也不应只描述成：

> 一个 AI Chat 项目。

更合适的描述是：

> 基于 Next.js、NestJS、PostgreSQL、Redis、BullMQ 和 OpenAI Responses API 构建的 AI 网络设备管理与运维平台。平台自研 Agent Runtime 和 Tool Calling 执行链路，支持异步 Agent Task、AgentStep 持久化、任务租约与重试、设备工具调用、RBAC、Audit Log，并通过前端 Agent Execution Trace 对模型调用、工具调用及结果进行可视化。

最终技术结构：

```text
Next.js
React
TypeScript
TanStack Query
shadcn/ui
        │
        │ REST / SSE
        ▼
NestJS
        │
        ├── Auth / RBAC
        ├── Devices
        ├── Audit
        ├── AI Tasks
        └── Agent Runtime
                │
                ├── Tool Registry
                ├── AgentStep
                └── AI Provider
                        │
                      OpenAI

PostgreSQL + Prisma
Redis + BullMQ
Docker
```

这是后续前端开发、后端扩展和项目展示的统一产品方向。
