import { z } from 'zod';
import type { AiTaskResult, AiTaskStatus } from './types';

const aiTaskResultSchema = z
  .object({
    answer: z.string().trim().min(1),
    keyPoints: z.array(z.string().trim().min(1)),
  })
  .strict();

export function parseAiTaskResult(value: string | null): AiTaskResult | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    const result = aiTaskResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isTerminalTaskStatus(status: AiTaskStatus) {
  return status === 'COMPLETED' || status === 'FAILED';
}
