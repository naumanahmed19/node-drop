import { userService } from "@/services";
import { ReactFlowInstance, XYPosition } from "@xyflow/react";
import { persist } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface ReactFlowUIState {
  // ReactFlow instance
  reactFlowInstance: ReactFlowInstance | null;
  setReactFlowInstance: (instance: ReactFlowInstance | null) => void;

  // Connection line path for editable edges (free drawing)
  connectionLinePath: XYPosition[];
  setConnectionLinePath: (connectionLinePath: XYPosition[]) => void;

  // UI visibility settings
  showMinimap: boolean;
  showBackground: boolean;
  showControls: boolean;
  backgroundVariant: "dots" | "lines" | "cross";
  compactMode: boolean;

  // Canvas interaction settings
  panOnDrag: boolean;
  zoomOnScroll: boolean;
  editableConnections: boolean;

  // Canvas boundary settings
  canvasBoundaryX: number;
  canvasBoundaryY: number;
  setCanvasBoundaryX: (value: number) => void;
  setCanvasBoundaryY: (value: number) => void;

  // Execution panel state
  showExecutionPanel: boolean;
  executionPanelSize: number;

  // Code mode state
  showCodePanel: boolean;
  toggleCodePanel: () => void;
  setShowCodePanel: (show: boolean) => void;

  // Right sidebar state
  showRightSidebar: boolean;
  rightSidebarTab: 'settings' | 'copilot' | 'code';
  rightSidebarSize: number;
  toggleRightSidebar: () => void;
  setRightSidebarTab: (tab: 'settings' | 'copilot' | 'code') => void;
  setRightSidebarSize: (size: number) => void;
  openRightSidebar: (tab?: 'settings' | 'copilot' | 'code') => void;
  closeRightSidebar: () => void;

  // Toggle functions
  toggleMinimap: () => void;
  toggleBackground: () => void;
  toggleControls: () => void;
  togglePanOnDrag: () => void;
  toggleZoomOnScroll: () => void;
  toggleCompactMode: () => void;
  toggleEditableConnections: () => void;
  changeBackgroundVariant: (
    variant: "dots" | "lines" | "cross" | "none"
  ) => void;
  toggleExecutionPanel: () => void;

  // Setters
  setShowMinimap: (show: boolean) => void;
  setShowBackground: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setBackgroundVariant: (variant: "dots" | "lines" | "cross") => void;
  setCompactMode: (compact: boolean) => void;
  setPanOnDrag: (panOnDrag: boolean) => void;
  setZoomOnScroll: (zoomOnScroll: boolean) => void;
  setEditableConnections: (enabled: boolean) => void;
  setExecutionPanelSize: (size: number) => void;

  // Silent setters (don't trigger savePreferences)
  setPreferencesFromAPI: (preferences: any) => void;

  // ReactFlow controls
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  zoomToFit: () => void;

  // Preferences persistence
  loadPreferences: () => Promise<void>;
  savePreferences: () => void; // Debounced, so returns void not Promise
  isLoadingPreferences: boolean;
  isSavingPreferences: boolean;
}

export const useReactFlowUIStore = createWithEqualityFn<ReactFlowUIState>()(
  persist(
    (set, get) => ({
      // Initial state
      reactFlowInstance: null,
      showMinimap: true,
      showBackground: true,
      showControls: true,
      backgroundVariant: "dots",
      compactMode: false,
      panOnDrag: true,
      zoomOnScroll: true,
      editableConnections: true,
      canvasBoundaryX: 2000,
      canvasBoundaryY: 500,
      showExecutionPanel: false,
      executionPanelSize: 4,
      showCodePanel: false,
      isLoadingPreferences: false,
      isSavingPreferences: false,
      
      // Connection line path for editable edges
      connectionLinePath: [],
      
      // Right sidebar
      showRightSidebar: false,
      rightSidebarTab: 'settings',
      rightSidebarSize: 20,

      // Set ReactFlow instance
      setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),
      
      // Set connection line path
      setConnectionLinePath: (connectionLinePath) => set({ connectionLinePath }),

      // Toggle functions
      toggleMinimap: () => {
        set((state) => ({ showMinimap: !state.showMinimap }));
        get().savePreferences();
      },
      toggleBackground: () => {
        set((state) => ({ showBackground: !state.showBackground }));
        get().savePreferences();
      },
      toggleControls: () => {
        set((state) => ({ showControls: !state.showControls }));
        get().savePreferences();
      },
      togglePanOnDrag: () => {
        set((state) => ({ panOnDrag: !state.panOnDrag }));
        get().savePreferences();
      },
      toggleZoomOnScroll: () => {
        set((state) => ({ zoomOnScroll: !state.zoomOnScroll }));
        get().savePreferences();
      },
      toggleCompactMode: () => {
        set((state) => ({ compactMode: !state.compactMode }));
        get().savePreferences();
      },
      toggleEditableConnections: () => {
        set((state) => ({ editableConnections: !state.editableConnections }));
        get().savePreferences();
      },

      changeBackgroundVariant: (variant) => {
        if (variant === "none") {
          set({ showBackground: false });
        } else {
          set({ showBackground: true, backgroundVariant: variant });
        }
        get().savePreferences();
      },

      toggleExecutionPanel: () => {
        const { showExecutionPanel } = get();
        if (showExecutionPanel) {
          // If panel is expanded, minimize it
          set({ executionPanelSize: 4, showExecutionPanel: false });
        } else {
          // If panel is minimized, expand it to default size
          set({ executionPanelSize: 30, showExecutionPanel: true });
        }
      },

      toggleCodePanel: () => {
        set((state) => ({ showCodePanel: !state.showCodePanel }));
      },

      setShowCodePanel: (show) => {
        set({ showCodePanel: show });
      },

      // Right sidebar actions
      toggleRightSidebar: () => {
        set((state) => ({ showRightSidebar: !state.showRightSidebar }));
      },
      setRightSidebarTab: (tab) => {
        set({ rightSidebarTab: tab, showRightSidebar: true });
      },
      setRightSidebarSize: (size) => {
        set({ rightSidebarSize: size });
      },
      openRightSidebar: (tab) => {
        set({ showRightSidebar: true, ...(tab && { rightSidebarTab: tab }) });
      },
      closeRightSidebar: () => {
        set({ showRightSidebar: false });
      },

      // Setters
      setShowMinimap: (show) => {
        set({ showMinimap: show });
        get().savePreferences();
      },
      setShowBackground: (show) => {
        set({ showBackground: show });
        get().savePreferences();
      },
      setShowControls: (show) => {
        set({ showControls: show });
        get().savePreferences();
      },
      setBackgroundVariant: (variant) => {
        set({ backgroundVariant: variant });
        get().savePreferences();
      },
      setCompactMode: (compact) => {
        set({ compactMode: compact });
        get().savePreferences();
      },
      setPanOnDrag: (panOnDrag) => {
        set({ panOnDrag });
        get().savePreferences();
      },
      setZoomOnScroll: (zoomOnScroll) => {
        set({ zoomOnScroll });
        get().savePreferences();
      },
      setEditableConnections: (enabled) => {
        set({ editableConnections: enabled });
        get().savePreferences();
      },
      setExecutionPanelSize: (size) => set({ executionPanelSize: size }),
      setCanvasBoundaryX: (value) => {
        set({ canvasBoundaryX: value });
        get().savePreferences();
      },
      setCanvasBoundaryY: (value) => {
        set({ canvasBoundaryY: value });
        get().savePreferences();
      },

      // Silent setter for loading from API (doesn't trigger savePreferences)
      setPreferencesFromAPI: (preferences) => {
        if (preferences.canvas) {
          const updates: any = {};
          if (preferences.canvas.showMinimap !== undefined) {
            updates.showMinimap = preferences.canvas.showMinimap;
          }
          if (preferences.canvas.showBackground !== undefined) {
            updates.showBackground = preferences.canvas.showBackground;
          }
          if (preferences.canvas.showControls !== undefined) {
            updates.showControls = preferences.canvas.showControls;
          }
          if (preferences.canvas.backgroundVariant !== undefined) {
            updates.backgroundVariant = preferences.canvas.backgroundVariant;
          }
          if (preferences.canvas.compactMode !== undefined) {
            updates.compactMode = preferences.canvas.compactMode;
          }
          if (preferences.canvas.panOnDrag !== undefined) {
            updates.panOnDrag = preferences.canvas.panOnDrag;
          }
          if (preferences.canvas.zoomOnScroll !== undefined) {
            updates.zoomOnScroll = preferences.canvas.zoomOnScroll;
          }
          if (preferences.canvas.canvasBoundaryX !== undefined) {
            updates.canvasBoundaryX = preferences.canvas.canvasBoundaryX;
          }
          if (preferences.canvas.canvasBoundaryY !== undefined) {
            updates.canvasBoundaryY = preferences.canvas.canvasBoundaryY;
          }
          set(updates);
        }
      },

      // Preferences persistence
      loadPreferences: async () => {
        try {
          set({ isLoadingPreferences: true });
          const preferences = await userService.getPreferences();

          if (preferences.canvas) {
            set({
              showMinimap: preferences.canvas.showMinimap ?? get().showMinimap,
              showBackground:
                preferences.canvas.showBackground ?? get().showBackground,
              showControls:
                preferences.canvas.showControls ?? get().showControls,
              backgroundVariant:
                preferences.canvas.backgroundVariant ?? get().backgroundVariant,
              compactMode: preferences.canvas.compactMode ?? get().compactMode,
              panOnDrag: preferences.canvas.panOnDrag ?? get().panOnDrag,
              zoomOnScroll:
                preferences.canvas.zoomOnScroll ?? get().zoomOnScroll,
              canvasBoundaryX:
                preferences.canvas.canvasBoundaryX ?? get().canvasBoundaryX,
              canvasBoundaryY:
                preferences.canvas.canvasBoundaryY ?? get().canvasBoundaryY,
            });
          }
        } catch (error) {
          console.error("Failed to load preferences:", error);
        } finally {
          set({ isLoadingPreferences: false });
        }
      },

      savePreferences: debounce(async () => {
        try {
          set({ isSavingPreferences: true });
          const state = get();

          // Save to database (debounced)
          await userService.patchPreferences({
            canvas: {
              showMinimap: state.showMinimap,
              showBackground: state.showBackground,
              showControls: state.showControls,
              backgroundVariant: state.backgroundVariant,
              compactMode: state.compactMode,
              panOnDrag: state.panOnDrag,
              zoomOnScroll: state.zoomOnScroll,
              canvasBoundaryX: state.canvasBoundaryX,
              canvasBoundaryY: state.canvasBoundaryY,
            },
          });
          // Note: localStorage is automatically updated by persist middleware
        } catch (error) {
          console.error("Failed to save preferences:", error);
        } finally {
          set({ isSavingPreferences: false });
        }
      }, 1000),

      // ReactFlow controls
      zoomIn: () => {
        const { reactFlowInstance } = get();
        reactFlowInstance?.zoomIn();
      },

      zoomOut: () => {
        const { reactFlowInstance } = get();
        reactFlowInstance?.zoomOut();
      },

      fitView: () => {
        const { reactFlowInstance } = get();
        reactFlowInstance?.fitView();
      },

      zoomToFit: () => {
        const { reactFlowInstance } = get();
        reactFlowInstance?.fitView({ padding: 0.1 });
      },
    }),
    {
      name: "reactflow-ui-settings", // localStorage key
      partialize: (state) => ({
        showMinimap: state.showMinimap,
        showBackground: state.showBackground,
        showControls: state.showControls,
        backgroundVariant: state.backgroundVariant,
        compactMode: state.compactMode,
        panOnDrag: state.panOnDrag,
        zoomOnScroll: state.zoomOnScroll,
        editableConnections: state.editableConnections,
        canvasBoundaryX: state.canvasBoundaryX,
        canvasBoundaryY: state.canvasBoundaryY,
        executionPanelSize: state.executionPanelSize,
      }),
    }
  ),
  shallow
);
