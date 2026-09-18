import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveConversationStore } from './conversation-store';

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('useActiveConversationStore', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createMemoryStorage(),
    });
    useActiveConversationStore.setState({
      activeConversationId: null,
      hasHydrated: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets and clears the active conversation id', () => {
    useActiveConversationStore
      .getState()
      .setActiveConversationId('conv-1');

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBe('conv-1');

    useActiveConversationStore.getState().clearActiveConversation();

    expect(
      useActiveConversationStore.getState().activeConversationId,
    ).toBeNull();
  });

  it('hydrates the active conversation id from local storage', () => {
    window.localStorage.setItem(
      'network-agent-active-conversation',
      'conv-2',
    );

    useActiveConversationStore.getState().hydrate();

    expect(useActiveConversationStore.getState()).toMatchObject({
      activeConversationId: 'conv-2',
      hasHydrated: true,
    });
  });
});
