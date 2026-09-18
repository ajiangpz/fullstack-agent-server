import { apiRequest } from '@/lib/api-client';
import { buildAiTaskQuery } from './query';
import type {
  AiTask,
  AiTaskQuery,
  CreateAiTaskInput,
  CreateAiTaskResponse,
  PaginatedAiTasks,
} from './types';

export function createAiTask(input: CreateAiTaskInput) {
  return apiRequest<CreateAiTaskResponse>('/ai-tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listAiTasks(query: AiTaskQuery) {
  return apiRequest<PaginatedAiTasks>(
    `/ai-tasks?${buildAiTaskQuery(query)}`,
  );
}

export function getAiTask(id: string) {
  return apiRequest<AiTask>(`/ai-tasks/${encodeURIComponent(id)}`);
}
