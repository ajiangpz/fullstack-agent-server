'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/use-translation';
import { sortConversationMessages } from '../conversation';
import type { ConversationMessage } from '../types';
import { MarkdownMessage } from './markdown-message';

export function ConversationMessageList({
  messages,
  temporaryMessage,
}: {
  messages: ConversationMessage[];
  temporaryMessage?: ConversationMessage;
}) {
  const { t } = useTranslation();
  const ordered = sortConversationMessages(messages);
  const rendered = temporaryMessage
    ? [...ordered, temporaryMessage]
    : ordered;

  if (rendered.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center px-5 py-16 text-center text-sm text-zinc-500">
        {t('conversation.empty')}
      </div>
    );
  }

  return (
    <div className="mr-auto w-full max-w-5xl space-y-7 px-1 pb-8 pt-5 sm:px-0">
      {rendered.map((message) => {
        const isUser = message.role === 'USER';
        const hasContent = message.content.trim().length > 0;

        if (isUser) {
          return (
            <div key={message.id} className="flex justify-end">
              <article className="max-w-[88%] rounded-3xl bg-zinc-800 px-4 py-3 text-zinc-100 sm:max-w-[78%]">
                <span className="sr-only">{t('conversation.user')}</span>
                <MarkdownMessage content={message.content} />
              </article>
            </div>
          );
        }

        return (
          <article
            key={message.id}
            className="mr-auto flex w-full max-w-4xl gap-3 text-zinc-200"
          >
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-semibold text-cyan-300">
              AI
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium text-zinc-500">
                {t('conversation.agent')}
              </p>
              {hasContent ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <div className="flex items-center gap-2 py-1 text-sm text-zinc-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t('agent.status.processing.title')}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
