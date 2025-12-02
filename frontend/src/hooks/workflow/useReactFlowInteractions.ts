import { useAddNodeDialogStore, useReactFlowUIStore, useWorkflowStore } from "@/stores";
import { NodeType, WorkflowConnection, WorkflowNode } from "@/types";
import {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  OnSelectionChangeParams,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import { useNodeGroupDragHandlers } from "./useNodeGroupDragHandlers";
import { useDeleteNodes } from "./useDeleteNodes";
import { useTemplateExpansion } from "./useTemplateExpansion";

/**
 * Custom hook for ReactFlow interactions
 * Handles node/edge changes, connections, drag/drop, and selection
 */
export function useReactFlowInteractions() {
  // OPTIMIZATION: Use Zustand selectors to prevent unnecessary re-renders
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const addNode = useWorkflowStore((state) => state.addNode);
  const addConnection = useWorkflowStore((state) => state.addConnection);
  const removeConnection = useWorkflowStore((state) => state.removeConnection);
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode);
  const showPropertyPanel = useWorkflowStore(
    (state) => state.showPropertyPanel
  );
  const propertyPanelNodeId = useWorkflowStore(
    (state) => state.propertyPanelNodeId
  );
  const openNodeProperties = useWorkflowStore(
    (state) => state.openNodeProperties
  );
  const closeNodeProperties = useWorkflowStore(
    (state) => state.closeNodeProperties
  );

  const { openDialog } = useAddNodeDialogStore();
  const { isTemplateNode, handleTemplateExpansion } = useTemplateExpansion();

  const [connectionInProgress, setConnectionInProgress] =
    useState<Connection | null>(null);

  // Add ref to track connection state as fallback when state gets reset
  const connectionRef = useRef<Connection | null>(null);

  // Track if a connection was successfully made
  const connectionMadeRef = useRef<boolean>(false);

  // Use the useReactFlow hook to get the ReactFlow instance directly
  const reactFlowInstance = useReactFlow();

  // Get group drag handlers for adding nodes to groups
  const { onNodeDrag: onNodeDragGroup, onNodeDragStop: onNodeDragStopGroup, groupAttachmentHandled } =
    useNodeGroupDragHandlers();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Check if a node exists in the workflow
  const checkNodeExists = useCallback((nodeId: string) => {
    const workflow = useWorkflowStore.getState().workflow;
    return workflow?.nodes.some((node) => node.id === nodeId) ?? false;
  }, []);

  // Handle node selection
  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const selectedNode = params.nodes[0];
      if (selectedNode) {
        setSelectedNode(selectedNode.id);
      } else {
        setSelectedNode(null);
        // Close property panel if the node no longer exists in workflow
        if (showPropertyPanel && propertyPanelNodeId) {
          const nodeExists = checkNodeExists(propertyPanelNodeId);
          if (!nodeExists) {
            closeNodeProperties();
          }
        }
      }
    },
    [
      setSelectedNode,
      showPropertyPanel,
      propertyPanelNodeId,
      checkNodeExists,
      closeNodeProperties,
    ]
  );

  // Drag operation state tracking
  const dragSnapshotTaken = useRef(false);
  const isDragging = useRef(false);
  const blockSync = useRef(false);
  const resizeSnapshotTaken = useRef(false);
  const isResizing = useRef(false);
  
  // Get shared delete handler
  const deleteNodes = useDeleteNodes();

  // Handle node position changes
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Apply changes to React Flow first
      onNodesChange(changes);

      // Track dragging state and handle dimension changes
      let isResizeComplete = false;
      let isResizeStart = false;

      changes.forEach((change) => {
        if (change.type === "position" && "dragging" in change) {
          if (change.dragging) {
            isDragging.current = true;
          }
        }

        // Detect dimension changes (from resizing)
        if (change.type === "dimensions") {
          // Check if resize is starting
          if ("resizing" in change && change.resizing === true) {
            isResizeStart = true;
            isResizing.current = true;
            blockSync.current = true; // Block sync during resize
          }
          // Check if resize is complete (resizing becomes false or undefined)
          if ("resizing" in change && change.resizing === false) {
            isResizeComplete = true;
          }
        }
      });

      // Set flag at resize start but don't save history yet
      if (isResizeStart && !resizeSnapshotTaken.current) {
        resizeSnapshotTaken.current = true;
      }

      // Only sync to Zustand when resize is COMPLETE, not during continuous resizing
      if (isResizeComplete && reactFlowInstance) {
        // Use a short delay to ensure React Flow state is updated
        setTimeout(() => {
          const { workflow, updateWorkflow, setDirty } =
            useWorkflowStore.getState();
          if (workflow) {
            const currentNodes = reactFlowInstance.getNodes();
            const existingNodesMap = new Map(
              workflow.nodes.map((n) => [n.id, n])
            );
            const updatedNodes: WorkflowNode[] = [];

            currentNodes.forEach((rfNode) => {
              const existingNode = existingNodesMap.get(rfNode.id);

              if (rfNode.type === "group") {
                const baseGroupNode = existingNode || {
                  id: rfNode.id,
                  type: "group",
                  name: `Group ${rfNode.id}`,
                  parameters: {},
                  position: rfNode.position,
                  disabled: false,
                };

                // React Flow stores dimensions in width/height properties
                // Merge them with existing style or create new style object
                const style = {
                  ...(rfNode.style || {}),
                  ...(rfNode.width !== undefined && { width: rfNode.width }),
                  ...(rfNode.height !== undefined && { height: rfNode.height }),
                };



                updatedNodes.push({
                  ...baseGroupNode,
                  position: rfNode.position,
                  style: style as any,
                });
              } else if (existingNode) {
                updatedNodes.push({
                  ...existingNode,
                  position: rfNode.position,
                  parentId: rfNode.parentId || undefined,
                  extent: (rfNode.extent || undefined) as any,
                });
              }
            });

            // Reset resize flags BEFORE updating Zustand
            // This allows WorkflowEditor to sync the updated dimensions back to ReactFlow
            resizeSnapshotTaken.current = false;
            isResizing.current = false;
            blockSync.current = false;

            // Save history with the final size
            updateWorkflow({ nodes: updatedNodes });
            setDirty(true);
          }
        }, 0);
      }
    },
    [onNodesChange, reactFlowInstance]
  );

  // Handle edge changes
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);

      // Handle edge removal
      changes.forEach((change) => {
        if (change.type === "remove") {
          removeConnection(change.id);
        }
      });
    },
    [onEdgesChange, removeConnection]
  );

  // Helper function to sync React Flow positions to Zustand after drag
  const syncPositionsToZustand = useCallback(() => {
    // Reset blockSync BEFORE updating workflow so the sync can happen
    blockSync.current = false;
    isDragging.current = false;
    dragSnapshotTaken.current = false;

    const { workflow, updateWorkflow } = useWorkflowStore.getState();
    if (workflow && reactFlowInstance) {
      const currentNodes = reactFlowInstance.getNodes();

      // Create a map of existing workflow nodes
      const existingNodesMap = new Map(workflow.nodes.map((n) => [n.id, n]));

      // Update existing nodes and add new group nodes
      const updatedNodes: WorkflowNode[] = [];

      currentNodes.forEach((rfNode) => {
        const existingNode = existingNodesMap.get(rfNode.id);

        if (rfNode.type === "group") {
          // Handle group nodes
          const baseGroupNode = existingNode || {
            id: rfNode.id,
            type: "group",
            name: `Group ${rfNode.id}`,
            parameters: {},
            position: rfNode.position,
            disabled: false,
          };

          // React Flow stores dimensions in width/height properties
          // Merge them with existing style or create new style object
          const style = {
            ...(rfNode.style || {}),
            ...(rfNode.width !== undefined && { width: rfNode.width }),
            ...(rfNode.height !== undefined && { height: rfNode.height }),
          };

          updatedNodes.push({
            ...baseGroupNode,
            position: rfNode.position,
            style: style as any,
          });
        } else if (existingNode) {
          // Update existing regular nodes
          updatedNodes.push({
            ...existingNode,
            position: rfNode.position,
            parentId: rfNode.parentId || undefined,
            extent: (rfNode.extent || undefined) as any,
          });
        }
      });

      // Don't skip history - we need to save the "after" state
      updateWorkflow({ nodes: updatedNodes });
    }
  }, [reactFlowInstance]);

  // Handle node drag start - just set flags, don't save history yet
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: any) => {
      isDragging.current = true;
      blockSync.current = true;
      dragSnapshotTaken.current = true;
    },
    []
  );

  // Handle node drag - check for group intersections and highlight
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent, node: any, nodes: any[]) => {
      // Call the group drag handler to check for intersections
      onNodeDragGroup(event, node, nodes);
    },
    [onNodeDragGroup]
  );

  // Handle node drag stop
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: any, nodes: any[]) => {
      // First, call the group drag stop handler to attach to group if needed
      onNodeDragStopGroup(event, node, nodes);

      // Skip syncPositionsToZustand if group attachment was handled
      // (it already synced to Zustand directly)
      if (groupAttachmentHandled.current) {
        groupAttachmentHandled.current = false;
        // Still reset the drag flags
        blockSync.current = false;
        isDragging.current = false;
        dragSnapshotTaken.current = false;
        return;
      }

      // Then sync positions (which also resets flags)
      syncPositionsToZustand();
    },
    [onNodeDragStopGroup, syncPositionsToZustand, groupAttachmentHandled]
  );

  // Handle selection drag start - just set flags, don't save history yet
  const handleSelectionDragStart = useCallback(
    (_event: React.MouseEvent, _nodes: any[]) => {
      isDragging.current = true;
      blockSync.current = true;
      dragSnapshotTaken.current = true;
    },
    []
  );

  // Handle selection drag stop
  const handleSelectionDragStop = useCallback(
    (_event: React.MouseEvent, _nodes: any[]) => {
      // Sync positions (which also resets flags)
      syncPositionsToZustand();
    },
    [syncPositionsToZustand]
  );

  // Handle nodes delete
  // This is called when user presses Delete/Backspace key
  const handleNodesDelete = useCallback((nodes: any[]) => {
    if (nodes.length === 0) return;
    
    const nodeIds = nodes.map((node) => node.id);
    deleteNodes(nodeIds);
  }, [deleteNodes]);

  // Handle edges delete
  const handleEdgesDelete = useCallback((edges: any[]) => {
    if (edges.length === 0) return;

    const edgeIds = edges.map((edge) => edge.id);

    // Update Zustand workflow store
    const { workflow, updateWorkflow, saveToHistory } =
      useWorkflowStore.getState();
    if (workflow) {
      // Save to history before deletion
      saveToHistory(`Delete ${edges.length} connection(s)`);

      // Remove connections from workflow
      // Skip history since we already saved before deletion
      updateWorkflow({
        connections: workflow.connections.filter(
          (conn) => !edgeIds.includes(conn.id)
        ),
      }, true);
    }
  }, []);

  // Get connection line path for editable edges (free drawing with spacebar)
  const connectionLinePath = useReactFlowUIStore((state) => state.connectionLinePath);
  const setConnectionLinePath = useReactFlowUIStore((state) => state.setConnectionLinePath);

  // Handle new connections
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;

      // Mark that a connection was successfully made
      connectionMadeRef.current = true;

      // Convert connectionLinePath to control points for editable edge
      const controlPoints = connectionLinePath.map((point, index) => ({
        ...point,
        id: `cp-${index}`,
        active: true,
      }));

      const newConnection: WorkflowConnection = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        sourceNodeId: connection.source,
        sourceOutput: connection.sourceHandle || "main",
        targetNodeId: connection.target,
        targetInput: connection.targetHandle || "main",
        // Store control points in the connection for persistence
        controlPoints: controlPoints.length > 0 ? controlPoints : undefined,
      };

      addConnection(newConnection);

      const newEdge = {
        id: newConnection.id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'editable-edge',
        data: {
          algorithm: 'Step',
          points: controlPoints,
        },
      };

      setEdges((edges) => addEdge(newEdge as Edge, edges));
      
      // Clear the connection line path after connection is made
      setConnectionLinePath([]);
    },
    [addConnection, setEdges, connectionLinePath, setConnectionLinePath]
  );

  // Handle drag over for node dropping
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle node drop from palette
  /**
   * Handle dropping a node from the sidebar onto the canvas
   * Uses React Flow's standard drag and drop pattern
   */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const nodeTypeData = event.dataTransfer.getData("application/reactflow");
      if (!nodeTypeData) return;

      try {
        const nodeType: NodeType & { isTemplate?: boolean; templateData?: any } = JSON.parse(nodeTypeData);

        // Convert screen coordinates to flow coordinates
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Handle template nodes
        if (isTemplateNode(nodeType)) {
          handleTemplateExpansion(nodeType, position);
          return;
        }

        // Create regular node with default parameters
        const parameters: Record<string, any> = { ...nodeType.defaults };
        nodeType.properties.forEach((property) => {
          if (property.default !== undefined && parameters[property.name] === undefined) {
            parameters[property.name] = property.default;
          }
        });

        const newNode: WorkflowNode = {
          id: `node-${Date.now()}`,
          type: nodeType.identifier,
          name: nodeType.displayName,
          parameters,
          position,
          credentials: [],
          disabled: false,
        };

        addNode(newNode);
      } catch (error) {
        console.error("Failed to parse dropped node data:", error);
      }
    },
    [reactFlowInstance, addNode, addConnection]
  );

  // Handle node double-click to open properties
  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      openNodeProperties(nodeId);
    },
    [openNodeProperties]
  );

  // Handle connection start - track the connection being created
  const handleConnectStart = useCallback(
    (
      _event: React.MouseEvent | React.TouchEvent,
      params: {
        nodeId: string | null;
        handleId: string | null;
        handleType: string | null;
      }
    ) => {
      if (params.nodeId && params.handleType === "source") {
        // Reset the connection made flag
        connectionMadeRef.current = false;

        const connection = {
          source: params.nodeId,
          sourceHandle: params.handleId ?? null,
          target: "",
          targetHandle: null,
        };
        setConnectionInProgress(connection);
        connectionRef.current = connection;
      }
    },
    []
  );

  // Handle connection end - if dropped on canvas, show add node dialog
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Use ref as fallback if state is null
      const activeConnection = connectionInProgress || connectionRef.current;

      if (!activeConnection || !reactFlowInstance) {
        setConnectionInProgress(null);
        connectionRef.current = null;
        connectionMadeRef.current = false;
        return;
      }

      // Use a small delay to allow handleConnect to fire first if a connection was made
      setTimeout(() => {
        // If a connection was successfully made to an existing node, don't open the dialog
        if (connectionMadeRef.current) {
          setConnectionInProgress(null);
          connectionRef.current = null;
          connectionMadeRef.current = false;
          return;
        }

        // Connection was not made to an existing node, so it was dropped on canvas
        if (activeConnection.source) {
          // Get the mouse position
          const clientX =
            "clientX" in event
              ? event.clientX
              : (event as TouchEvent).touches[0].clientX;
          const clientY =
            "clientY" in event
              ? event.clientY
              : (event as TouchEvent).touches[0].clientY;

          // Get the ReactFlow wrapper element from the DOM
          const reactFlowWrapper = document.querySelector(
            ".react-flow"
          ) as HTMLElement;
          const reactFlowBounds = reactFlowWrapper?.getBoundingClientRect();
          if (!reactFlowBounds) {
            setConnectionInProgress(null);
            connectionRef.current = null;
            connectionMadeRef.current = false;
            return;
          }

          // Convert screen coordinates to flow coordinates
          const position = reactFlowInstance.screenToFlowPosition({
            x: clientX - reactFlowBounds.left,
            y: clientY - reactFlowBounds.top,
          });

          // Open the add node dialog at the drop position with source connection context
          openDialog(position, {
            sourceNodeId: activeConnection.source,
            targetNodeId: "", // Empty target since we're adding a new node
            sourceOutput: activeConnection.sourceHandle || undefined,
            targetInput: undefined,
          });
        }

        setConnectionInProgress(null);
        connectionRef.current = null;
        connectionMadeRef.current = false;
      }, 0);
    },
    [connectionInProgress, reactFlowInstance, openDialog]
  );

  // ReactFlow control functions
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, [reactFlowInstance]);

  const handleZoomToFit = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.1 });
    }
  }, [reactFlowInstance]);

  // Sync React Flow state back to Zustand (call this before saving)
  const syncToZustand = useCallback(() => {
    const { workflow, setWorkflow } = useWorkflowStore.getState();
    if (!workflow) return;

    // Get current React Flow nodes
    const currentNodes = reactFlowInstance?.getNodes() || [];

    // Create a map of existing workflow nodes for quick lookup
    const existingNodesMap = new Map(workflow.nodes.map((n) => [n.id, n]));

    // Build updated nodes array
    const updatedNodes: WorkflowNode[] = [];

    currentNodes.forEach((rfNode) => {
      const existingNode = existingNodesMap.get(rfNode.id);

      if (rfNode.type === "group") {
        // Handle group nodes - preserve existing data and merge with current state
        const existingGroupNode = existingNodesMap.get(rfNode.id);
        const groupNode: WorkflowNode = existingGroupNode
          ? {
            ...existingGroupNode, // Preserve all existing fields (name, description, etc.)
            position: rfNode.position,
            style: rfNode.style as any,
          }
          : {
            // New group node
            id: rfNode.id,
            type: "group",
            name: "",
            parameters: rfNode.data || {},
            position: rfNode.position,
            disabled: false,
            style: rfNode.style as any,
          };
        updatedNodes.push(groupNode);
      } else if (existingNode) {
        // Update existing regular node with current position and parent info
        updatedNodes.push({
          ...existingNode,
          position: rfNode.position,
          parentId: rfNode.parentId || undefined,
          extent: (rfNode.extent || undefined) as any, // Cast to compatible type
        });
      }
      // Note: We skip nodes that don't exist in workflow and aren't groups
      // These might be temporary UI nodes that shouldn't be persisted
    });

    // Update Zustand workflow with synced nodes
    const updatedWorkflow = {
      ...workflow,
      nodes: updatedNodes,
    };

    setWorkflow(updatedWorkflow);
  }, [reactFlowInstance]);

  return {
    // Refs and instances
    reactFlowInstance,

    // Node and edge state
    nodes,
    edges,
    setNodes,
    setEdges,

    // Drag state
    isDragging,
    blockSync,

    // Sync utility
    syncToZustand,

    // Event handlers
    handleSelectionChange,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleConnectStart,
    handleConnectEnd,
    handleDragOver,
    handleDrop,
    handleNodeDoubleClick,

    // Undo/Redo optimized handlers
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    handleSelectionDragStart,
    handleSelectionDragStop,
    handleNodesDelete,
    handleEdgesDelete,

    // Controls
    handleZoomIn,
    handleZoomOut,
    handleFitView,
    handleZoomToFit,

    // State
    selectedNodeId,
  };
}
