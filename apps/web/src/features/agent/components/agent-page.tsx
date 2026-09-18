'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Radio,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { translateValidationMessage } from '@/i18n/validation';
import { ApiError } from '@/lib/api-client';
import { useAiTaskRealtime, useCreateAiTask } from '../hooks';
import { parseAiTaskResult } from '../result';
import { agentPromptSchema, type AgentPromptInput } from '../schema';
import type { AiTaskStatus } from '../types';
import { TaskStatusBadge } from './task-status-badge';

const statusCopy: Record<
  AiTaskStatus,
  { title: TranslationKey; description: TranslationKey }
> = {
  PENDING: {
    title: 'agent.status.pending.title',
    description: 'agent.status.pending.description',
  },
  PROCESSING: {
    title: 'agent.status.processing.title',
    description: 'agent.status.processing.description',
  },
  COMPLETED: {
    title: 'agent.status.completed.title',
    description: 'agent.status.completed.description',
  },
  FAILED: {
    title: 'agent.status.failed.title',
    description: 'agent.status.failed.description',
  },
};

const suggestionKeys: TranslationKey[] = [
  'agent.suggestion.offline',
  'agent.suggestion.portCount',
  'agent.suggestion.summary',
  'agent.suggestion.byName',
];

export function AgentPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateAiTask();
  const taskQuery = useAiTaskRealtime(taskId);
  const { t } = useTranslation();
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

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      setSubmittedPrompt(values.prompt);
      setTaskId(created.taskId);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : t('agent.createFailure'),
      );
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-cyan-400">{t('agent.section')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t('agent.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          {t('agent.description')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void onSubmit(event);
              }}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <Bot className="h-4 w-4 text-cyan-400" />
                {t('agent.ask')}
              </div>
              <textarea
                className="min-h-36 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500"
                placeholder={t('agent.placeholder')}
                disabled={createMutation.isPending}
                {...register('prompt')}
              />
              {errors.prompt ? (
                <p className="text-sm text-red-400">
                  {translateValidationMessage(errors.prompt.message, t)}
                </p>
              ) : null}
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
                  {t('agent.run')}
                </Button>
              </div>
            </form>
          </Card>

          {submittedPrompt ? (
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {t('agent.request')}
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-200">
                {submittedPrompt}
              </p>
            </Card>
          ) : null}

          {task ? (
            <Card className="p-5" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {t('agent.task')}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-100">
                    {t(statusCopy[task.status].title)}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {t(statusCopy[task.status].description)}
                  </p>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>

              {task.status === 'PENDING' || task.status === 'PROCESSING' ? (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
                  {taskQuery.streamStatus === 'connected' ? (
                    <Radio className="h-4 w-4" />
                  ) : (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  {taskQuery.streamStatus === 'connected'
                    ? t('agent.live.connected')
                    : t('agent.live.fallback')}
                </div>
              ) : null}

              {task.status === 'FAILED' ? (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{t('agent.task.failed')}</p>
                    <p className="mt-1 text-red-300/80">
                      {task.errorMessage ?? t('agent.task.noError')}
                    </p>
                  </div>
                </div>
              ) : null}

              {task.status === 'COMPLETED' && parsedResult ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      {t('agent.finalAnswer')}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                      {parsedResult.answer}
                    </p>
                  </div>
                  {parsedResult.keyPoints.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-zinc-300">
                        {t('agent.keyPoints')}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {parsedResult.keyPoints.map((point, index) => (
                          <li
                            key={`${index}-${point}`}
                            className="flex gap-3 text-sm leading-6 text-zinc-400"
                          >
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
                  {t('agent.result.invalid')}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 text-xs text-zinc-500 sm:grid-cols-3">
                <Metric label={t('agent.metric.taskId')} value={task.id} mono />
                <Metric
                  label={t('agent.metric.steps')}
                  value={String(task.steps.length)}
                />
                <Metric
                  label={t('agent.metric.retries')}
                  value={String(task.retryCount)}
                />
              </div>

              <Link
                href={`/tasks/${encodeURIComponent(task.id)}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
              >
                {t('agent.trace.view')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          ) : null}

          {taskQuery.isError ? (
            <Card className="border-red-500/20 p-5 text-sm text-red-300">
              {taskQuery.error instanceof Error
                ? taskQuery.error.message
                : t('agent.loadError')}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              {t('agent.suggestions')}
            </div>
            <div className="mt-4 space-y-2">
              {suggestionKeys.map((key) => {
                const prompt = t(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left text-sm leading-5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                    onClick={() =>
                      setValue('prompt', prompt, { shouldValidate: true })
                    }
                  >
                    {prompt}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Clock3 className="h-4 w-4 text-cyan-400" />
              {t('agent.observable.title')}
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {t('agent.observable.description1')}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {t('agent.observable.description2')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p>{label}</p>
      <p
        className={`mt-1 truncate text-zinc-300 ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
