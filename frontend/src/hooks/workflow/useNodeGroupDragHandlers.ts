import { useWorkflowStore } from "@/stores";
import {
  getNodePositionInsideParent,
  sortNodes,
} from "@/utils/workflow/nodeGrouping";
import { Node, OnNodeDrag, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

/**
 * Hook to handle dragging nodes into and out of groups
 * Based on React Flow's parent-child relation example
 */
export function useNodeGroupDragHandlers() {
  const { getIntersectingNodes, getNodes, setNodes } = useReactFlow();
  const { saveToHistory, setDirty } = useWorkflowStore();

  /**
   * Handle when a node drag stops - attach to group if intersecting
   */
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => {
      // Only handle regular nodes (not groups) or nodes that already have a parent
      if (node.type === "group" && !node.parentId) {
        return;
      }

      // Find intersecting group nodes
      const intersections = getIntersectingNodes(node).filter(
        (n) => n.type === "group"
      );
      const groupNode = intersections[0];

      // When there is an intersection on drag stop, attach the node to its new parent
      if (intersections.length && node.parentId !== groupNode?.id) {
        // Take snapshot for undo/redo
        saveToHistory("Add node to group");

        const nextNodes: Node[] = getNodes()
          .map((n) => {
            // Clear the active highlight from the group
            if (n.id === groupNode.id) {
              return {
                ...n,
                className: n.className?.replace("active", "").trim(),
              };
            }
            // Update the dragged node with new parent
            else if (n.id === node.id) {
              const position = getNodePositionInsideParent(n, groupNode) ?? {
                x: 0,
                y: 0,
              };

              return {
                ...n,
                position,
                parentId: groupNode.id,
                extent: "parent" as const,
              } as Node;
            }

            return n;
          })
          .sort(sortNodes);

        setNodes(nextNodes);
        setDirty(true);
      }
    },
    [getIntersectingNodes, getNodes, setNodes, saveToHistory, setDirty]
  );

  /**
   * Handle while a node is being dragged - highlight intersecting groups
   */
  const onNodeDrag: OnNodeDrag = useCallback(
    (_, node, nodes) => {
      // Only handle regular nodes (not groups) or nodes that already have a parent
      if (node.type === "group" && !node.parentId) {
        return;
      }

      // Find intersecting group nodes
      const intersections = getIntersectingNodes(node).filter(
        (n) => n.type === "group"
      );

      // Determine if we should highlight a group (only if it's a different parent)
      const groupClassName =
        intersections.length && node.parentId !== intersections[0]?.id
          ? "active"
          : "";

      // Check if multiple nodes are selected
      const selectedNodes = nodes.filter((n) => n.selected);
      const isMultiNodeDrag = selectedNodes.length > 1;

      // Update group highlighting and positions
      setNodes((nds) => {
        return nds.map((n) => {
          if (n.type === "group") {
            return {
              ...n,
              className: groupClassName,
            };
          } 
          // Only update single node position when not multi-dragging
          // For multi-node drag, let React Flow handle all positions automatically
          else if (n.id === node.id && !isMultiNodeDrag) {
            return {
              ...n,
              position: node.position,
            };
          }

          return n;
        });
      });
    },
    [getIntersectingNodes, setNodes]
  );

  return {
    onNodeDragStop,
    onNodeDrag,
  };
}
