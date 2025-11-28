import { useAddNodeDialogStore, useWorkflowStore } from '@/stores';
import { EdgeLabelRenderer } from '@xyflow/react';
import { Plus, Trash2 } from 'lucide-react';
import { CSSProperties, useCallback } from 'react';

interface EdgeButtonProps {
  x: number;
  y: number;
  id?: string;
  source?: string;
  target?: string;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function EdgeButton({
  x,
  y,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  style,
  onMouseEnter,
  onMouseLeave,
}: EdgeButtonProps) {
  const { openDialog } = useAddNodeDialogStore();
  // OPTIMIZATION: Use Zustand selectors to prevent unnecessary re-renders
  const workflow = useWorkflowStore(state => state.workflow);
  const removeConnection = useWorkflowStore(state => state.removeConnection);
  const readOnly = useWorkflowStore(state => state.readOnly);
  
  // Don't render buttons in read-only mode (only when viewing past execution)
  const isReadOnly = readOnly;

  /**
   * Handle clicking the + button on an edge (connection line)
   * Opens the add node dialog to insert a new node between two connected nodes
   * 
   * Position calculation:
   * - We don't pass screen coordinates (x, y) to openDialog()
   * - Instead, calculateInsertBetweenPosition() will automatically:
   *   1. Place the new node horizontally between source and target
   *   2. Align it on the Y-axis with the source node
   *   3. Shift downstream nodes to the right if needed to make space
   * - This ensures consistent horizontal layout and proper auto-layout behavior
   */
  const handleAddClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Pass undefined position - let auto-layout handle positioning
      if (source && target) {
        openDialog(
          undefined,
          {
            sourceNodeId: source,
            targetNodeId: target,
            sourceOutput: sourceHandleId || undefined,
            targetInput: targetHandleId || undefined,
          }
        );
      }
    },
    [openDialog, source, target, sourceHandleId, targetHandleId]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Find the connection to remove
      const connection = workflow?.connections.find(
        conn =>
          conn.sourceNodeId === source &&
          conn.targetNodeId === target &&
          (conn.sourceOutput === sourceHandleId || (!conn.sourceOutput && !sourceHandleId)) &&
          (conn.targetInput === targetHandleId || (!conn.targetInput && !targetHandleId))
      );

      if (connection) {
        removeConnection(connection.id);
      }
    },
    [workflow, removeConnection, source, target, sourceHandleId, targetHandleId]
  );

  // Don't render buttons in read-only mode
  if (isReadOnly) {
    return null;
  }

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-auto absolute z-50 flex items-center gap-0.5 rounded border bg-card px-0.5 py-0.5 shadow-sm"
        style={{
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          ...style,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          onClick={handleAddClick}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          title="Add node"
        >
          <Plus className="h-3 w-3" />
        </button>
        <div className="mx-0.5 h-3 w-px bg-border" />
        <button
          onClick={handleDeleteClick}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          title="Delete connection"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}
