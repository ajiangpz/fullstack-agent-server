'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  LoaderCircle,
  MessageSquarePlus,
  Radio,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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

function resizeComposer(element: HTMLTextAreaElement | null) {
  if (!element) return;

  element.style.height = '0px';
  element.style.height = `${Math.min(element.scrollHeight, 176)}px`;
}

export function isAgentPromptSubmittable(prompt: string): boolean {
  return prompt.trim().length > 0;
}

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

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
    watch,
    formState: { errors },
  } = useForm<AgentPromptInput>({
    resolver: zodResolver(agentPromptSchema),
    defaultValues: { prompt: '' },
  });
  const promptRegistration = register('prompt');
  const promptValue = watch('prompt');

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

  const canSubmitPrompt = !isBusy && isAgentPromptSubmittable(promptValue);

  const messages = conversationQuery.data?.messages ?? [];
  const temporaryMessage = createTemporaryAssistantMessage({
    taskId,
    taskStatus: task?.status,
    streamedAnswer: taskQuery.streamedAnswer,
    messages,
    createdAt: task?.createdAt,
  });

  const hasConversation = messages.length > 0 || Boolean(temporaryMessage);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !shouldAutoScrollRef.current) return;

    const frame = requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [messages.length, temporaryMessage?.content, task?.status]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSuggestionsOpen(false);
    shouldAutoScrollRef.current = true;

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
      requestAnimationFrame(() => resizeComposer(textareaRef.current));
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
    setSuggestionsOpen(false);
    reset({ prompt: '' });
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      resizeComposer(textareaRef.current);
      textareaRef.current?.focus();
    });
  }

  function chooseSuggestion(prompt: string) {
    setValue('prompt', prompt, { shouldValidate: true });
    requestAnimationFrame(() => {
      resizeComposer(textareaRef.current);
      textareaRef.current?.focus();
    });
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-900 pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-400">
          {t('agent.section')}
        </p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
            {t('agent.title')}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={startNewConversation}
            className="shrink-0"
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            {t('conversation.new')}
          </Button>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          {t('agent.description')}
        </p>
      </div>

      <div
        ref={messagesViewportRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          shouldAutoScrollRef.current = distanceFromBottom < 120;
        }}
      >
        {activeConversationId && conversationQuery.isLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 px-5 py-16 text-sm text-zinc-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {t('conversation.loading')}
          </div>
        ) : null}

        {activeConversationId && conversationQuery.isError ? (
          <div className="flex min-h-72 items-center justify-center px-5 py-16 text-center text-sm text-red-300">
            {conversationQuery.error instanceof Error
              ? conversationQuery.error.message
              : t('conversation.restoreError')}
          </div>
        ) : null}

        {!conversationQuery.isLoading &&
        !conversationQuery.isError &&
        !hasConversation ? (
          <div className="flex min-h-full items-center justify-center px-4 py-10">
            <div className="w-full max-w-2xl -translate-y-6 text-center sm:-translate-y-10">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                {t('agent.welcome.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                {t('agent.welcome.description')}
              </p>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                {suggestionKeys.map((key) => {
                  const prompt = t(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/25 px-4 py-4 text-sm leading-6 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-100"
                      onClick={() => chooseSuggestion(prompt)}
                    >
                      <span className="block">{prompt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {!conversationQuery.isLoading &&
        !conversationQuery.isError &&
        hasConversation ? (
          <ConversationMessageList
            messages={messages}
            temporaryMessage={temporaryMessage}
          />
        ) : null}

        {task ? (
          <div className="mx-auto mb-8 w-full max-w-5xl px-1 sm:px-0">
            <div
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TaskStatusBadge status={task.status} />
                  {taskActive ? (
                    <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
                      {taskQuery.streamStatus === 'connected' ? (
                        <Radio className="h-3.5 w-3.5 text-cyan-400" />
                      ) : (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {taskQuery.streamStatus === 'connected'
                        ? t('agent.live.connected')
                        : t('agent.live.fallback')}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-cyan-300"
                >
                  {t('agent.trace.view')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {task.status === 'FAILED' ? (
                <div className="mt-3 flex items-start gap-3 border-t border-zinc-800 pt-3 text-sm text-red-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{t('conversation.failed')}</p>
                    <p className="mt-1 text-red-300/80">
                      {task.errorMessage ?? t('agent.task.noError')}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 shrink-0 border-t border-zinc-900 bg-zinc-950 pt-4">
        <div className="mx-auto w-full max-w-5xl">
          <div
            className="relative"
            onFocusCapture={() => {
              if (!isBusy && hasConversation) setSuggestionsOpen(true);
            }}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setSuggestionsOpen(false);
              }
            }}
          >
            {suggestionsOpen && !isBusy && hasConversation ? (
              <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 z-20 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  {t('agent.suggestions')}
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {suggestionKeys.map((key) => {
                    const prompt = t(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="rounded-xl px-3 py-2.5 text-left text-sm leading-5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                        onClick={() => chooseSuggestion(prompt)}
                      >
                        {prompt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <form
              ref={formRef}
              className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] transition focus-within:border-zinc-700 focus-within:bg-zinc-900"
              onSubmit={(event) => {
                void onSubmit(event);
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  className="max-h-44 min-h-[44px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={t('agent.placeholder')}
                  disabled={isBusy}
                  {...promptRegistration}
                  ref={(element) => {
                    promptRegistration.ref(element);
                    textareaRef.current = element;
                  }}
                  onInput={(event) => resizeComposer(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      canSubmitPrompt
                    ) {
                      event.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!canSubmitPrompt}
                  aria-label={t('conversation.send')}
                  title={t('conversation.send')}
                  className="h-10 w-10 shrink-0 rounded-full p-0"
                >
                  {createConversationMutation.isPending ||
                  createTaskMutation.isPending ||
                  taskActive ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>

          {errors.prompt &&
          errors.prompt.message !== 'validation.agent.required' ? (
            <p className="mt-2 px-3 text-xs text-red-400">
              {translateValidationMessage(errors.prompt.message, t)}
            </p>
          ) : null}

          {submitError ? (
            <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {submitError}
            </div>
          ) : null}

          {isBusy && !submitError ? (
            <p className="mt-2 px-3 text-xs text-zinc-600">
              {t('conversation.busy')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
