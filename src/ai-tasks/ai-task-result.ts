import { z } from 'zod';

export const AiTaskResultSchema = z
  .object({
    answer: z.string().trim().min(1, 'answer must not be empty'),
    keyPoints: z.array(
      z.string().trim().min(1, 'keyPoints must not contain empty items'),
    ),
  })
  .strict();

export type AiTaskResult = z.infer<typeof AiTaskResultSchema>;

export const AI_TASK_RESULT_JSON_SCHEMA = createJsonSchema();

export function parseAiTaskResult(value: string): AiTaskResult {
  const cleanedValue = cleanAiTaskResultText(value);
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanedValue);
  } catch (error) {
    throw new InvalidAiTaskResultError('AI response is not valid JSON', {
      cause: error,
    });
  }

  return validateAiTaskResult(parsed);
}

export function cleanAiTaskResultText(value: string): string {
  const trimmedValue = value.trim();
  const fencedJson = trimmedValue.match(
    /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i,
  );

  return (fencedJson?.[1] ?? trimmedValue).trim();
}

export function validateAiTaskResult(value: unknown): AiTaskResult {
  const result = AiTaskResultSchema.safeParse(value);

  if (!result.success) {
    throw new InvalidAiTaskResultError(
      `AI response validation failed: ${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }

  return result.data;
}

export class InvalidAiTaskResultError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidAiTaskResultError';
  }
}

function createJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AiTaskResultSchema, { target: 'draft-7' });
  delete schema.$schema;
  return schema;
}
