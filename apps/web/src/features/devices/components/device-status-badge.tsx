'use client';

import { useTranslation } from '@/i18n/use-translation';
import type { DeviceStatus } from '../types';

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const online = status === 'online';
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
        online
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/20 bg-red-500/10 text-red-300'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          online ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      {online ? t('common.status.online') : t('common.status.offline')}
    </span>
  );
}
