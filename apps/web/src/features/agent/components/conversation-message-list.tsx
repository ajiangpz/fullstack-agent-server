'use client';

import { useTranslation } from '@/i18n/use-translation';
import { sortConversationMessages } from '../conversation-utils';
import type { ConversationMessage } from '../types';

export function ConversationMessageList({
  messages,
}: {
  messages: ConversationMessage[];
}) {
  const { t, intlLocale } = useTranslation();
  const ordered = sortConversationMessages(messages);

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-12 text-center text-sm text-zinc-500">
        {t('conversation.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {ordered.map((message) => {
        const userMessage = message.role === 'USER';

        return (
          <article
            key={message.id}
            className={`max-w-3xl rounded-2xl px-4 py-3 ${
              userMessage
                ? 'ml-auto border border-cyan-500/20 bg-cyan-500/10'
                : 'mr-auto border border-zinc-800 bg-zinc-900/60'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <p
                className={`text-xs font-medium ${
                  userMessage ? 'text-cyan-300' : 'text-zinc-400'
                }`}
              >
                {userMessage
                  ? t('conversation.user')
                  : t('conversation.agent')}
              </p>
              <time className="text-[11px] text-zinc-600">
                {formatTime(message.createdAt, intlLocale)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
              {message.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function formatTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}
