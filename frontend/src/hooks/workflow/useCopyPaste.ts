import { useCopyPasteStore, useWorkflowStore } from "@/stores";
import { ensureUniqueNodeName } from "@/utils/nodeReferenceUtils";
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
  // Store workflow node data separately (has full properties like icon, color, etc.)
  const [bufferedWorkflowNodes, setBufferedWorkflowNodes] = useState<
    Map<string, any>
  >(new Map());

  // Initialize the copy/paste hook
  // 1. Track mouse position for paste location
  // 2. Prevent default browser copy/paste within React Flow (except for input fields)
  useEffect(() => {
    const events = ["cut", "copy", "paste"];

    if (rfDomNode) {
      const preventDefault = (e: Event) => {
        // Allow default behavior for input fields, textareas, and contenteditable elements
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
      };

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

    // Store workflow node data for full properties (icon, color, etc.)
    const { workflow } = useWorkflowStore.getState();
    const workflowNodeMap = new Map<string, any>();
    const workflowNodesToShare: any[] = [];
    const connectionsToShare: any[] = [];

    if (workflow) {
      nodeToCopyIds.forEach((nodeId) => {
        const workflowNode = workflow.nodes.find((n) => n.id === nodeId);
        if (workflowNode) {
          workflowNodeMap.set(nodeId, { ...workflowNode });
          workflowNodesToShare.push({ ...workflowNode });
        }
      });

      // Get connections for clipboard
      selectedEdges.forEach((edge) => {
        const conn = workflow.connections.find((c) => c.id === edge.id);
        if (conn) {
          connectionsToShare.push({ ...conn });
        }
      });
    }

    setBufferedNodes(nodesToCopy);
    setBufferedEdges(selectedEdges);
    setBufferedWorkflowNodes(workflowNodeMap);

    // Also write to system clipboard for cross-window paste
    const clipboardData = {
      nodes: workflowNodesToShare,
      connections: connectionsToShare,
      timestamp: Date.now(),
      version: "1.0",
    };
    try {
      navigator.clipboard.writeText(JSON.stringify(clipboardData));
    } catch (e) {
      console.warn("Failed to write to system clipboard:", e);
    }

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

    // Store workflow node data BEFORE removing (for full properties like icon, color, etc.)
    const { workflow, updateWorkflow } = useWorkflowStore.getState();
    const workflowNodeMap = new Map<string, any>();
    const workflowNodesToShare: any[] = [];
    const connectionsToShare: any[] = [];

    if (workflow) {
      nodeToCutIds.forEach((nodeId) => {
        const workflowNode = workflow.nodes.find((n) => n.id === nodeId);
        if (workflowNode) {
          workflowNodeMap.set(nodeId, { ...workflowNode });
          workflowNodesToShare.push({ ...workflowNode });
        }
      });

      // Get connections for clipboard
      selectedEdges.forEach((edge) => {
        const conn = workflow.connections.find((c) => c.id === edge.id);
        if (conn) {
          connectionsToShare.push({ ...conn });
        }
      });
    }

    setBufferedNodes(nodesToCut);
    setBufferedEdges(selectedEdges);
    setBufferedWorkflowNodes(workflowNodeMap);

    // Also write to system clipboard for cross-window paste
    const clipboardData = {
      nodes: workflowNodesToShare,
      connections: connectionsToShare,
      timestamp: Date.now(),
      version: "1.0",
    };
    try {
      navigator.clipboard.writeText(JSON.stringify(clipboardData));
    } catch (e) {
      console.warn("Failed to write to system clipboard:", e);
    }

    // Get node IDs for removal from workflow
    const selectedNodeIds = nodesToCut.map((node) => node.id);

    // Update Zustand workflow store - remove nodes and connections
    if (workflow) {
      // Skip history in updateWorkflow since we save it explicitly below
      updateWorkflow({
        nodes: workflow.nodes.filter(
          (node) => !selectedNodeIds.includes(node.id)
        ),
        connections: workflow.connections.filter(
          (conn) =>
            !selectedNodeIds.includes(conn.sourceNodeId) &&
            !selectedNodeIds.includes(conn.targetNodeId)
        ),
      }, true);
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
   * Paste nodes from clipboard data (for cross-window paste)
   */
  const pasteFromClipboard = useCallback(
    async (
      clipboardData: { nodes: any[]; connections: any[] },
      position?: XYPosition
    ) => {
      const { workflow, updateWorkflow } = useWorkflowStore.getState();
      if (!workflow) return;

      const topLevelNodes = clipboardData.nodes.filter((n) => !n.parentId);
      // If no top-level nodes, use all nodes for position calculation
      const nodesForPosition =
        topLevelNodes.length > 0 ? topLevelNodes : clipboardData.nodes;
      if (nodesForPosition.length === 0) return;

      const minX = Math.min(...nodesForPosition.map((n) => n.position.x));
      const minY = Math.min(...nodesForPosition.map((n) => n.position.y));

      // Calculate paste position
      let pastePosition = position;
      if (!pastePosition) {
        try {
          const converted = screenToFlowPosition({
            x: mousePosRef.current.x,
            y: mousePosRef.current.y,
          });
          if (
            converted &&
            typeof converted.x === "number" &&
            typeof converted.y === "number" &&
            !isNaN(converted.x) &&
            !isNaN(converted.y) &&
            isFinite(converted.x) &&
            isFinite(converted.y)
          ) {
            pastePosition = converted;
          }
        } catch {
          // ignore
        }
      }
      if (!pastePosition || pastePosition.x == null || pastePosition.y == null) {
        pastePosition = { x: minX + 50, y: minY + 50 };
      }

      const now = Date.now();
      const existingNames = new Set(workflow.nodes.map((n) => n.name));

      // Check which parent groups are being copied
      const copiedNodeIds = new Set(clipboardData.nodes.map((n) => n.id));

      // Create new nodes
      const newNodes = clipboardData.nodes.map((node) => {
        const id = `${node.id}-${now}`;
        const uniqueName = ensureUniqueNodeName(node.name, existingNames);
        existingNames.add(uniqueName);

        // Determine parentId: only keep if parent group is also being copied
        let newParentId: string | undefined;
        if (node.parentId && copiedNodeIds.has(node.parentId)) {
          // Parent group is also being copied, update the reference
          newParentId = `${node.parentId}-${now}`;
        }
        // If parent is NOT being copied, node becomes top-level (no parentId)

        let x, y;
        if (newParentId) {
          // Node's parent is also copied, keep relative position within group
          x = node.position.x;
          y = node.position.y;
        } else {
          // Top-level node - use paste position
          x = pastePosition!.x + (node.position.x - minX);
          y = pastePosition!.y + (node.position.y - minY);
        }

        return {
          ...node,
          id,
          name: uniqueName,
          position: { x, y },
          parentId: newParentId,
        };
      });

      // Create new connections
      const newConnections = (clipboardData.connections || []).map((conn) => ({
        ...conn,
        id: `${conn.id}-${now}`,
        sourceNodeId: `${conn.sourceNodeId}-${now}`,
        targetNodeId: `${conn.targetNodeId}-${now}`,
      }));

      saveToHistory(`Paste ${newNodes.length} node(s)`);

      updateWorkflow(
        {
          nodes: [...workflow.nodes, ...newNodes],
          connections: [...workflow.connections, ...newConnections],
        },
        true
      );

      console.log(
        `📌 Pasted ${newNodes.length} nodes from clipboard (cross-window)`
      );
    },
    [screenToFlowPosition, saveToHistory]
  );

  /**
   * Paste buffered nodes at the specified position (or mouse position)
   * Creates new IDs for pasted nodes and updates edge connections
   * Maintains relative positions of nodes
   */
  const paste = useCallback(
    async (position?: XYPosition) => {
      // If local buffer is empty, try to read from system clipboard (cross-window paste)
      if (bufferedNodes.length === 0) {
        try {
          const clipboardText = await navigator.clipboard.readText();
          const clipboardData = JSON.parse(clipboardText);
          if (
            clipboardData.nodes &&
            Array.isArray(clipboardData.nodes) &&
            clipboardData.nodes.length > 0
          ) {
            // Use cross-window paste logic
            await pasteFromClipboard(clipboardData, position);
            return;
          }
        } catch {
          // Not valid clipboard data, ignore
        }
        console.log("📌 No nodes in buffer to paste");
        return;
      }

      // Find the top-left corner of nodes for position calculation
      // If copying nodes from a group (no top-level nodes), use all nodes
      const topLevelNodes = bufferedNodes.filter((node) => !node.parentId);
      const nodesForPosition =
        topLevelNodes.length > 0 ? topLevelNodes : bufferedNodes;
      const minX = Math.min(...nodesForPosition.map((node) => node.position.x));
      const minY = Math.min(...nodesForPosition.map((node) => node.position.y));

      // Use provided position or convert mouse position to flow coordinates
      let pastePosition = position;
      if (!pastePosition) {
        try {
          const converted = screenToFlowPosition({
            x: mousePosRef.current.x,
            y: mousePosRef.current.y,
          });
          // Check if position is valid (not null/undefined/NaN and finite)
          if (
            converted &&
            typeof converted.x === "number" &&
            typeof converted.y === "number" &&
            !isNaN(converted.x) &&
            !isNaN(converted.y) &&
            isFinite(converted.x) &&
            isFinite(converted.y)
          ) {
            pastePosition = converted;
          }
        } catch {
          // screenToFlowPosition can throw if called outside canvas
        }
      }
      // Fallback: paste with offset from original position
      if (!pastePosition || pastePosition.x == null || pastePosition.y == null) {
        pastePosition = { x: minX + 50, y: minY + 50 };
      }

      // Use timestamp to create unique IDs
      const now = Date.now();

      // Check which parent groups are being copied
      const copiedNodeIds = new Set(bufferedNodes.map((n) => n.id));

      // Create new nodes with updated IDs and positions
      // Also update parentId references for child nodes
      const newNodes: Node[] = bufferedNodes.map((node) => {
        const id = `${node.id}-${now}`;

        // Determine parentId: only keep if parent group is also being copied
        let newParentId: string | undefined;
        if (node.parentId && copiedNodeIds.has(node.parentId)) {
          // Parent group is also being copied, update the reference
          newParentId = `${node.parentId}-${now}`;
        }
        // If parent is NOT being copied, node becomes top-level (no parentId)
        // This allows pasting nodes from groups to anywhere on canvas

        // Calculate position
        let x, y;
        if (newParentId) {
          // Node's parent is also copied, keep relative position within group
          x = node.position.x;
          y = node.position.y;
        } else {
          // Top-level node (or node removed from group) - use paste position
          x = pastePosition.x + (node.position.x - minX);
          y = pastePosition.y + (node.position.y - minY);
        }

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

        // Track existing names to ensure uniqueness for pasted nodes
        const existingNames = new Set(workflow.nodes.map((n) => n.name));
        
        // Convert React Flow nodes to workflow nodes
        const workflowNodes = allCurrentNodes.map((node) => {
          // Check if this is a newly pasted node
          const isNewNode = newNodes.some(n => n.id === node.id);
          
          if (isNewNode) {
            // For new nodes, find the original to copy properties
            const originalId = node.id.replace(`-${now}`, "");
            // First check buffered workflow nodes (for cut operations where node is removed)
            // Then fall back to current workflow nodes (for copy operations)
            const bufferedNode = bufferedWorkflowNodes.get(originalId);
            const originalNode =
              bufferedNode || workflow.nodes.find((n) => n.id === originalId);

            // Get position from newNodes array (has correct calculated position)
            const newNodeData = newNodes.find((n) => n.id === node.id);
            const nodePosition = newNodeData?.position || node.position;

            // Get the original name and ensure it's unique
            const originalName =
              (typeof originalNode?.name === "string" ? originalNode.name : "") ||
              (typeof node.data?.label === "string" ? node.data.label : "") ||
              node.id;
            const uniqueName = ensureUniqueNodeName(originalName, existingNames);
            existingNames.add(uniqueName); // Track for subsequent pasted nodes

            // Base workflow node - copy all properties from original
            const baseNode = {
              id: node.id,
              type: originalNode?.type || node.type || "default",
              name: uniqueName,
              position: nodePosition,
              parameters: originalNode?.parameters || {},
              disabled: originalNode?.disabled || false,
              credentials: originalNode?.credentials,
              locked: originalNode?.locked,
              mockData: originalNode?.mockData,
              mockDataPinned: originalNode?.mockDataPinned,
              settings: originalNode?.settings,
              icon: originalNode?.icon,
              color: originalNode?.color,
              description: originalNode?.description,
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
        // Skip history since we already saved before pasting
        updateWorkflow({
          nodes: workflowNodes,
          connections: workflowConnections,
        }, true);
      }, 0);

      console.log(
        `📌 Pasted ${newNodes.length} nodes and ${newEdges.length} edges`
      );
    },
    [
      bufferedNodes,
      bufferedEdges,
      bufferedWorkflowNodes,
      screenToFlowPosition,
      setNodes,
      setEdges,
      getNodes,
      getEdges,
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
