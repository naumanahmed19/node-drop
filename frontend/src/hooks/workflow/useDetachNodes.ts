import { useWorkflowStore } from "@/stores";
import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

function useDetachNodes() {
  const { setNodes, getNodes, getInternalNode } = useReactFlow();
  const { saveToHistory, setDirty, workflow, updateWorkflow } = useWorkflowStore();

  const detachNodes = useCallback(
    (ids: string[], removeParentId?: string) => {
      // Take snapshot for undo/redo
      saveToHistory("Ungroup nodes");

      const nextNodes = getNodes().map((n) => {
        if (ids.includes(n.id) && n.parentId) {
          const parentNode = getInternalNode(n.parentId);

          return {
            ...n,
            position: {
              x: n.position.x + (parentNode?.internals.positionAbsolute.x ?? 0),
              y: n.position.y + (parentNode?.internals.positionAbsolute.y ?? 0),
            },
            expandParent: undefined,
            parentId: undefined,
            extent: undefined,
          };
        }
        return n;
      });

      const filteredNodes = nextNodes.filter((n) => !removeParentId || n.id !== removeParentId);
      
      setNodes(filteredNodes);

      // Sync changes to Zustand workflow store
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

        // Skip history since we already saved before detaching
        updateWorkflow({ nodes: updatedNodes }, true);
      }

      // Mark workflow as dirty
      setDirty(true);
    },
    [setNodes, getNodes, getInternalNode, saveToHistory, setDirty, workflow, updateWorkflow]
  );

  return detachNodes;
}

export default useDetachNodes;
