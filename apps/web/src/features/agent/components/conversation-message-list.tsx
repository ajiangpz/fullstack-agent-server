'use client';

import { useTranslation } from '@/i18n/use-translation';
import { sortConversationMessages } from '../conversation';
import type { ConversationMessage } from '../types';

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
      <div className="px-5 py-16 text-center text-sm text-zinc-500">
        {t('conversation.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {rendered.map((message) => {
        const isUser = message.role === 'USER';

        return (
          <article
            key={message.id}
            className={`max-w-3xl rounded-2xl px-4 py-3 ${
              isUser
                ? 'ml-auto bg-cyan-500/10 text-zinc-100'
                : 'mr-auto border border-zinc-800 bg-zinc-900/60 text-zinc-200'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {isUser ? t('conversation.user') : t('conversation.agent')}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
              {message.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}
