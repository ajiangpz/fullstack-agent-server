import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createConversation,
  getConversationMessages,
} from './conversation-api';

export function useCreateConversation() {
  return useMutation({ mutationFn: createConversation });
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversationMessages(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 0,
  });
}
