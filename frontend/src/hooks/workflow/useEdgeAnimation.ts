/**
 * useEdgeAnimation Hook
 *
 * Determines which edges should be animated based on execution state.
 * Enhanced to show the actual execution path including branch decisions (IfElse nodes).
 *
 * Features:
 * - Animates edges that are actively being used in the current execution
 * - Shows which branch of IfElse nodes is being followed
 * - Different animation for active edges vs completed edges
 * - Prevents animation of unrelated edges in complex workflows
 */

import { useWorkflowStore } from "@/stores/workflow";
import type { Edge } from "@xyflow/react";
import { useMemo } from "react";

/**
 * Hook to get edge animation states based on execution state
 *
 * @param edges - All edges in the workflow
 * @returns Map of edge IDs to animation state (true/false)
 */
export function useEdgeAnimation(edges: Edge[]): Map<string, boolean> {
  // Use the same executionState.status that controls buttons and node loading
  const isExecuting = useWorkflowStore(
    (state) => state.executionState.status === "running"
  );

  // Get the nodes in the current execution path
  const executionNodeIds = useWorkflowStore((state) => {
    // Check executionManager for affected nodes (most reliable)
    if (state.executionManager) {
      const currentExecution = state.executionManager.getCurrentExecution();
      if (currentExecution?.affectedNodeIds) {
        return currentExecution.affectedNodeIds;
      }
    }

    // Fallback: check flowExecutionState for execution path
    const currentExecutionId = state.executionState.executionId;
    if (currentExecutionId) {
      const flowStatus =
        state.flowExecutionState.activeExecutions.get(currentExecutionId);
      if (flowStatus?.executionPath) {
        return new Set(flowStatus.executionPath);
      }
    }

    // No execution path found
    return new Set<string>();
  });

  // Calculate which edges should be animated
  const edgeAnimationMap = useMemo(() => {
    const animationMap = new Map<string, boolean>();

    // If not executing, no edges should animate
    if (!isExecuting) {
      edges.forEach((edge) => animationMap.set(edge.id, false));
      return animationMap;
    }

    // If executing but no execution path, don't animate any edges
    if (executionNodeIds.size === 0) {
      edges.forEach((edge) => animationMap.set(edge.id, false));
      return animationMap;
    }

    // Only animate edges where BOTH source AND target are in execution path
    edges.forEach((edge) => {
      const isInExecutionPath =
        executionNodeIds.has(edge.source) && executionNodeIds.has(edge.target);
      animationMap.set(edge.id, isInExecutionPath);
    });

    return animationMap;
  }, [edges, isExecuting, executionNodeIds]);

  return edgeAnimationMap;
}

/**
 * Hook to check if ANY edge should be animated (for global controls)
 *
 * @returns boolean - true if any edge should be animated
 */
export function useHasAnimatedEdges(): boolean {
  return useWorkflowStore((state) => state.executionState.status === "running");
}

/**
 * Hook to get active edges (edges currently being traversed)
 */
export function useActiveEdges(): Set<string> {
  return useWorkflowStore((state) => {
    const currentExecutionId = state.executionState.executionId;
    if (!currentExecutionId) return new Set();

    const flowStatus =
      state.flowExecutionState.activeExecutions.get(currentExecutionId);
    if (!flowStatus) return new Set();

    // Get active edges from the flow status
    return flowStatus.activeEdges || new Set();
  });
}

/**
 * Hook to get completed edges (edges that have been traversed)
 */
export function useCompletedEdges(): Set<string> {
  return useWorkflowStore((state) => {
    const currentExecutionId = state.executionState.executionId;
    if (!currentExecutionId) return new Set();

    const flowStatus =
      state.flowExecutionState.activeExecutions.get(currentExecutionId);
    if (!flowStatus) return new Set();

    // Get completed edges from the flow status
    return flowStatus.completedEdges || new Set();
  });
}

/**
 * Hook to enhance edges with execution-aware animation and styling
 *
 * @param edges - Original edges
 * @returns Edges with animated property and style based on execution context
 */
export function useExecutionAwareEdges(edges: Edge[]): Edge[] {
  const edgeAnimationMap = useEdgeAnimation(edges);
  const activeEdges = useActiveEdges();
  const completedEdges = useCompletedEdges();
  const isExecuting = useWorkflowStore(
    (state) => state.executionState.status === "running"
  );

  return useMemo(() => {
    return edges.map((edge) => {
      const isActive = activeEdges.has(edge.id);
      const isCompleted = completedEdges.has(edge.id);
      const shouldAnimate = edgeAnimationMap.get(edge.id) || false;

      // Enhanced styling based on execution state
      let style = { ...edge.style };
      let animated = false;

      if (isExecuting) {
        if (isActive) {
          // Active edge - currently being traversed
          style = {
            ...style,
            stroke: "#10b981", // Green for active
            strokeWidth: 3,
          };
          animated = true; // Animate active edges
        } else if (isCompleted) {
          // Completed edge - already traversed
          style = {
            ...style,
            stroke: "#6366f1", // Indigo for completed
            strokeWidth: 2,
            opacity: 0.8,
          };
          animated = false; // Don't animate completed edges
        } else if (shouldAnimate) {
          // In execution path but not yet traversed
          style = {
            ...style,
            stroke: "#94a3b8", // Gray for pending
            strokeWidth: 1.5,
            opacity: 0.5,
          };
          animated = false;
        }
      } else {
        // Not executing - show completed edges if any
        if (isCompleted) {
          style = {
            ...style,
            stroke: "#6366f1", // Indigo for completed
            strokeWidth: 2,
            opacity: 0.6,
          };
          animated = false;
        } else {
          // Use default animation based on execution path
          animated = shouldAnimate;
        }
      }

      return {
        ...edge,
        ...(animated && { animated: true }),
        style,
      };
    });
  }, [edges, edgeAnimationMap, activeEdges, completedEdges, isExecuting]);
}
