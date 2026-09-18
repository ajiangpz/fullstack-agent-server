'use client';

import { useTranslation } from '@/i18n/use-translation';
import type { ConversationMessage } from '../types';

export function sortConversationMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => left.sequence - right.sequence);
}

export function ConversationMessageList({
  messages,
}: {
  messages: ConversationMessage[];
}) {
  const { t } = useTranslation();
  const ordered = sortConversationMessages(messages);

  if (ordered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-12 text-center text-sm text-zinc-500">
        {t('conversation.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ordered.map((message) => {
        const userMessage = message.role === 'USER';
        return (
          <article
            key={message.id}
            className={
              userMessage
                ? 'ml-auto max-w-3xl rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-4'
                : 'mr-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4'
            }
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {userMessage
                ? t('conversation.user')
                : t('conversation.agent')}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
              {message.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}
