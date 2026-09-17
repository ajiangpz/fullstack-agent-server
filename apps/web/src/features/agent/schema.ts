import { z } from 'zod';

export const agentPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Enter a question for the network agent.')
    .max(10_000, 'Prompt must be 10,000 characters or fewer.'),
});

export type AgentPromptInput = z.infer<typeof agentPromptSchema>;
