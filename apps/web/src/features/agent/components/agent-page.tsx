'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Clock3,
  LoaderCircle,
  MessageSquarePlus,
  Radio,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { translateValidationMessage } from '@/i18n/validation';
import { ApiError } from '@/lib/api-client';
import { useCreateConversation, useConversation } from '../conversation-hooks';
import { useActiveConversationStore } from '../conversation-store';
import { createAiTaskPayload } from '../conversation-utils';
import { useAiTaskRealtime, useCreateAiTask } from '../hooks';
import { agentPromptSchema, type AgentPromptInput } from '../schema';
import type { AiTaskStatus } from '../types';
import { ConversationMessageList } from './conversation-message-list';
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
  const queryClient = useQueryClient();
  const activeConversationId = useActiveConversationStore(
    (state) => state.activeConversationId,
  );
  const hasConversationHydrated = useActiveConversationStore(
    (state) => state.hasHydrated,
  );
  const hydrateConversation = useActiveConversationStore(
    (state) => state.hydrate,
  );
  const setActiveConversationId = useActiveConversationStore(
    (state) => state.setActiveConversationId,
  );
  const clearActiveConversation = useActiveConversationStore(
    (state) => state.clearActiveConversation,
  );

  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createConversationMutation = useCreateConversation();
  const createTaskMutation = useCreateAiTask();
  const conversationQuery = useConversation(
    hasConversationHydrated ? activeConversationId : null,
  );
  const taskQuery = useAiTaskRealtime(taskId, activeConversationId);
  const task = taskQuery.data;
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AgentPromptInput>({
    resolver: zodResolver(agentPromptSchema),
    defaultValues: { prompt: '' },
  });

  useEffect(() => {
    hydrateConversation();
  }, [hydrateConversation]);

  useEffect(() => {
    const restoredTaskId = conversationQuery.data?.activeTaskId;
    if (restoredTaskId) {
      setTaskId(restoredTaskId);
    }
  }, [conversationQuery.data?.activeTaskId]);

  const taskActive =
    task?.status === 'PENDING' || task?.status === 'PROCESSING';
  const isBusy =
    conversationQuery.data?.conversation.busy === true ||
    createConversationMutation.isPending ||
    createTaskMutation.isPending ||
    (Boolean(taskId) && taskQuery.isLoading) ||
    taskActive;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    let conversationId = activeConversationId;

    if (!conversationId) {
      try {
        const createdConversation =
          await createConversationMutation.mutateAsync();
        conversationId = createdConversation.id;
        setActiveConversationId(createdConversation.id);
      } catch (error) {
        setSubmitError(
          error instanceof ApiError
            ? error.message
            : t('conversation.createError'),
        );
        return;
      }
    }

    try {
      const createdTask = await createTaskMutation.mutateAsync(
        createAiTaskPayload(conversationId, values.prompt),
      );
      setTaskId(createdTask.taskId);
      reset({ prompt: '' });
      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
    } catch (error) {
      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
      setSubmitError(
        error instanceof ApiError ? error.message : t('agent.createFailure'),
      );
    }
  });

  function startNewConversation() {
    clearActiveConversation();
    setTaskId(null);
    setSubmitError(null);
    reset({ prompt: '' });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-cyan-400">{t('agent.section')}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t('agent.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {t('agent.description')}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={
            createConversationMutation.isPending || createTaskMutation.isPending
          }
          onClick={startNewConversation}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {t('conversation.new')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            {!hasConversationHydrated ||
            (activeConversationId && conversationQuery.isLoading) ? (
              <div className="flex items-center gap-3 py-10 text-sm text-zinc-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t('conversation.loading')}
              </div>
            ) : null}

            {activeConversationId && conversationQuery.isError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-300">
                {conversationQuery.error instanceof Error
                  ? conversationQuery.error.message
                  : t('conversation.restoreError')}
              </div>
            ) : null}

            {hasConversationHydrated &&
            (!activeConversationId || conversationQuery.data) ? (
              <ConversationMessageList
                messages={conversationQuery.data?.messages ?? []}
              />
            ) : null}

            {task?.status === 'FAILED' ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{t('conversation.failed')}</p>
                  <p className="mt-1 text-red-300/80">
                    {task.errorMessage ?? t('agent.task.noError')}
                  </p>
                </div>
              </div>
            ) : null}
          </Card>

          {task ? (
            <Card className="p-5" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {t('agent.task')}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-100">
                    {t(statusCopy[task.status].title)}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {t(statusCopy[task.status].description)}
                  </p>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>

              {taskActive ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
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

              <Link
                href={'/tasks/' + encodeURIComponent(task.id)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
              >
                {t('agent.trace.view')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          ) : null}

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
                className="min-h-28 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={t('agent.placeholder')}
                disabled={isBusy}
                {...register('prompt')}
              />
              {errors.prompt ? (
                <p className="text-sm text-red-400">
                  {translateValidationMessage(errors.prompt.message, t)}
                </p>
              ) : null}
              {isBusy ? (
                <p className="text-xs text-zinc-500">
                  {t('conversation.busy')}
                </p>
              ) : null}
              {submitError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {submitError}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={isBusy}>
                  {createConversationMutation.isPending ||
                  createTaskMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {t('conversation.send')}
                </Button>
              </div>
            </form>
          </Card>

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
                    disabled={isBusy}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left text-sm leading-5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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
