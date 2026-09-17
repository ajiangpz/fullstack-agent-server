import type { AiTaskStatus } from '../types';

const statusClass: Record<AiTaskStatus, string> = {
  PENDING: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  PROCESSING: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  COMPLETED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  FAILED: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export function TaskStatusBadge({ status }: { status: AiTaskStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass[status]}`}>
      {status}
    </span>
  );
}
