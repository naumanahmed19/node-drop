import { useCopyPasteStore, useWorkflowStore } from "@/stores";
import {
  Edge,
  Node,
  XYPosition,
  getConnectedEdges,
  useKeyPress,
  useReactFlow,
  useStore,
  type KeyCode,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Custom hook for copy/paste/cut functionality in React Flow
 * Based on React Flow Pro example with adaptations for our Zustand store
 *
 * Features:
 * - Copy: Ctrl/Cmd+C - Copy selected nodes and their connections
 * - Cut: Ctrl/Cmd+X - Copy and remove selected nodes
 * - Paste: Ctrl/Cmd+V - Paste at mouse position
 * - Supports pasting multiple times
 * - Maintains relative positions of nodes
 * - Preserves connections between pasted nodes
 */
export function useCopyPaste() {
  const mousePosRef = useRef<XYPosition>({ x: 0, y: 0 });
  const rfDomNode = useStore((state) => state.domNode);

  const { getNodes, setNodes, getEdges, setEdges, screenToFlowPosition } =
    useReactFlow();
  // OPTIMIZATION: Use Zustand selector to prevent unnecessary re-renders
  const saveToHistory = useWorkflowStore((state) => state.saveToHistory);
  const { setCopyPasteFunctions } = useCopyPasteStore();

  // Set up the paste buffers to store the copied nodes and edges
  const [bufferedNodes, setBufferedNodes] = useState<Node[]>([]);
  const [bufferedEdges, setBufferedEdges] = useState<Edge[]>([]);

  // Initialize the copy/paste hook
  // 1. Track mouse position for paste location
  // 2. Prevent default browser copy/paste within React Flow
  useEffect(() => {
    const events = ["cut", "copy", "paste"];

    if (rfDomNode) {
      const preventDefault = (e: Event) => e.preventDefault();

      const onMouseMove = (event: MouseEvent) => {
        mousePosRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
      };

      for (const event of events) {
        rfDomNode.addEventListener(event, preventDefault);
      }
      rfDomNode.addEventListener("mousemove", onMouseMove);

      return () => {
        for (const event of events) {
          rfDomNode.removeEventListener(event, preventDefault);
        }
        rfDomNode.removeEventListener("mousemove", onMouseMove);
      };
    }
  }, [rfDomNode]);

  /**
   * Copy selected nodes and their internal connections to buffer
   * Only copies edges where both source and target are selected
   * When copying a group, also includes all child nodes inside the group
   */
  const copy = useCallback(() => {
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
      console.log("📋 No nodes selected to copy");
      return;
    }

    // Include child nodes if a group is selected
    const selectedGroupIds = selectedNodes
      .filter((node) => node.type === "group")
      .map((node) => node.id);
    
    const childNodes = allNodes.filter(
      (node) => node.parentId && selectedGroupIds.includes(node.parentId)
    );

    // Combine selected nodes and their children
    const nodesToCopy = [...selectedNodes, ...childNodes];
    const nodeToCopyIds = nodesToCopy.map((n) => n.id);

    // Get all edges connected to nodes being copied
    // Filter to only include edges where BOTH source and target are in the copy set
    const selectedEdges = getConnectedEdges(nodesToCopy, getEdges()).filter(
      (edge) => {
        return (
          nodeToCopyIds.includes(edge.source) &&
          nodeToCopyIds.includes(edge.target)
        );
      }
    );

    setBufferedNodes(nodesToCopy);
    setBufferedEdges(selectedEdges);

    console.log(
      `📋 Copied ${nodesToCopy.length} nodes (${selectedNodes.length} selected + ${childNodes.length} children) and ${selectedEdges.length} edges`
    );
  }, [getNodes, getEdges]);

  /**
   * Copy selected nodes and remove them from the canvas
   * Same as copy + delete
   * When cutting a group, also includes all child nodes inside the group
   */
  const cut = useCallback(() => {
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
      console.log("✂️ No nodes selected to cut");
      return;
    }

    // Include child nodes if a group is selected
    const selectedGroupIds = selectedNodes
      .filter((node) => node.type === "group")
      .map((node) => node.id);
    
    const childNodes = allNodes.filter(
      (node) => node.parentId && selectedGroupIds.includes(node.parentId)
    );

    // Combine selected nodes and their children
    const nodesToCut = [...selectedNodes, ...childNodes];
    const nodeToCutIds = nodesToCut.map((n) => n.id);

    // Get internal edges (where both source and target are in the cut set)
    const selectedEdges = getConnectedEdges(nodesToCut, getEdges()).filter(
      (edge) => {
        return (
          nodeToCutIds.includes(edge.source) &&
          nodeToCutIds.includes(edge.target)
        );
      }
    );

    setBufferedNodes(nodesToCut);
    setBufferedEdges(selectedEdges);

    // Get node IDs for removal from workflow
    const selectedNodeIds = nodesToCut.map((node) => node.id);

    // Update Zustand workflow store - remove nodes and connections
    const { workflow, updateWorkflow } = useWorkflowStore.getState();
    if (workflow) {
      updateWorkflow({
        nodes: workflow.nodes.filter(
          (node) => !selectedNodeIds.includes(node.id)
        ),
        connections: workflow.connections.filter(
          (conn) =>
            !selectedNodeIds.includes(conn.sourceNodeId) &&
            !selectedNodeIds.includes(conn.targetNodeId)
        ),
      });
    }

    // Save to history
    saveToHistory(`Cut ${nodesToCut.length} node(s)`);

    // Remove the cut nodes (including children) and their edges from React Flow
    setNodes((nodes) => nodes.filter((node) => !selectedNodeIds.includes(node.id)));
    setEdges((edges) => edges.filter((edge) => !selectedEdges.includes(edge)));

    console.log(
      `✂️ Cut ${nodesToCut.length} nodes (${selectedNodes.length} selected + ${childNodes.length} children) and ${selectedEdges.length} edges`
    );
  }, [getNodes, setNodes, getEdges, setEdges, saveToHistory]);

  /**
   * Paste buffered nodes at the specified position (or mouse position)
   * Creates new IDs for pasted nodes and updates edge connections
   * Maintains relative positions of nodes
   */
  const paste = useCallback(
    (position?: XYPosition) => {
      if (bufferedNodes.length === 0) {
        console.log("📌 No nodes in buffer to paste");
        return;
      }

      // Use provided position or convert mouse position to flow coordinates
      const pastePosition =
        position ||
        screenToFlowPosition({
          x: mousePosRef.current.x,
          y: mousePosRef.current.y,
        });

      // Find the top-left corner of ONLY top-level nodes (not children)
      // Child nodes have relative positions and shouldn't be included in this calculation
      const topLevelNodes = bufferedNodes.filter((node) => !node.parentId);
      const minX = Math.min(...topLevelNodes.map((node) => node.position.x));
      const minY = Math.min(...topLevelNodes.map((node) => node.position.y));

      // Use timestamp to create unique IDs
      const now = Date.now();

      // Create new nodes with updated IDs and positions
      // Also update parentId references for child nodes
      const newNodes: Node[] = bufferedNodes.map((node) => {
        const id = `${node.id}-${now}`;
        
        // For child nodes, keep their relative position unchanged
        // For top-level nodes, calculate new absolute position
        let x, y;
        if (node.parentId) {
          // Child node - keep relative position as-is
          x = node.position.x;
          y = node.position.y;
        } else {
          // Top-level node - calculate new absolute position
          x = pastePosition.x + (node.position.x - minX);
          y = pastePosition.y + (node.position.y - minY);
        }

        // Update parentId if the node has one (child of a group)
        const newParentId = node.parentId ? `${node.parentId}-${now}` : undefined;

        return {
          ...node,
          id,
          position: { x, y },
          parentId: newParentId,
          selected: true, // Select the pasted nodes
        };
      });

      // Create new edges with updated IDs and node references
      const newEdges: Edge[] = bufferedEdges.map((edge) => {
        const id = `${edge.id}-${now}`;
        const source = `${edge.source}-${now}`;
        const target = `${edge.target}-${now}`;

        return {
          ...edge,
          id,
          source,
          target,
          selected: true, // Select the pasted edges
        };
      });

      // Save to history BEFORE making changes
      saveToHistory(`Paste ${newNodes.length} node(s)`);

      // Add new nodes and edges to React Flow first, deselecting existing ones
      setNodes((nodes) => [
        ...nodes.map((node) => ({ ...node, selected: false })),
        ...newNodes,
      ]);
      setEdges((edges) => [
        ...edges.map((edge) => ({ ...edge, selected: false })),
        ...newEdges,
      ]);

      // Then sync to Zustand workflow store from React Flow state
      // Use setTimeout to ensure React Flow state is updated first
      setTimeout(() => {
        const { workflow, updateWorkflow } = useWorkflowStore.getState();
        if (!workflow) return;

        // Get all current nodes from React Flow (including the newly pasted ones)
        const allCurrentNodes = getNodes();
        
        // Convert React Flow nodes to workflow nodes
        const workflowNodes = allCurrentNodes.map((node) => {
          // Check if this is a newly pasted node
          const isNewNode = newNodes.some(n => n.id === node.id);
          
          if (isNewNode) {
            // For new nodes, find the original to copy properties
            const originalId = node.id.replace(`-${now}`, "");
            const originalNode = workflow.nodes.find((n) => n.id === originalId);

            // Base workflow node
            const baseNode = {
              id: node.id,
              type: originalNode?.type || node.type || "default",
              name: (typeof originalNode?.name === 'string' ? originalNode.name : '') || 
                    (typeof node.data?.label === 'string' ? node.data.label : '') || 
                    node.id,
              position: node.position,
              parameters: originalNode?.parameters || {},
              disabled: originalNode?.disabled || false,
              credentials: originalNode?.credentials,
              locked: originalNode?.locked,
              mockData: originalNode?.mockData,
              mockDataPinned: originalNode?.mockDataPinned,
            };

            // Add parentId and extent for child nodes
            if (node.parentId) {
              return {
                ...baseNode,
                parentId: node.parentId,
                extent: node.extent as any,
              };
            }

            // Add style for group nodes
            if (node.type === "group") {
              return {
                ...baseNode,
                style: (node.style || originalNode?.style) as any,
              };
            }

            return baseNode;
          } else {
            // For existing nodes, keep them as-is from workflow
            const existingNode = workflow.nodes.find(n => n.id === node.id);
            return existingNode || {
              id: node.id,
              type: node.type || "default",
              name: node.id,
              position: node.position,
              parameters: {},
              disabled: false,
            };
          }
        });

        // Convert React Flow edges to workflow connections
        const allCurrentEdges = getEdges();
        const workflowConnections = allCurrentEdges.map((edge) => {
          // Check if this is a newly pasted edge
          const isNewEdge = newEdges.some(e => e.id === edge.id);
          
          if (isNewEdge) {
            return {
              id: edge.id,
              sourceNodeId: edge.source,
              sourceOutput: edge.sourceHandle || "main",
              targetNodeId: edge.target,
              targetInput: edge.targetHandle || "main",
            };
          } else {
            // Keep existing connection
            const existingConn = workflow.connections.find(c => c.id === edge.id);
            return existingConn || {
              id: edge.id,
              sourceNodeId: edge.source,
              sourceOutput: edge.sourceHandle || "main",
              targetNodeId: edge.target,
              targetInput: edge.targetHandle || "main",
            };
          }
        });

        // Update Zustand workflow store with all nodes and connections
        updateWorkflow({
          nodes: workflowNodes,
          connections: workflowConnections,
        });
      }, 0);

      console.log(
        `📌 Pasted ${newNodes.length} nodes and ${newEdges.length} edges`
      );
    },
    [
      bufferedNodes,
      bufferedEdges,
      screenToFlowPosition,
      setNodes,
      setEdges,
      saveToHistory,
    ]
  );

  // Set up keyboard shortcuts
  useShortcut(["Meta+x", "Control+x"], cut);
  useShortcut(["Meta+c", "Control+c"], copy, true);
  useShortcut(["Meta+v", "Control+v"], paste);

  // Calculate canCopy and canPaste
  const canCopy = getNodes().some((node) => node.selected);
  const canPaste = bufferedNodes.length > 0;

  // Update store with current functions and state
  useEffect(() => {
    setCopyPasteFunctions({
      copy,
      cut,
      paste,
      canCopy,
      canPaste,
    });
  }, [copy, cut, paste, canCopy, canPaste, setCopyPasteFunctions]);

  return {
    cut,
    copy,
    paste,
    bufferedNodes,
    bufferedEdges,
    canCopy,
    canPaste,
  };
}

/**
 * Custom hook to handle keyboard shortcuts
 * @param keyCode - Keyboard shortcut(s) to listen for
 * @param callback - Function to call when shortcut is pressed
 * @param isCopyAction - Special handling for copy to respect text selection
 */
function useShortcut(
  keyCode: KeyCode,
  callback: () => void,
  isCopyAction = false
): void {
  const [didRun, setDidRun] = useState(false);

  const shouldRun = useKeyPress(keyCode, {
    // Keep default browser behavior within input fields
    actInsideInputWithModifier: false,
  });

  useEffect(() => {
    // Check if there's any selected text on the page
    const selection = window.getSelection()?.toString();

    // For copy actions, only allow if there's no text selected
    // This preserves default browser copy behavior for text
    const allowCopy = isCopyAction ? !selection : true;

    if (shouldRun && !didRun && allowCopy) {
      callback();
      setDidRun(true);
    } else {
      setDidRun(shouldRun);
    }
  }, [shouldRun, didRun, callback, isCopyAction]);
}
