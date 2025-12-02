import { useAddNodeDialogStore, useWorkflowStore } from '@/stores';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { Plus, Trash2, GitBranch, Spline } from 'lucide-react';
import { CSSProperties, useCallback, useState } from 'react';
import { Algorithm } from '../EditableEdge/constants';

interface EdgeButtonProps {
  x: number;
  y: number;
  id?: string;
  source?: string;
  target?: string;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  algorithm?: string;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function EdgeButton({
  x,
  y,
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  algorithm = Algorithm.Step,
  style,
  onMouseEnter,
  onMouseLeave,
}: EdgeButtonProps) {
  const { openDialog } = useAddNodeDialogStore();
  const { setEdges } = useReactFlow();
  // OPTIMIZATION: Use Zustand selectors to prevent unnecessary re-renders
  const workflow = useWorkflowStore(state => state.workflow);
  const removeConnection = useWorkflowStore(state => state.removeConnection);
  const updateConnection = useWorkflowStore(state => state.updateConnection);
  const readOnly = useWorkflowStore(state => state.readOnly);
  
  const [showEdgeTypes, setShowEdgeTypes] = useState(false);
  
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

  const handleEdgeTypeChange = useCallback(
    (newAlgorithm: Algorithm) => {
      if (!id) return;
      
      // Update React Flow edge
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              data: {
                ...edge.data,
                algorithm: newAlgorithm,
                points: [], // Reset control points when changing algorithm
              },
            };
          }
          return edge;
        })
      );
      
      // Update workflow store
      updateConnection(id, { 
        algorithm: newAlgorithm,
        controlPoints: [], // Reset control points
      } as any);
      
      setShowEdgeTypes(false);
    },
    [id, setEdges, updateConnection]
  );

  // Don't render buttons in read-only mode
  if (isReadOnly) {
    return null;
  }
  
  // Only show Step and Bezier options
  const edgeTypeIcons: Partial<Record<Algorithm, { icon: typeof GitBranch; label: string }>> = {
    [Algorithm.Step]: { icon: GitBranch, label: 'Step' },
    [Algorithm.BezierCatmullRom]: { icon: Spline, label: 'Bezier' },
  };
  
  const currentType = edgeTypeIcons[algorithm as Algorithm] || edgeTypeIcons[Algorithm.Step]!;

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-auto absolute z-50 flex items-center rounded border bg-card shadow-sm"
        style={{
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          padding: '1px',
          gap: '1px',
          ...style,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          onClick={handleAddClick}
          className="flex h-3 w-3 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title="Add node"
        >
          <Plus className="h-2 w-2" />
        </button>
        <div className="h-2 w-px bg-border" />
        
        {/* Edge type selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEdgeTypes(!showEdgeTypes);
            }}
            className="flex h-3 w-3 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={`Edge type: ${currentType.label}`}
          >
            <currentType.icon className="h-2 w-2" />
          </button>
          
          {showEdgeTypes && (
            <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 flex flex-col rounded border bg-card p-0.5 shadow-md z-[100]" style={{ gap: '1px' }}>
              {Object.entries(edgeTypeIcons).map(([alg, { icon: Icon, label }]) => (
                <button
                  key={alg}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdgeTypeChange(alg as Algorithm);
                  }}
                  className={`flex items-center gap-1 px-1 py-px text-[9px] rounded-sm transition-colors whitespace-nowrap ${
                    algorithm === alg
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  title={label}
                >
                  <Icon className="h-2 w-2" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="h-2 w-px bg-border" />
        <button
          onClick={handleDeleteClick}
          className="flex h-3 w-3 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          title="Delete connection"
        >
          <Trash2 className="h-2 w-2" />
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}
