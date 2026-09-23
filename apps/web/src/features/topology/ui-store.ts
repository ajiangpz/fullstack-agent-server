'use client';

import { create } from 'zustand';
import type { DeviceStatus, DeviceType } from './types';

export type TopologySelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

interface TopologyUiState {
  search: string;
  statusFilter: 'all' | DeviceStatus;
  typeFilter: 'ALL' | DeviceType;
  selected: TopologySelection;
  collapsed: Record<string, true>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: 'all' | DeviceStatus) => void;
  setTypeFilter: (value: 'ALL' | DeviceType) => void;
  setSelected: (value: TopologySelection) => void;
  setCollapsed: (nodeId: string, value: boolean) => void;
  resetFilters: () => void;
  resetWorkspace: () => void;
}

export const useTopologyUiStore = create<TopologyUiState>((set) => ({
  search: '',
  statusFilter: 'all',
  typeFilter: 'ALL',
  selected: null,
  collapsed: {},
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setSelected: (selected) => set({ selected }),
  setCollapsed: (nodeId, value) =>
    set((state) => {
      const collapsed = { ...state.collapsed };
      if (value) collapsed[nodeId] = true;
      else delete collapsed[nodeId];
      return { collapsed };
    }),
  resetFilters: () => set({ statusFilter: 'all', typeFilter: 'ALL' }),
  resetWorkspace: () =>
    set({
      search: '',
      statusFilter: 'all',
      typeFilter: 'ALL',
      selected: null,
      collapsed: {},
    }),
}));
