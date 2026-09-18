import type { AiTaskStreamEvent } from './ai-task-events';

export function serializeAiTaskSseEvent(event: AiTaskStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
