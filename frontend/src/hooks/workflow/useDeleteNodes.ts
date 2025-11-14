import { useWorkflowStore } from "@/stores";
import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

/**
 * Shared hook for deleting nodes
 * Handles both single node deletion and group deletion (with children)
 * 
 * Pattern:
 * 1. Use deleteElements API to remove nodes from React Flow
 * 2. Update Zustand from React Flow state
 */
export function useDeleteNodes() {
  const { getNodes, deleteElements } = useReactFlow();
  const { workflow, updateWorkflow, saveToHistory, setDirty } = useWorkflowStore();

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;

      const allNodes = getNodes();
      
      // Find all nodes to delete, including children of groups
      const nodesToDelete = allNodes.filter(n => nodeIds.includes(n.id));
      const groupIds = nodesToDelete.filter(n => n.type === 'group').map(n => n.id);
      
      // Find child nodes of any groups being deleted
      const childNodes = allNodes.filter(node => 
        node.parentId && groupIds.includes(node.parentId)
      );
      const childNodeIds = childNodes.map(n => n.id);
      
      // All node IDs to delete (selected + children)
      const allNodeIdsToDelete = [...nodeIds, ...childNodeIds];
      
      // Save to history
      saveToHistory(`Delete ${allNodeIdsToDelete.length} node(s)`);
      
      // Update React Flow - use deleteElements for proper deletion
      // This ensures React Flow handles parent-child relationships correctly
      deleteElements({ 
        nodes: allNodeIdsToDelete.map(id => ({ id }))
      });
      
      // Get the updated nodes after deletion
      const filteredNodes = getNodes();
      
      // Then update Zustand from React Flow state
      if (workflow) {
        const existingNodesMap = new Map(workflow.nodes.map((n) => [n.id, n]));
        const updatedNodes = filteredNodes
          .map((rfNode) => {
            const existingNode = existingNodesMap.get(rfNode.id);
            if (existingNode) {
              return {
                ...existingNode,
                position: rfNode.position,
                parentId: rfNode.parentId || undefined,
                extent: (rfNode.extent || undefined) as any,
              };
            }
            return undefined;
          })
          .filter((node): node is NonNullable<typeof node> => node !== undefined);

        // Skip history since we already saved before deletion
        updateWorkflow({ 
          nodes: updatedNodes,
          connections: workflow.connections.filter(
            conn =>
              !allNodeIdsToDelete.includes(conn.sourceNodeId) &&
              !allNodeIdsToDelete.includes(conn.targetNodeId)
          ),
        }, true);
      }
      
      setDirty(true);
    },
    [getNodes, deleteElements, workflow, updateWorkflow, saveToHistory, setDirty]
  );

  return deleteNodes;
}
