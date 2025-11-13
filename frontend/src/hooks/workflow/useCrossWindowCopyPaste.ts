import { useWorkflowStore } from "@/stores";
import { WorkflowConnection, WorkflowNode } from "@/types/workflow";
import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";

// Custom MIME type for workflow nodes (similar to n8n's approach)
const WORKFLOW_MIME_TYPE = "application/vnd.workflow.nodes+json";

interface SharedNodesData {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  timestamp: number;
  version: string;
}

/**
 * Hook for cross-window/cross-site node sharing
 * Uses Clipboard API with custom MIME type (similar to n8n)
 * Works across different browser windows/tabs and even different websites
 */
export function useCrossWindowCopyPaste() {
  const [hasSharedNodes, setHasSharedNodes] = useState(false);
  const { getNodes } = useReactFlow();

  /**
   * Copy selected nodes to clipboard with custom MIME type
   * This allows pasting across different browser windows/tabs and websites
   */
  const shareNodes = useCallback(async () => {
    const { workflow } = useWorkflowStore.getState();
    if (!workflow) {
      console.log("📤 No workflow loaded");
      return;
    }

    // Get selected nodes from React Flow
    const reactFlowNodes = getNodes();
    const selectedNodeIds = reactFlowNodes
      .filter((node) => node.selected)
      .map((node) => node.id);

    if (selectedNodeIds.length === 0) {
      console.log("📤 No nodes selected to share");
      return;
    }

    // Include child nodes if a group is selected
    const selectedGroupIds = reactFlowNodes
      .filter((node) => node.selected && node.type === "group")
      .map((node) => node.id);

    const childNodeIds = reactFlowNodes
      .filter((node) => node.parentId && selectedGroupIds.includes(node.parentId))
      .map((node) => node.id);

    const allNodeIds = [...selectedNodeIds, ...childNodeIds];

    // Get nodes to share
    const nodesToShare = workflow.nodes.filter((node) =>
      allNodeIds.includes(node.id)
    );

    // Get connections where both source and target are in the shared set
    const connectionsToShare = workflow.connections.filter(
      (conn) =>
        allNodeIds.includes(conn.sourceNodeId) &&
        allNodeIds.includes(conn.targetNodeId)
    );

    const sharedData: SharedNodesData = {
      nodes: nodesToShare,
      connections: connectionsToShare,
      timestamp: Date.now(),
      version: "1.0",
    };

    try {
      // Use Clipboard API with custom MIME type
      const jsonString = JSON.stringify(sharedData);
      const blob = new Blob([jsonString], { type: WORKFLOW_MIME_TYPE });
      
      // Also add as plain text for fallback
      const textBlob = new Blob([jsonString], { type: "text/plain" });
      
      const clipboardItem = new ClipboardItem({
        [WORKFLOW_MIME_TYPE]: blob,
        "text/plain": textBlob,
      });

      await navigator.clipboard.write([clipboardItem]);
      setHasSharedNodes(true);
      
      console.log(
        `📤 Copied ${nodesToShare.length} nodes and ${connectionsToShare.length} connections to clipboard`
      );
    } catch (error) {
      console.error("Failed to copy nodes to clipboard:", error);
      // Fallback: try text/plain only
      try {
        await navigator.clipboard.writeText(JSON.stringify(sharedData));
        setHasSharedNodes(true);
        console.log("📤 Copied nodes as plain text (fallback)");
      } catch (fallbackError) {
        console.error("Fallback copy also failed:", fallbackError);
      }
    }
  }, [getNodes]);

  /**
   * Paste nodes from clipboard
   * Reads from clipboard using custom MIME type or falls back to plain text
   */
  const importSharedNodes = useCallback(async (position?: { x: number; y: number }) => {
    try {
      const { workflow, updateWorkflow } = useWorkflowStore.getState();

      if (!workflow) {
        console.log("📥 No workflow loaded");
        return;
      }

      // Try to read from clipboard
      let sharedData: SharedNodesData | null = null;

      try {
        // Try reading with custom MIME type first
        const clipboardItems = await navigator.clipboard.read();
        
        for (const item of clipboardItems) {
          // Try custom MIME type
          if (item.types.includes(WORKFLOW_MIME_TYPE)) {
            const blob = await item.getType(WORKFLOW_MIME_TYPE);
            const text = await blob.text();
            sharedData = JSON.parse(text);
            break;
          }
          // Fallback to plain text
          else if (item.types.includes("text/plain")) {
            const blob = await item.getType("text/plain");
            const text = await blob.text();
            // Try to parse as workflow data
            try {
              const parsed = JSON.parse(text);
              if (parsed.nodes && parsed.connections) {
                sharedData = parsed;
                break;
              }
            } catch {
              // Not workflow data, ignore
            }
          }
        }
      } catch (error) {
        // Fallback: try readText
        const text = await navigator.clipboard.readText();
        try {
          const parsed = JSON.parse(text);
          if (parsed.nodes && parsed.connections) {
            sharedData = parsed;
          }
        } catch {
          console.log("📥 Clipboard doesn't contain workflow nodes");
          return;
        }
      }

      if (!sharedData) {
        console.log("📥 No workflow nodes found in clipboard");
        return;
      }

      // Use provided position or center of viewport
      const pastePosition = position || { x: 100, y: 100 };

      // Find the top-left corner of top-level nodes
      const topLevelNodes = sharedData.nodes.filter((node) => !node.parentId);
      if (topLevelNodes.length === 0) {
        console.log("📥 No valid nodes to paste");
        return;
      }

      const minX = Math.min(...topLevelNodes.map((node) => node.position.x));
      const minY = Math.min(...topLevelNodes.map((node) => node.position.y));

      // Generate unique timestamp for new IDs
      const now = Date.now();

      // Create new nodes with updated IDs and positions
      const newNodes = sharedData.nodes.map((node) => {
        const id = `${node.id}-${now}`;

        // Calculate new position
        let x, y;
        if (node.parentId) {
          // Child node - keep relative position
          x = node.position.x;
          y = node.position.y;
        } else {
          // Top-level node - calculate new absolute position
          x = pastePosition.x + (node.position.x - minX);
          y = pastePosition.y + (node.position.y - minY);
        }

        // Update parentId if the node has one
        const newParentId = node.parentId ? `${node.parentId}-${now}` : undefined;

        return {
          ...node,
          id,
          position: { x, y },
          parentId: newParentId,
          selected: true,
        };
      });

      // Create new connections with updated IDs
      const newConnections = sharedData.connections.map((conn) => {
        return {
          ...conn,
          id: `${conn.id}-${now}`,
          sourceNodeId: `${conn.sourceNodeId}-${now}`,
          targetNodeId: `${conn.targetNodeId}-${now}`,
        };
      });

      // Deselect existing nodes
      const updatedExistingNodes = workflow.nodes.map((node) => ({
        ...node,
        selected: false,
      }));

      // Update workflow with new nodes and connections
      updateWorkflow({
        nodes: [...updatedExistingNodes, ...newNodes],
        connections: [...workflow.connections, ...newConnections],
      });

      console.log(
        `📥 Pasted ${newNodes.length} nodes and ${newConnections.length} connections from clipboard`
      );
    } catch (error) {
      console.error("Failed to paste nodes from clipboard:", error);
    }
  }, []);

  return {
    shareNodes,
    importSharedNodes,
    hasSharedNodes,
  };
}
