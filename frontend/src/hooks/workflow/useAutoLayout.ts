import { useWorkflowStore } from '@/stores';
import { WorkflowNode } from '@/types';
import { useReactFlow } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { useCallback } from 'react';

/**
 * Hook for auto-layout functionality using Dagre algorithm
 */
export function useAutoLayout() {
  const reactFlowInstance = useReactFlow();
  const { workflow, updateWorkflow, saveToHistory } = useWorkflowStore();

  const applyAutoLayout = useCallback(
    (direction: 'TB' | 'LR' = 'LR', fitView = true) => {
      if (!workflow || !reactFlowInstance) return;

      // Save to history before layout
      saveToHistory('Auto-layout nodes');

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      // Configure the graph
      const nodeWidth = 200;
      const nodeHeight = 100;
      const isHorizontal = direction === 'LR';

      dagreGraph.setGraph({
        rankdir: direction,
        nodesep: isHorizontal ? 100 : 50,
        ranksep: isHorizontal ? 150 : 100,
        edgesep: 50,
        marginx: 50,
        marginy: 50,
      });

      // Get all nodes from React Flow
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();

      // Separate nodes by parent (groups vs non-grouped nodes)
      const nodesByParent = new Map<string | undefined, typeof nodes>();
      nodes.forEach((node) => {
        const parentId = node.parentId;
        if (!nodesByParent.has(parentId)) {
          nodesByParent.set(parentId, []);
        }
        nodesByParent.get(parentId)!.push(node);
      });

      // Layout each group separately
      const updatedNodes: WorkflowNode[] = [];

      nodesByParent.forEach((groupNodes, parentId) => {
        // Skip group nodes themselves
        const regularNodes = groupNodes.filter((n) => n.type !== 'group');
        if (regularNodes.length === 0) return;

        // Create a new dagre graph for this group
        const groupGraph = new dagre.graphlib.Graph();
        groupGraph.setDefaultEdgeLabel(() => ({}));
        groupGraph.setGraph({
          rankdir: direction,
          nodesep: isHorizontal ? 100 : 50,
          ranksep: isHorizontal ? 150 : 100,
          edgesep: 50,
          marginx: 50,
          marginy: 50,
        });

        // Add nodes to the graph
        regularNodes.forEach((node) => {
          groupGraph.setNode(node.id, {
            width: node.width || nodeWidth,
            height: node.height || nodeHeight,
          });
        });

        // Add edges to the graph (only edges within this group)
        edges.forEach((edge) => {
          const sourceNode = regularNodes.find((n) => n.id === edge.source);
          const targetNode = regularNodes.find((n) => n.id === edge.target);
          if (sourceNode && targetNode) {
            groupGraph.setEdge(edge.source, edge.target);
          }
        });

        // Calculate layout
        dagre.layout(groupGraph);

        // Get the offset for this group (if it's inside a parent)
        let offsetX = 0;
        let offsetY = 0;
        if (parentId) {
          const parentNode = nodes.find((n) => n.id === parentId);
          if (parentNode) {
            offsetX = parentNode.position.x + 20; // Add padding inside group
            offsetY = parentNode.position.y + 60; // Add padding for group header
          }
        }

        // Update node positions
        regularNodes.forEach((node) => {
          const nodeWithPosition = groupGraph.node(node.id);
          const workflowNode = workflow.nodes.find((n) => n.id === node.id);

          if (workflowNode && nodeWithPosition) {
            updatedNodes.push({
              ...workflowNode,
              position: {
                x: nodeWithPosition.x - (node.width || nodeWidth) / 2 + offsetX,
                y: nodeWithPosition.y - (node.height || nodeHeight) / 2 + offsetY,
              },
            });
          }
        });
      });

      // Preserve group nodes and other nodes that weren't processed
      workflow.nodes.forEach((node) => {
        if (!updatedNodes.find((n) => n.id === node.id)) {
          updatedNodes.push(node);
        }
      });

      // Update workflow with new positions
      // Skip history since we already saved before layout
      updateWorkflow({ nodes: updatedNodes }, true);

      // Fit view after layout with a small delay to ensure nodes are updated
      if (fitView) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.1, duration: 400 });
        }, 50);
      }
    },
    [workflow, reactFlowInstance, updateWorkflow, saveToHistory]
  );

  const applyHorizontalLayout = useCallback(() => {
    applyAutoLayout('LR');
  }, [applyAutoLayout]);

  const applyVerticalLayout = useCallback(() => {
    applyAutoLayout('TB');
  }, [applyAutoLayout]);

  return {
    applyAutoLayout,
    applyHorizontalLayout,
    applyVerticalLayout,
  };
}
