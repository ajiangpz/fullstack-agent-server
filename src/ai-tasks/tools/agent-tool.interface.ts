import type { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';

export interface AgentContext {
  // 用户身份由 Worker 从数据库加载，不能使用模型或客户端提供的身份信息。
  user: AuthenticatedUser;
  taskId: string;
  leaseToken: string;
  signal: AbortSignal;
}

export interface AgentTool<
  TSchema extends z.ZodType = z.ZodType,
  TResult = unknown,
> {
  readonly name: string;
  readonly description: string;
  // schema 用于服务端运行时校验，parameters 是提供给模型的 JSON Schema。
  readonly schema: TSchema;
  readonly parameters: Record<string, unknown>;
  execute(input: z.infer<TSchema>, context: AgentContext): Promise<TResult>;
}
