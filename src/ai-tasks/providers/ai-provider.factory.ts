import { DEFAULT_AGENT_INSTRUCTIONS } from '../ai-task.constants';
import type { AiProvider } from './ai-provider';
import { DeepSeekProvider } from './deepseek.provider';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiProvider } from './openai.provider';

type Environment = NodeJS.ProcessEnv;

export function createAiProvider(env: Environment = process.env): AiProvider {
  const provider = (env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

  switch (provider) {
    case 'mock':
      return new MockAiProvider(
        readInteger(env, 'MOCK_AI_DELAY_MS', 500, 0, 60_000),
      );
    case 'openai':
      return new OpenAiProvider({
        apiKey: readRequired(env, 'OPENAI_API_KEY', provider),
        model: readRequired(env, 'OPENAI_MODEL', provider),
        baseURL: readOptional(env, 'OPENAI_BASE_URL'),
        timeoutMs: readInteger(
          env,
          'OPENAI_TIMEOUT_MS',
          60_000,
          1_000,
          300_000,
        ),
        maxRetries: readInteger(env, 'OPENAI_MAX_RETRIES', 0, 0, 5),
        maxOutputTokens: readOptionalInteger(
          env,
          'OPENAI_MAX_OUTPUT_TOKENS',
          1,
          100_000,
        ),
        instructions: buildAgentInstructions(
          readOptional(env, 'OPENAI_INSTRUCTIONS'),
        ),
      });
    case 'deepseek':
      return new DeepSeekProvider({
        apiKey: readRequired(env, 'DEEPSEEK_API_KEY', provider),
        baseURL: readRequired(env, 'DEEPSEEK_BASE_URL', provider),
        model: readRequired(env, 'DEEPSEEK_MODEL', provider),
        timeoutMs: readInteger(
          env,
          'DEEPSEEK_TIMEOUT_MS',
          60_000,
          1_000,
          300_000,
        ),
        maxRetries: readInteger(env, 'DEEPSEEK_MAX_RETRIES', 0, 0, 5),
        maxOutputTokens: readOptionalInteger(
          env,
          'DEEPSEEK_MAX_OUTPUT_TOKENS',
          1,
          393_216,
        ),
        instructions: buildAgentInstructions(
          readOptional(env, 'DEEPSEEK_INSTRUCTIONS'),
        ),
      });
    default:
      throw new Error(
        `Unsupported AI_PROVIDER "${provider}". Expected "mock", "openai", or "deepseek".`,
      );
  }
}

function readRequired(
  env: Environment,
  name: string,
  provider: string,
): string {
  const value = readOptional(env, name);
  if (!value) {
    throw new Error(`${name} is required when AI_PROVIDER=${provider}`);
  }
  return value;
}

function readOptional(env: Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function readInteger(
  env: Environment,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = readOptionalInteger(env, name, min, max);
  return value ?? fallback;
}

function readOptionalInteger(
  env: Environment,
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = readOptional(env, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function buildAgentInstructions(custom?: string): string {
  return [DEFAULT_AGENT_INSTRUCTIONS, custom].filter(Boolean).join('\n');
}
