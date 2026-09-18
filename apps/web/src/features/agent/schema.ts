import { z } from 'zod';

export const agentPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'validation.agent.required')
    .max(10_000, 'validation.agent.max'),
});

export type AgentPromptInput = z.infer<typeof agentPromptSchema>;
