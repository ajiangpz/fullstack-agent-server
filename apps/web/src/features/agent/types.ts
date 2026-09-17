export type AiTaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AgentStepType = 'MODEL_CALL' | 'TOOL_CALL' | 'TOOL_RESULT' | 'FINAL_ANSWER';
export type AgentStepStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AiTaskResult {
  answer: string;
  keyPoints: string[];
}

export interface AgentStep {
  id: string;
  taskId: string;
  type: AgentStepType;
  status: AgentStepStatus;
  sequence: number;
  input: string | null;
  output: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiTask {
  id: string;
  prompt: string;
  status: AiTaskStatus;
  result: string | null;
  errorMessage: string | null;
  attempts: number;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AgentStep[];
}

export interface CreateAiTaskResponse {
  taskId: string;
}
