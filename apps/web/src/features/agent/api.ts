import { apiRequest } from '@/lib/api-client';
import type { AgentPromptInput } from './schema';
import type { AiTask, CreateAiTaskResponse } from './types';

export function createAiTask(input: AgentPromptInput) {
  return apiRequest<CreateAiTaskResponse>('/ai-tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAiTask(id: string) {
  return apiRequest<AiTask>(`/ai-tasks/${encodeURIComponent(id)}`);
}
