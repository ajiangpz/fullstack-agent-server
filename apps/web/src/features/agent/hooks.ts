import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createAiTask, getAiTask, listAiTasks } from './api';
import { streamAiTaskEvents } from './events-api';
import { isTerminalTaskStatus } from './result';
import { reduceAiTaskStreamEvent } from './stream';
import type { AiTask, AiTaskQuery } from './types';

export type AiTaskStreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'fallback';

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

export function useAiTask(
  taskId: string | null,
  pollingEnabled = true,
) {
  return useQuery({
    queryKey: ['ai-task', taskId],
    queryFn: () => getAiTask(taskId as string),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      if (!taskId || !pollingEnabled) return false;
      const status = query.state.data?.status;
      return status && isTerminalTaskStatus(status) ? false : 1_000;
    },
  });
}

export function useAiTaskRealtime(taskId: string | null) {
  const streamStatus = useAiTaskStream(taskId);
  const taskQuery = useAiTask(taskId, streamStatus !== 'connected');

  return { ...taskQuery, streamStatus };
}

function useAiTaskStream(taskId: string | null): AiTaskStreamStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AiTaskStreamStatus>(
    taskId ? 'connecting' : 'idle',
  );

  useEffect(() => {
    if (!taskId) {
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (disposed) return;
      setStatus('connecting');

      try {
        await streamAiTaskEvents(taskId, {
          signal: controller.signal,
          onOpen: () => {
            if (!disposed) setStatus('connected');
          },
          onEvent: (event) => {
            queryClient.setQueryData<AiTask>(
              ['ai-task', taskId],
              (current) => reduceAiTaskStreamEvent(current, event),
            );
          },
        });

        if (disposed) return;

        const current = queryClient.getQueryData<AiTask>([
          'ai-task',
          taskId,
        ]);
        if (current && isTerminalTaskStatus(current.status)) {
          setStatus('idle');
          return;
        }
      } catch {
        if (disposed || controller.signal.aborted) return;
      }

      setStatus('fallback');
      retryTimer = setTimeout(() => {
        void connect();
      }, 3_000);
    };

    void connect();

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [queryClient, taskId]);

  return status;
}
