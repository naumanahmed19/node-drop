import { create } from 'zustand'

interface PinnedOutputsStore {
  pinnedOutputs: Map<string, boolean>
  setPinned: (nodeId: string, pinned: boolean) => void
  isPinned: (nodeId: string) => boolean
  clearAll: () => void
}

export const usePinnedOutputsStore = create<PinnedOutputsStore>((set, get) => ({
  pinnedOutputs: new Map(),
  
  setPinned: (nodeId: string, pinned: boolean) => {
    set((state) => {
      const newMap = new Map(state.pinnedOutputs)
      if (pinned) {
        newMap.set(nodeId, true)
      } else {
        newMap.delete(nodeId)
      }
      return { pinnedOutputs: newMap }
    })
  },
  
  isPinned: (nodeId: string) => {
    return get().pinnedOutputs.get(nodeId) || false
  },
  
  clearAll: () => {
    set({ pinnedOutputs: new Map() })
  },
}))
