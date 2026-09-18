import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActiveConversationStore } from './conversation-store';

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
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

describe('useActiveConversationStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useActiveConversationStore.setState({
      activeConversationId: null,
      hasHydrated: false,
    });
  });

  it('sets and clears the active conversation id', () => {
    const localStorage = createStorage();
    vi.stubGlobal('window', { localStorage });

    useActiveConversationStore
      .getState()
      .setActiveConversationId('conv-1');

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBe('conv-1');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'network-agent-active-conversation',
      'conv-1',
    );

    useActiveConversationStore.getState().clearActiveConversation();

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      'network-agent-active-conversation',
    );
  });

  it('hydrates the active conversation from localStorage', () => {
    const localStorage = createStorage({
      'network-agent-active-conversation': 'conv-2',
    });
    vi.stubGlobal('window', { localStorage });

    useActiveConversationStore.getState().hydrate();

    expect(useActiveConversationStore.getState()).toMatchObject({
      activeConversationId: 'conv-2',
      hasHydrated: true,
    });
  });
});
