import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_CONVERSATION_STORAGE_KEY,
  useActiveConversationStore,
} from './conversation-store';

function createStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  useActiveConversationStore.setState({
    activeConversationId: null,
    hasHydrated: false,
  });
});

describe('useActiveConversationStore', () => {
  it('sets and clears the active conversation id', () => {
    const storage = createStorage();
    vi.stubGlobal('window', { localStorage: storage });

    useActiveConversationStore
      .getState()
      .setActiveConversationId('conv-1');

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBe('conv-1');
    expect(storage.setItem).toHaveBeenCalledWith(
      ACTIVE_CONVERSATION_STORAGE_KEY,
      'conv-1',
    );

    useActiveConversationStore.getState().clearActiveConversation();

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(
      ACTIVE_CONVERSATION_STORAGE_KEY,
    );
  });

  it('hydrates the active conversation id from localStorage', () => {
    const storage = createStorage({
      [ACTIVE_CONVERSATION_STORAGE_KEY]: 'conv-restored',
    });
    vi.stubGlobal('window', { localStorage: storage });

    useActiveConversationStore.getState().hydrate();

    expect(useActiveConversationStore.getState()).toEqual(
      expect.objectContaining({
        activeConversationId: 'conv-restored',
        hasHydrated: true,
      }),
    );
  });
});
