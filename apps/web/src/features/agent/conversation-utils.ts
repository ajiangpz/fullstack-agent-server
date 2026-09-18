import type {
  ConversationMessage,
  CreateAiTaskInput,
} from './types';

export function sortConversationMessages(
  messages: ConversationMessage[],
): ConversationMessage[] {
  return [...messages].sort((left, right) => left.sequence - right.sequence);
}

export function createAiTaskPayload(
  conversationId: string,
  prompt: string,
): CreateAiTaskInput {
  return { conversationId, prompt };
}
