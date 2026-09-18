'use client';

import {
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Database,
  Wrench,
} from 'lucide-react';
import { useTranslation } from '@/i18n/use-translation';
import type { TranslationKey } from '@/i18n/types';
import { parseAiTaskResult } from '../result';
import {
  asRecord,
  getStepDurationMs,
  getToolCallMetadata,
  parseStepPayload,
} from '../trace';
import type { AgentStep, AgentStepStatus, AgentStepType } from '../types';

const stepTitle: Record<AgentStepType, TranslationKey> = {
  MODEL_CALL: 'trace.step.modelCall',
  TOOL_CALL: 'trace.step.toolCall',
  TOOL_RESULT: 'trace.step.toolResult',
  FINAL_ANSWER: 'trace.step.finalAnswer',
};

const statusClass: Record<AgentStepStatus, string> = {
  RUNNING: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  COMPLETED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  FAILED: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const statusKey: Record<AgentStepStatus, TranslationKey> = {
  RUNNING: 'common.status.running',
  COMPLETED: 'common.status.completed',
  FAILED: 'common.status.failed',
};

export function ExecutionTrace({ steps }: { steps: AgentStep[] }) {
  const orderedSteps = [...steps].sort((a, b) => a.sequence - b.sequence);
  const { t, intlLocale } = useTranslation();

  if (orderedSteps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-10 text-center text-sm text-zinc-500">
        {t('trace.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orderedSteps.map((step, index) => (
        <div key={step.id} className="relative pl-8">
          {index < orderedSteps.length - 1 ? (
            <div className="absolute bottom-[-14px] left-[13px] top-8 w-px bg-zinc-800" />
          ) : null}
          <div className="absolute left-0 top-5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300">
            <StepIcon type={step.type} />
          </div>
          <details
            className="group rounded-xl border border-zinc-800 bg-zinc-950/60"
            open={step.status === 'FAILED' || step.type === 'FINAL_ANSWER'}
          >
            <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">
                    #{step.sequence}
                  </span>
                  <h3 className="text-sm font-medium text-zinc-100">
                    {t(stepTitle[step.type])}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDuration(getStepDurationMs(step), t)} ·{' '}
                  {formatTimestamp(step.startedAt, intlLocale)}
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass[step.status]}`}
              >
                {t(statusKey[step.status])}
              </span>
            </summary>
            <div className="border-t border-zinc-800 px-4 py-4">
              <StepDetails step={step} />
              {step.errorMessage ? (
                <div className="mt-4 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-sm text-red-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{step.errorMessage}</span>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

function StepDetails({ step }: { step: AgentStep }) {
  const { t } = useTranslation();

  if (step.type === 'MODEL_CALL') {
    const output = asRecord(parseStepPayload(step.output));
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Meta label={t('trace.model')} value={stringValue(output?.model)} />
          <Meta
            label={t('trace.inputTokens')}
            value={numberValue(output?.inputTokens)}
          />
          <Meta
            label={t('trace.outputTokens')}
            value={numberValue(output?.outputTokens)}
          />
        </div>
        <JsonBlock
          label={t('trace.modelMetadata')}
          value={output ?? parseStepPayload(step.output)}
        />
      </div>
    );
  }

  if (step.type === 'TOOL_CALL') {
    const metadata = getToolCallMetadata(step.input);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Meta label={t('trace.tool')} value={metadata.name} mono />
          <Meta
            label={t('trace.toolCallId')}
            value={metadata.toolCallId ?? '—'}
            mono
          />
        </div>
        <JsonBlock label={t('trace.arguments')} value={metadata.arguments} />
      </div>
    );
  }

  if (step.type === 'TOOL_RESULT') {
    const output = asRecord(parseStepPayload(step.output));
    return (
      <JsonBlock
        label={t('trace.result')}
        value={output && 'result' in output ? output.result : output}
      />
    );
  }

  const result = parseAiTaskResult(step.output);
  if (result) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">
          {result.answer}
        </p>
        {result.keyPoints.length > 0 ? (
          <ul className="space-y-2 text-sm leading-6 text-zinc-400">
            {result.keyPoints.map((point, index) => (
              <li key={`${index}-${point}`} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return <JsonBlock label={t('trace.output')} value={parseStepPayload(step.output)} />;
}

function StepIcon({ type }: { type: AgentStepType }) {
  const className = 'h-3.5 w-3.5';
  if (type === 'MODEL_CALL') return <BrainCircuit className={className} />;
  if (type === 'TOOL_CALL') return <Wrench className={className} />;
  if (type === 'TOOL_RESULT') return <Database className={className} />;
  return <CheckCircle2 className={className} />;
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p
        className={`mt-1 truncate text-sm text-zinc-300 ${
          mono ? 'font-mono text-xs' : ''
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const content =
    typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs leading-6 text-zinc-400">
        {content}
      </pre>
    </div>
  );
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : '—';
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? String(value) : '—';
}

function formatDuration(
  durationMs: number | null,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (durationMs === null) return t('common.status.running');
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(2)} s`;
}

function formatTimestamp(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
}
