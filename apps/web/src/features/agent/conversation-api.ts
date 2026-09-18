import { apiRequest } from '@/lib/api-client';
import type {
  ConversationMessagesResult,
  CreateConversationResponse,
} from './types';

export function createConversation() {
  return apiRequest<CreateConversationResponse>('/conversations', {
    method: 'POST',
  });
}

export function getConversationMessages(id: string) {
  return apiRequest<ConversationMessagesResult>(
    `/conversations/${encodeURIComponent(id)}/messages`,
  );
}
