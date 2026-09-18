import { useMutation, useQuery } from '@tanstack/react-query';
import { createAiTask, getAiTask, listAiTasks } from './api';
import { isTerminalTaskStatus } from './result';
import type { AiTaskQuery } from './types';

export function useCreateAiTask() {
  return useMutation({ mutationFn: createAiTask });
}

export function useAiTasks(query: AiTaskQuery) {
  return useQuery({
    queryKey: ['ai-tasks', query],
    queryFn: () => listAiTasks(query),
    refetchInterval: (result) => {
      const items = result.state.data?.items;
      return items?.some(
        (task) => task.status === 'PENDING' || task.status === 'PROCESSING',
      )
        ? 2_000
        : false;
    },
  });
}

export function useAiTask(taskId: string | null) {
  return useQuery({
    queryKey: ['ai-task', taskId],
    queryFn: () => getAiTask(taskId as string),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      if (!taskId) return false;
      const status = query.state.data?.status;
      return status && isTerminalTaskStatus(status) ? false : 1_000;
    },
  });
}
