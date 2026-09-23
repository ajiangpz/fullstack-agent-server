import { z } from 'zod';

const keyPointSchema = z
  .string()
  .trim()
  .min(1, 'keyPoints must not contain empty items');

export const AiTaskResultSchema = z
  .object({
    answer: z.string().trim().min(1, 'answer must not be empty'),
    keyPoints: z.array(keyPointSchema),
  })
  .strict();

export const AiTaskKeyPointsSchema = z
  .object({
    keyPoints: z.array(keyPointSchema),
  })
  .strict();

export type AiTaskResult = z.infer<typeof AiTaskResultSchema>;

export const AI_TASK_KEY_POINTS_JSON_SCHEMA = createJsonSchema(
  AiTaskKeyPointsSchema,
);

export function parseAiTaskResult(value: string): AiTaskResult {
  return validateAiTaskResult(parseJson(value));
}

export function parseAiTaskKeyPoints(value: string): string[] {
  const result = AiTaskKeyPointsSchema.safeParse(parseJson(value));

  if (!result.success) {
    throw new InvalidAiTaskResultError(
      `AI key-points validation failed: ${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }

  return result.data.keyPoints;
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

function parseJson(value: string): unknown {
  const cleanedValue = cleanAiTaskResultText(value);

  try {
    return JSON.parse(cleanedValue) as unknown;
  } catch (error) {
    throw new InvalidAiTaskResultError('AI response is not valid JSON', {
      cause: error,
    });
  }
}

function createJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
  delete jsonSchema.$schema;
  return jsonSchema;
}
