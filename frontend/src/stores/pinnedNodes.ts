import { userService } from "@/services/user";
import { createWithEqualityFn } from "zustand/traditional";

interface PinnedNodesState {
  pinnedNodeIds: string[];
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  pinNode: (nodeId: string) => Promise<void>;
  unpinNode: (nodeId: string) => Promise<void>;
  togglePin: (nodeId: string) => Promise<void>;
  isPinned: (nodeId: string) => boolean;
  reorderPinnedNodes: (nodeIds: string[]) => Promise<void>;
  setPinnedNodes: (nodeIds: string[]) => void; // Internal setter
}

export const usePinnedNodesStore = createWithEqualityFn<PinnedNodesState>()(
  (set, get) => ({
    pinnedNodeIds: [],
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      const { isInitialized, isLoading } = get();
      
      // Prevent multiple initializations
      if (isInitialized || isLoading) return;

      set({ isLoading: true });

      try {
        const pinnedNodes = await userService.getPinnedNodes();
        set({ 
          pinnedNodeIds: pinnedNodes, 
          isInitialized: true,
          isLoading: false 
        });
      } catch (error) {
        console.error("Failed to load pinned nodes:", error);
        // On error, keep empty array and mark as initialized to prevent retry loops
        set({ 
          pinnedNodeIds: [], 
          isInitialized: true,
          isLoading: false 
        });
      }
    },

    pinNode: async (nodeId: string) => {
      const { pinnedNodeIds } = get();
      if (pinnedNodeIds.includes(nodeId)) return;

      const newPinnedNodes = [...pinnedNodeIds, nodeId];
      
      // Optimistic update
      set({ pinnedNodeIds: newPinnedNodes });

      try {
        await userService.updatePinnedNodes(newPinnedNodes);
      } catch (error) {
        console.error("Failed to pin node:", error);
        // Revert on error
        set({ pinnedNodeIds });
      }
    },

    unpinNode: async (nodeId: string) => {
      const { pinnedNodeIds } = get();
      const newPinnedNodes = pinnedNodeIds.filter(id => id !== nodeId);
      
      // Optimistic update
      set({ pinnedNodeIds: newPinnedNodes });

      try {
        await userService.updatePinnedNodes(newPinnedNodes);
      } catch (error) {
        console.error("Failed to unpin node:", error);
        // Revert on error
        set({ pinnedNodeIds });
      }
    },

    togglePin: async (nodeId: string) => {
      const { isPinned, pinNode, unpinNode } = get();
      if (isPinned(nodeId)) {
        await unpinNode(nodeId);
      } else {
        await pinNode(nodeId);
      }
    },

    isPinned: (nodeId: string) => {
      const { pinnedNodeIds } = get();
      return pinnedNodeIds.includes(nodeId);
    },

    reorderPinnedNodes: async (nodeIds: string[]) => {
      const { pinnedNodeIds } = get();
      
      // Optimistic update
      set({ pinnedNodeIds: nodeIds });

      try {
        await userService.updatePinnedNodes(nodeIds);
      } catch (error) {
        console.error("Failed to reorder pinned nodes:", error);
        // Revert on error
        set({ pinnedNodeIds });
      }
    },

    setPinnedNodes: (nodeIds: string[]) => {
      set({ pinnedNodeIds: nodeIds });
    },
  })
);
