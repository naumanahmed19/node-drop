import { NodeType, WorkflowConnection, WorkflowNode } from "@/types";

// Type definitions for workflow data
type NodeExecutionResult = {
  nodeId: string;
  status: "idle" | "running" | "success" | "error" | "skipped";
  [key: string]: any;
};

type ExecutionState = {
  status: "idle" | "running" | "success" | "error" | "cancelled" | "paused";
  executionId?: string;
};

type ExecutionResult = {
  nodeResults: NodeExecutionResult[];
};

/**
 * Determines the execution status of a node based on current execution state
 */
export function getNodeExecutionStatus(
  nodeId: string,
  executionState: ExecutionState,
  nodeResult: NodeExecutionResult | undefined,
  lastExecutionResult: ExecutionResult | null,
  lastResultsMap?: Map<string, NodeExecutionResult>
): "idle" | "running" | "success" | "error" | "skipped" {
  if (executionState.status === "running") {
    if (nodeResult) {
      return nodeResult.status;
    }
    return "idle";
  }

  if (
    executionState.status === "success" ||
    executionState.status === "error" ||
    executionState.status === "cancelled"
  ) {
    if (nodeResult) {
      return nodeResult.status;
    }

    if (lastExecutionResult) {
      // Use provided map for O(1) lookup, or fallback to find for backwards compatibility
      const lastNodeResult = lastResultsMap
        ? lastResultsMap.get(nodeId)
        : lastExecutionResult.nodeResults.find((nr) => nr.nodeId === nodeId);
      if (lastNodeResult) {
        return lastNodeResult.status;
      }
    }
  }

  return "idle";
}

/**
 * Creates a Map for faster node type lookups (O(1) instead of O(n))
 */
function createNodeTypeMap(nodeTypes: NodeType[]): Map<string, NodeType> {
  return new Map(nodeTypes.map((nt) => [nt.identifier, nt]));
}

/**
 * Creates a Map for faster execution result lookups
 */
function createNodeResultsMap(
  executionResult: ExecutionResult | null
): Map<string, NodeExecutionResult> {
  if (!executionResult) return new Map();
  return new Map(executionResult.nodeResults.map((nr) => [nr.nodeId, nr]));
}

/**
 * Gets the dynamic outputs for a node based on its configuration
 */
function getNodeOutputs(
  node: WorkflowNode,
  nodeTypeDefinition: NodeType | undefined
): string[] {
  if (node.type === "switch" && node.parameters?.outputs) {
    return (node.parameters.outputs as any[]).map(
      (output: any, index: number) => output.outputName || `Output ${index + 1}`
    );
  }
  return nodeTypeDefinition?.outputs || [];
}

/**
 * Gets the dynamic inputs for a node based on its configuration
 */
function getNodeInputs(
  node: WorkflowNode,
  nodeTypeDefinition: NodeType | undefined
): string[] {
  // Chat node: dynamic inputs based on acceptInput parameter
  if (node.type === "chat" && node.parameters?.acceptInput === true) {
    return ["main"];
  }
  
  // If inputsConfig exists, extract all input names from it
  if (nodeTypeDefinition?.inputsConfig) {
    return Object.keys(nodeTypeDefinition.inputsConfig);
  }
  
  return nodeTypeDefinition?.inputs || [];
}



/**
 * Gets the custom style configuration for a node
 */
function getNodeCustomStyle(
  node: WorkflowNode,
  nodeTypeDefinition: NodeType | undefined
) {
  const isTrigger = nodeTypeDefinition?.executionCapability === "trigger";

  return {
    backgroundColor: nodeTypeDefinition?.color || "#666",
    borderColor: undefined, // Will be handled by CSS based on selection state
    borderWidth: 2,
    borderRadius: isTrigger ? 32 : 8,
    shape: isTrigger ? ("trigger" as const) : ("rectangle" as const),
    opacity: node.disabled ? 0.5 : 1.0,
  };
}

/**
 * Transforms workflow nodes into React Flow node format
 */
export function transformWorkflowNodesToReactFlow(
  workflowNodes: WorkflowNode[],
  availableNodeTypes: NodeType[],
  executionState: ExecutionState,
  getNodeResult: (nodeId: string) => NodeExecutionResult | undefined,
  lastExecutionResult: ExecutionResult | null
) {
  // Create Maps for O(1) lookups instead of O(n) finds
  const nodeTypeMap = createNodeTypeMap(availableNodeTypes);
  const lastResultsMap = createNodeResultsMap(lastExecutionResult);

  // Sort nodes so that group nodes come before their children
  // This is important for React Flow to properly establish parent-child relationships
  const sortedNodes = [...workflowNodes].sort((a, b) => {
    // Group nodes should come first
    if (a.type === "group" && b.type !== "group") return -1;
    if (a.type !== "group" && b.type === "group") return 1;

    // If both are groups or both are regular nodes, maintain original order
    return 0;
  });

  const result = sortedNodes.map((node) => {
    // Handle group nodes separately
    if (node.type === "group") {
      return {
        id: node.id,
        type: "group",
        position: node.position,
        style: node.style || {},
        data: node.parameters || {},
      };
    }

    const nodeResult = getNodeResult(node.id);
    const nodeStatus = getNodeExecutionStatus(
      node.id,
      executionState,
      nodeResult,
      lastExecutionResult,
      lastResultsMap
    );
    const nodeTypeDefinition = nodeTypeMap.get(node.type);

    // Use specific node type for special nodes with custom renderers, otherwise use 'custom'
    const reactFlowNodeType =
      node.type === "chat"
        ? "chat"
        : node.type === "image-preview"
        ? "image-preview"
        : node.type === "data-preview"
        ? "data-preview"
        : node.type === "forms"
        ? "forms"
        : node.type === "annotation"
        ? "annotation"
        : "custom";

    // Build the base node
    const reactFlowNode: any = {
      id: node.id,
      type: reactFlowNodeType,
      position: node.position,
      // Note: draggable, selectable, deletable should not be set as boolean props
      // They are controlled by ReactFlow component props (nodesDraggable, elementsSelectable, etc.)
      data: {
        label: node.name,
        nodeType: node.type,
        parameters: node.parameters,
        disabled: node.disabled,
        locked: node.locked,
        status: nodeStatus,
        inputs: getNodeInputs(node, nodeTypeDefinition),
        outputs: getNodeOutputs(node, nodeTypeDefinition),
        inputsConfig: nodeTypeDefinition?.inputsConfig,
        position: node.position,
        dimensions: { width: 64, height: 64 },
        customStyle: getNodeCustomStyle(node, nodeTypeDefinition),
        executionResult: nodeResult,
        lastExecutionData: lastResultsMap.get(node.id),
        // Add node type definition and execution capability
        nodeTypeDefinition,
        executionCapability: nodeTypeDefinition?.executionCapability,
      },
    };

    // Add parent/child relationship properties if they exist
    if (node.parentId) {
      reactFlowNode.parentId = node.parentId;
      reactFlowNode.expandParent = false; // Prevent auto-expanding parent when child moves
    }
    if (node.extent) {
      reactFlowNode.extent = node.extent;
    }

    return reactFlowNode;
  });

  return result;
}

/**
 * Transforms workflow connections into React Flow edge format
 */
export function transformWorkflowEdgesToReactFlow(
  connections: WorkflowConnection[],
  executionStateKey?: string
) {
  return connections.map((conn) => {
    return {
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      sourceHandle: conn.sourceOutput,
      targetHandle: conn.targetInput,
      type: "editable-edge",
      data: {
        label: conn.sourceOutput !== "main" ? conn.sourceOutput : undefined,
        // Add execution state key to force edge re-render when execution completes
        executionStateKey,
        // Editable edge configuration - use saved algorithm or default to Step
        algorithm: conn.algorithm || "Step",
        points: conn.controlPoints || [],
      },
    };
  });
}
