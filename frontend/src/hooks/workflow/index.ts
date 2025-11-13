/**
 * Workflow Editor Custom Hooks
 *
 * This directory contains custom hooks for the WorkflowEditor component,
 * organized by functional responsibility to improve code maintainability
 * and separation of concerns.
 *
 * Hook Structure:
 *
 * 📋 useWorkflowOperations - Core workflow operations
 *    • Save workflow (create/update)
 *    • Import/export workflows
 *    • Workflow validation
 *    • File handling operations
 *
 * 🔗 useReactFlowInteractions - ReactFlow event handling
 *    • Node selection and positioning
 *    • Edge connection management
 *    • Drag and drop operations
 *    • Canvas zoom and view controls
 *
 * ⚡ useExecutionControls - Execution state management
 *    • Node and workflow execution
 *    • Real-time execution monitoring
 *    • Execution logs and results
 *    • WebSocket subscription management
 *
 * ⌨️ useKeyboardShortcuts - Keyboard interaction handling
 *    • Save, undo, redo shortcuts
 *    • Delete node operations
 *    • Centralized keyboard event management
 *
 * 📋 useCopyPaste - Copy/paste/cut functionality
 *    • Copy selected nodes (Ctrl/Cmd+C)
 *    • Cut selected nodes (Ctrl/Cmd+X)
 *    • Paste at mouse position (Ctrl/Cmd+V)
 *    • Maintains relative positions and connections
 *
 * 🎨 useWorkflowEditorUI - UI state management
 *    • Panel visibility and sizing
 *    • ReactFlow view settings (minimap, background, controls)
 *    • Local UI state that doesn't belong in global stores
 *
 */

export { useAutoLayout } from "./useAutoLayout";
export { useCopyPaste } from "./useCopyPaste";
export { useDeleteNodes } from "./useDeleteNodes";
export { default as useDetachNodes } from "./useDetachNodes";
export {
  useEdgeAnimation,
  useExecutionAwareEdges,
  useHasAnimatedEdges,
  useActiveEdges,
  useCompletedEdges,
} from "./useEdgeAnimation";
export { useExecutionControls } from "./useExecutionControls";
export { useExecutionPanelData } from "./useExecutionPanelData";
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export { useNodeGroupDragHandlers } from "./useNodeGroupDragHandlers";
export { useNodeValidation } from "./useNodeValidation";
export { useReactFlowInteractions } from "./useReactFlowInteractions";
export { useWorkflowEditorUI } from "./useWorkflowEditorUI";
export { useWorkflowOperations } from "./useWorkflowOperations";
