import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createConversation,
  getConversationMessages,
} from './conversation-api';

export function useCreateConversation() {
  return useMutation({ mutationFn: createConversation });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversationMessages(id as string),
    enabled: Boolean(id),
  });
}
