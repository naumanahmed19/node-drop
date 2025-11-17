import { useDetachNodes, useDeleteNodes } from "@/hooks/workflow";
import { useAddNodeDialogStore } from "@/stores/addNodeDialog";
import { useWorkflowStore } from "@/stores/workflow";
import { WorkflowNode } from "@/types";
import { useReactFlow } from "@xyflow/react";

export function useNodeActions(nodeId: string) {
  const executeNode = useWorkflowStore((state) => state.executeNode);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const addNode = useWorkflowStore((state) => state.addNode);
  const toggleNodeLock = useWorkflowStore((state) => state.toggleNodeLock);
  const openNodeProperties = useWorkflowStore(
    (state) => state.openNodeProperties
  );
  const workflow = useWorkflowStore((state) => state.workflow);
  const updateWorkflow = useWorkflowStore((state) => state.updateWorkflow);
  const saveToHistory = useWorkflowStore((state) => state.saveToHistory);
  const setDirty = useWorkflowStore((state) => state.setDirty);

  const { openDialog } = useAddNodeDialogStore();
  const detachNodes = useDetachNodes();
  const deleteNodes = useDeleteNodes();
  const { getNodes, setNodes, getNodesBounds } = useReactFlow();

  const handleToggleDisabled = (nodeId: string, disabled: boolean) => {
    updateNode(nodeId, { disabled });
  };

  const handleOpenProperties = () => {
    // Open regular properties panel for all nodes (including chat)
    openNodeProperties(nodeId);
  };

  const handleExecuteFromContext = () => {
    executeNode(nodeId, undefined, "single");
  };

  const handleDuplicate = () => {
    const nodeToClone = workflow?.nodes.find((n) => n.id === nodeId);
    if (nodeToClone) {
      const clonedNode = {
        ...nodeToClone,
        id: `node-${Date.now()}`,
        name: `${nodeToClone.name} (Copy)`,
        position: {
          x: nodeToClone.position.x + 50,
          y: nodeToClone.position.y + 50,
        },
      };
      addNode(clonedNode);
    }
  };

  const handleDelete = () => {
    // Use shared delete handler for consistency
    deleteNodes([nodeId]);
  };

  const handleToggleLock = () => {
    toggleNodeLock(nodeId);
  };

  const handleToggleCompact = () => {
    const node = workflow?.nodes.find((n) => n.id === nodeId);
    if (node) {
      const currentCompact = node.settings?.compact || false;
      updateNode(nodeId, {
        settings: {
          ...node.settings,
          compact: !currentCompact,
        },
      });
    }
  };

  const handleUngroup = () => {
    detachNodes([nodeId], undefined);
  };

  const handleGroup = () => {
    // Get all selected nodes that are not groups and not in groups
    // Use fresh nodes from React Flow to ensure we have current positions
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter(
      (node) => node.selected && !node.parentId && node.type !== "group"
    );

    // Need at least 1 node to create a group
    if (selectedNodes.length < 1) {
      return;
    }

    // Take snapshot for undo/redo
    saveToHistory("Group nodes");

    const groupId = `group_${Math.random() * 10000}`;
    
    // Calculate bounds using fresh positions from getNodes()
    const selectedNodesRectangle = getNodesBounds(selectedNodes);
    const GROUP_PADDING = 25;
    const groupNodePosition = {
      x: selectedNodesRectangle.x,
      y: selectedNodesRectangle.y,
    };

    // Create the group node
    const groupNode = {
      id: groupId,
      type: "group",
      position: groupNodePosition,
      style: {
        width: selectedNodesRectangle.width + GROUP_PADDING * 2,
        height: selectedNodesRectangle.height + GROUP_PADDING * 2,
      },
      data: {},
    };

    const selectedNodeIds = selectedNodes.map((n) => n.id);

    const nextNodes = allNodes.map((node) => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          // Calculate relative position of the node inside the group
          position: {
            x: node.position.x - groupNodePosition.x + GROUP_PADDING,
            y: node.position.y - groupNodePosition.y + GROUP_PADDING,
          },
          extent: "parent" as const,
          parentId: groupId,
          expandParent: true,
          selected: false, // Deselect after grouping
        };
      }
      return node;
    });

    // Update React Flow nodes
    setNodes([groupNode, ...nextNodes]);

    // Sync to Zustand workflow store
    if (workflow) {
      const allNodesUpdated = [groupNode, ...nextNodes];
      const existingNodesMap = new Map(workflow.nodes.map((n) => [n.id, n]));

      const updatedWorkflowNodes: WorkflowNode[] = [];

      allNodesUpdated.forEach((rfNode) => {
        const existingNode = existingNodesMap.get(rfNode.id);

        if (rfNode.type === "group") {
          // Add the new group node
          updatedWorkflowNodes.push({
            id: rfNode.id,
            type: "group",
            name: "",
            description: undefined,
            parameters: rfNode.data || {},
            position: rfNode.position,
            disabled: false,
            style: rfNode.style as any,
          });
        } else if (existingNode) {
          // Update existing node with parent relationship
          const anyRfNode = rfNode as any;
          updatedWorkflowNodes.push({
            ...existingNode,
            position: rfNode.position,
            parentId: anyRfNode.parentId || undefined,
            extent: (anyRfNode.extent || undefined) as any,
          });
        }
      });

      // Skip history since we already saved before grouping
      updateWorkflow({ nodes: updatedWorkflowNodes }, true);
      setDirty(true);
    }
  };

  const handleOutputClick = (
    event: React.MouseEvent<HTMLDivElement>,
    outputHandle: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    };

    openDialog(position, {
      sourceNodeId: nodeId,
      targetNodeId: "",
      sourceOutput: outputHandle,
      targetInput: "main",
    });
  };

  return {
    handleToggleDisabled,
    handleOpenProperties,
    handleExecuteFromContext,
    handleDuplicate,
    handleDelete,
    handleToggleLock,
    handleToggleCompact,
    handleUngroup,
    handleGroup,
    handleOutputClick,
  };
}
