import { useMutation, useQuery } from '@tanstack/react-query';
import { createAiTask, getAiTask } from './api';
import { isTerminalTaskStatus } from './result';

export function useCreateAiTask() {
  return useMutation({ mutationFn: createAiTask });
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
