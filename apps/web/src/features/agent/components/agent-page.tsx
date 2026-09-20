'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { translateValidationMessage } from '@/i18n/validation';
import { ApiError } from '@/lib/api-client';
import { createAiTaskPayload } from '../conversation';
import {
  useConversation,
  useCreateConversation,
} from '../conversation-hooks';
import { useActiveConversationStore } from '../conversation-store';
import { useAiTaskRealtime, useCreateAiTask } from '../hooks';
import { agentPromptSchema, type AgentPromptInput } from '../schema';
import type { AiTaskStatus, ConversationMessage } from '../types';
import { ConversationMessageList } from './conversation-message-list';
import { TaskStatusBadge } from './task-status-badge';

const suggestionKeys: TranslationKey[] = [
  'agent.suggestion.offline',
  'agent.suggestion.portCount',
  'agent.suggestion.summary',
  'agent.suggestion.byName',
];

export function createTemporaryAssistantMessage({
  taskId,
  taskStatus,
  streamedAnswer,
  messages,
  createdAt,
}: {
  taskId: string | null;
  taskStatus: AiTaskStatus | undefined;
  streamedAnswer: string;
  messages: ConversationMessage[];
  createdAt: string | undefined;
}): ConversationMessage | undefined {
  if (!taskId || taskStatus === 'FAILED') return undefined;
  if (
    messages.some(
      (message) => message.taskId === taskId && message.role === 'ASSISTANT',
    )
  ) {
    return undefined;
  }

  return {
    id: `streaming-${taskId}`,
    taskId,
    role: 'ASSISTANT',
    content: streamedAnswer,
    sequence: Number.MAX_SAFE_INTEGER,
    createdAt: createdAt ?? '',
  };
}

export function AgentPage() {
  const queryClient = useQueryClient();
  const activeConversationId = useActiveConversationStore(
    (state) => state.activeConversationId,
  );
  const hasHydrated = useActiveConversationStore((state) => state.hasHydrated);
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
    hasHydrated ? activeConversationId : null,
  );
  const taskQuery = useAiTaskRealtime(taskId, activeConversationId);
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

  const task = taskQuery.data;
  const taskActive =
    task?.status === 'PENDING' || task?.status === 'PROCESSING';
  const conversationBusy = conversationQuery.data?.conversation.busy === true;
  const isBusy =
    createConversationMutation.isPending ||
    createTaskMutation.isPending ||
    conversationBusy ||
    taskActive;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        const conversation = await createConversationMutation.mutateAsync();
        conversationId = conversation.id;
        setActiveConversationId(conversation.id);
      }

      const created = await createTaskMutation.mutateAsync(
        createAiTaskPayload(conversationId, values.prompt),
      );
      setTaskId(created.taskId);
      reset({ prompt: '' });
      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : activeConversationId
            ? t('agent.createFailure')
            : t('conversation.createError'),
      );
    }
  });

  function startNewConversation() {
    clearActiveConversation();
    setTaskId(null);
    setSubmitError(null);
    reset({ prompt: '' });
  }

  const messages = conversationQuery.data?.messages ?? [];
  const temporaryMessage = createTemporaryAssistantMessage({
    taskId,
    taskStatus: task?.status,
    streamedAnswer: taskQuery.streamedAnswer,
    messages,
    createdAt: task?.createdAt,
  });

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
          type="button"
          variant="secondary"
          disabled={isBusy}
          onClick={startNewConversation}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {t('conversation.new')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-4">
          <Card className="min-h-[360px] overflow-hidden">
            {activeConversationId && conversationQuery.isLoading ? (
              <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm text-zinc-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t('conversation.loading')}
              </div>
            ) : null}

            {activeConversationId && conversationQuery.isError ? (
              <div className="px-5 py-12 text-center text-sm text-red-300">
                {conversationQuery.error instanceof Error
                  ? conversationQuery.error.message
                  : t('conversation.restoreError')}
              </div>
            ) : null}

            {!conversationQuery.isLoading && !conversationQuery.isError ? (
              <ConversationMessageList
                messages={messages}
                temporaryMessage={temporaryMessage}
              />
            ) : null}

            {taskActive ? (
              <div className="border-t border-zinc-800 px-5 py-4 text-sm text-cyan-200">
                <div className="flex items-center gap-3">
                  {taskQuery.streamStatus === 'connected' ? (
                    <Radio className="h-4 w-4" />
                  ) : (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  {taskQuery.streamStatus === 'connected'
                    ? t('agent.live.connected')
                    : t('agent.live.fallback')}
                </div>
              </div>
            ) : null}
          </Card>

          {task ? (
            <Card className="p-4" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <TaskStatusBadge status={task.status} />
                  <span className="font-mono text-xs text-zinc-600">
                    {task.id}
                  </span>
                </div>
                <Link
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                >
                  {t('agent.trace.view')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {task.status === 'FAILED' ? (
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
                <p className="text-sm text-zinc-500">
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
