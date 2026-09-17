'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, CheckCircle2, Clock3, LoaderCircle, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { useAiTask, useCreateAiTask } from '../hooks';
import { parseAiTaskResult } from '../result';
import { agentPromptSchema, type AgentPromptInput } from '../schema';
import type { AiTaskStatus } from '../types';
import { TaskStatusBadge } from './task-status-badge';

const SUGGESTED_PROMPTS = [
  'Which devices are currently offline?',
  'Show me devices with more than 24 ports.',
  'Summarize the current network device status.',
  'Check the details of a network device by name.',
];

const statusCopy: Record<AiTaskStatus, { title: string; description: string }> = {
  PENDING: {
    title: 'Queued',
    description: 'The task is waiting for an Agent worker.',
  },
  PROCESSING: {
    title: 'Agent is working',
    description: 'The runtime may call one or more device tools before answering.',
  },
  COMPLETED: {
    title: 'Completed',
    description: 'The Agent finished the task and returned a structured answer.',
  },
  FAILED: {
    title: 'Failed',
    description: 'The Agent could not complete this task after its execution attempts.',
  },
};

export function AgentPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateAiTask();
  const taskQuery = useAiTask(taskId);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AgentPromptInput>({
    resolver: zodResolver(agentPromptSchema),
    defaultValues: { prompt: '' },
  });

  const task = taskQuery.data;
  const parsedResult = parseAiTaskResult(task?.result ?? null);
  const isBusy = createMutation.isPending || task?.status === 'PENDING' || task?.status === 'PROCESSING';

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      setSubmittedPrompt(values.prompt);
      setTaskId(created.taskId);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Unable to create AI task.');
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-cyan-400">AI Operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Network Agent</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Ask questions about the devices available to your account. The backend Agent decides when to call network-device tools and returns a structured answer.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <Bot className="h-4 w-4 text-cyan-400" />
                Ask the network Agent
              </div>
              <textarea
                className="min-h-36 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500"
                placeholder="Which devices are offline?"
                disabled={createMutation.isPending}
                {...register('prompt')}
              />
              {errors.prompt ? <p className="text-sm text-red-400">{errors.prompt.message}</p> : null}
              {submitError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {submitError}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Run task
                </Button>
              </div>
            </form>
          </Card>

          {submittedPrompt ? (
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Your request</p>
              <p className="mt-3 text-sm leading-6 text-zinc-200">{submittedPrompt}</p>
            </Card>
          ) : null}

          {task ? (
            <Card className="p-5" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Agent task</p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-100">{statusCopy[task.status].title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">{statusCopy[task.status].description}</p>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>

              {(task.status === 'PENDING' || task.status === 'PROCESSING') ? (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Polling task status every second…
                </div>
              ) : null}

              {task.status === 'FAILED' ? (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Task failed</p>
                    <p className="mt-1 text-red-300/80">{task.errorMessage ?? 'No error detail was returned.'}</p>
                  </div>
                </div>
              ) : null}

              {task.status === 'COMPLETED' && parsedResult ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Final answer
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">{parsedResult.answer}</p>
                  </div>
                  {parsedResult.keyPoints.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Key points</p>
                      <ul className="mt-3 space-y-2">
                        {parsedResult.keyPoints.map((point, index) => (
                          <li key={`${index}-${point}`} className="flex gap-3 text-sm leading-6 text-zinc-400">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {task.status === 'COMPLETED' && !parsedResult ? (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                  The task completed, but the returned result did not match the expected answer format.
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 text-xs text-zinc-500 sm:grid-cols-3">
                <Metric label="Task ID" value={task.id} mono />
                <Metric label="Runtime steps" value={String(task.steps.length)} />
                <Metric label="Retries" value={String(task.retryCount)} />
              </div>
            </Card>
          ) : null}

          {taskQuery.isError ? (
            <Card className="border-red-500/20 p-5 text-sm text-red-300">
              {taskQuery.error instanceof Error ? taskQuery.error.message : 'Unable to load AI task.'}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Suggested prompts
            </div>
            <div className="mt-4 space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left text-sm leading-5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                  onClick={() => setValue('prompt', prompt, { shouldValidate: true })}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Clock3 className="h-4 w-4 text-cyan-400" />
              Phase 3 behavior
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Tasks are queued through BullMQ. This page polls the existing task endpoint every second until the task reaches COMPLETED or FAILED.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Full MODEL_CALL, TOOL_CALL and TOOL_RESULT visualization is intentionally reserved for Phase 4.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p>{label}</p>
      <p className={`mt-1 truncate text-zinc-300 ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}
