'use client';

import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import type { AiTaskStatus } from '../types';

const statusClass: Record<AiTaskStatus, string> = {
  PENDING: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  PROCESSING: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  COMPLETED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  FAILED: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const statusKey: Record<AiTaskStatus, TranslationKey> = {
  PENDING: 'common.status.pending',
  PROCESSING: 'common.status.processing',
  COMPLETED: 'common.status.completed',
  FAILED: 'common.status.failed',
};

export function TaskStatusBadge({ status }: { status: AiTaskStatus }) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass[status]}`}
    >
      {t(statusKey[status])}
    </span>
  );
}
