import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

interface NodeInsertionContext {
  sourceNodeId: string
  targetNodeId: string
  sourceOutput?: string
  targetInput?: string
}

interface PositionCalculationParams {
  insertionContext?: NodeInsertionContext
  position?: { x: number; y: number }
}

interface PositionResult {
  nodePosition: { x: number; y: number }
  parentGroupId?: string
  sourceNodeIdForConnection?: string
}

const DEFAULT_NODE_WIDTH = 200
const DEFAULT_NODE_HEIGHT = 100
const DEFAULT_GAP = 100
const SERVICE_GAP = 80

export function useNodePositioning() {
  const reactFlowInstance = useReactFlow()

  const findNonOverlappingPosition = useCallback(
    (
      initialPosition: { x: number; y: number },
      nodeWidth = DEFAULT_NODE_WIDTH,
      nodeHeight = DEFAULT_NODE_HEIGHT,
      parentId?: string
    ) => {
      const allNodes = reactFlowInstance?.getNodes() || []
      const padding = 20

      // Filter nodes to check - only nodes in the same parent (or no parent)
      const nodesToCheck = allNodes.filter(
        (n) => n.type !== 'group' && n.parentId === parentId
      )

      const isOverlapping = (pos: { x: number; y: number }) => {
        return nodesToCheck.some((node) => {
          const nodeW = (node.width || DEFAULT_NODE_WIDTH) + padding
          const nodeH = (node.height || DEFAULT_NODE_HEIGHT) + padding

          return !(
            pos.x + nodeWidth < node.position.x ||
            pos.x > node.position.x + nodeW ||
            pos.y + nodeHeight < node.position.y ||
            pos.y > node.position.y + nodeH
          )
        })
      }

      // If initial position doesn't overlap, use it
      if (!isOverlapping(initialPosition)) {
        return initialPosition
      }

      // Try positions in a spiral pattern around the initial position
      const step = 50
      for (let radius = 1; radius <= 10; radius++) {
        const positions = [
          { x: initialPosition.x + radius * step, y: initialPosition.y }, // Right
          { x: initialPosition.x, y: initialPosition.y + radius * step }, // Down
          {
            x: initialPosition.x + radius * step,
            y: initialPosition.y + radius * step,
          }, // Down-right diagonal
          { x: initialPosition.x, y: initialPosition.y - radius * step }, // Up
        ]

        for (const pos of positions) {
          if (!isOverlapping(pos)) return pos
        }
      }

      // Fallback to initial position if no free space found
      return initialPosition
    },
    [reactFlowInstance]
  )

  /**
   * Calculate position when adding a service provider node (model, tool, memory)
   * 
   * Auto-layout strategy:
   * - Place new node vertically below the target node
   * - Align on X-axis with target node
   * - Use smaller gap (SERVICE_GAP) for service connections
   * - Find non-overlapping position if needed
   * 
   * This is used when clicking a node's service input handle (bottom/top + button)
   * Example: Adding a model provider below an LLM node
   */
  const calculateServiceInputPosition = useCallback(
    (targetNodeId: string): PositionResult => {
      const targetNode = reactFlowInstance?.getNode(targetNodeId)
      const parentGroupId = targetNode?.parentId

      if (!targetNode) {
        return { nodePosition: { x: 300, y: 300 }, parentGroupId }
      }

      const targetHeight = targetNode.height || DEFAULT_NODE_HEIGHT
      const initialPosition = {
        x: targetNode.position.x, // Align vertically
        y: targetNode.position.y + targetHeight + SERVICE_GAP,
      }

      return {
        nodePosition: findNonOverlappingPosition(
          initialPosition,
          DEFAULT_NODE_WIDTH,
          DEFAULT_NODE_HEIGHT,
          parentGroupId
        ),
        parentGroupId,
      }
    },
    [reactFlowInstance, findNonOverlappingPosition]
  )

  /**
   * Calculate position when adding a node from a source node's output handle
   * 
   * Two scenarios:
   * 1. User dragged and dropped at a specific position - use that exact position
   * 2. User clicked the + button - auto-position to the right of source node
   * 
   * Auto-layout strategy (when no position provided):
   * - Place new node horizontally to the right of source
   * - Align on Y-axis with source node
   * - Find non-overlapping position if needed
   * 
   * This is used when clicking a node's output handle + button
   */
  const calculateCanvasDropPosition = useCallback(
    (sourceNodeId: string, position?: { x: number; y: number }): PositionResult => {
      const sourceNode = reactFlowInstance?.getNode(sourceNodeId)
      const parentGroupId = sourceNode?.parentId

      // Use exact position where user dropped (no auto-layout)
      if (position) {
        return {
          nodePosition: position,
          parentGroupId,
          sourceNodeIdForConnection: sourceNodeId,
        }
      }

      // Auto-layout: position to the right of source node
      if (sourceNode) {
        const sourceWidth = sourceNode.width || DEFAULT_NODE_WIDTH
        const initialPosition = {
          x: sourceNode.position.x + sourceWidth + DEFAULT_GAP,
          y: sourceNode.position.y, // Align horizontally
        }

        return {
          nodePosition: findNonOverlappingPosition(
            initialPosition,
            DEFAULT_NODE_WIDTH,
            DEFAULT_NODE_HEIGHT,
            parentGroupId
          ),
          parentGroupId,
          sourceNodeIdForConnection: sourceNodeId,
        }
      }

      return {
        nodePosition: { x: 300, y: 300 },
        sourceNodeIdForConnection: sourceNodeId,
      }
    },
    [reactFlowInstance, findNonOverlappingPosition]
  )

  /**
   * Calculate position when inserting a node between two connected nodes
   * 
   * Auto-layout strategy:
   * 1. Place new node horizontally to the right of source node
   * 2. Align new node on Y-axis with source node (horizontal alignment)
   * 3. If target node is too close, shift it and all downstream nodes to the right
   * 
   * This ensures:
   * - Nodes stay in a clean horizontal line
   * - Proper spacing is maintained (DEFAULT_GAP)
   * - Downstream nodes are automatically repositioned
   * - No diagonal or misaligned layouts
   * 
   * Example:
   * Before: [Source] -----> [Target]
   * After:  [Source] -> [New] -> [Target (shifted if needed)]
   */
  const calculateInsertBetweenPosition = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      updateNode: (nodeId: string, updates: any) => void,
      workflow: any
    ): PositionResult => {
      const sourceNode = reactFlowInstance?.getNode(sourceNodeId)
      const targetNode = reactFlowInstance?.getNode(targetNodeId)

      if (!sourceNode || !targetNode) {
        return { nodePosition: { x: 300, y: 300 } }
      }

      const parentGroupId = sourceNode.parentId
      const sourceWidth = sourceNode.width || DEFAULT_NODE_WIDTH
      const newNodeWidth = DEFAULT_NODE_WIDTH
      const gap = DEFAULT_GAP

      // Calculate new node position - horizontally to the right of source, aligned on Y-axis
      const newNodeX = sourceNode.position.x + sourceWidth + gap
      const newNodeY = sourceNode.position.y // Keep same Y position for horizontal alignment

      // Calculate how much space we need for: source + gap + newNode + gap
      const spaceNeeded = newNodeX + newNodeWidth + gap
      const currentTargetX = targetNode.position.x

      // Check if we need to shift the target node to make room
      if (currentTargetX < spaceNeeded) {
        const shiftAmount = spaceNeeded - currentTargetX

        // Helper function to recursively shift nodes to the right
        // This maintains the workflow structure by shifting all downstream nodes
        const shiftNodeAndDownstream = (
          nodeId: string,
          visited = new Set<string>()
        ) => {
          if (visited.has(nodeId)) return
          visited.add(nodeId)

          const node = reactFlowInstance?.getNode(nodeId)
          if (!node) return

          // Shift this node horizontally to the right only
          // Y position stays the same to maintain horizontal alignment
          updateNode(nodeId, {
            position: {
              x: node.position.x + shiftAmount,
              y: node.position.y, // Keep Y position unchanged
            },
          })

          // Find all connections where this node is the source and shift their targets
          // This recursively shifts the entire downstream chain
          workflow?.connections.forEach((conn: any) => {
            if (conn.sourceNodeId === nodeId) {
              shiftNodeAndDownstream(conn.targetNodeId, visited)
            }
          })
        }

        // Start shifting from the target node
        shiftNodeAndDownstream(targetNodeId)
      }

      return { 
        nodePosition: { x: newNodeX, y: newNodeY }, 
        parentGroupId 
      }
    },
    [reactFlowInstance]
  )

  const calculateSelectedNodePosition = useCallback(
    (selectedNodeId: string): PositionResult => {
      const selectedNode = reactFlowInstance?.getNode(selectedNodeId)
      const parentGroupId = selectedNode?.parentId

      if (!selectedNode) {
        return { nodePosition: { x: 300, y: 300 } }
      }

      const selectedWidth = selectedNode.width || DEFAULT_NODE_WIDTH
      const initialPosition = {
        x: selectedNode.position.x + selectedWidth + DEFAULT_GAP,
        y: selectedNode.position.y,
      }

      return {
        nodePosition: findNonOverlappingPosition(
          initialPosition,
          DEFAULT_NODE_WIDTH,
          DEFAULT_NODE_HEIGHT,
          parentGroupId
        ),
        parentGroupId,
        sourceNodeIdForConnection: selectedNodeId,
      }
    },
    [reactFlowInstance, findNonOverlappingPosition]
  )

  /**
   * Main entry point for calculating node position based on insertion context
   * 
   * Routing logic:
   * 1. No insertion context:
   *    - If one node selected: position to the right of it
   *    - If position provided: use that exact position
   *    - Otherwise: center of viewport
   * 
   * 2. Service input connection (targetNodeId only):
   *    - Position below the target node (vertical layout)
   *    - Used for adding service providers (model, tool, memory)
   * 
   * 3. Canvas drop connection (sourceNodeId only):
   *    - Position to the right of source node (horizontal layout)
   *    - Used when clicking node output handle + button
   * 
   * 4. Insert between nodes (both sourceNodeId and targetNodeId):
   *    - Position between source and target with auto-layout
   *    - Shift downstream nodes if needed
   *    - Used when clicking edge + button
   * 
   * Important: We don't pass screen coordinates from UI events
   * Instead, we let these functions calculate proper flow coordinates
   * This ensures consistent auto-layout and prevents positioning bugs
   */
  const calculateNodePosition = useCallback(
    (
      params: PositionCalculationParams,
      updateNode: (nodeId: string, updates: any) => void,
      workflow: any
    ): PositionResult => {
      const { insertionContext, position } = params

      if (!insertionContext) {
        // No insertion context - check if there's a selected node
        const selectedNodes =
          reactFlowInstance?.getNodes().filter((node) => node.selected) || []

        if (selectedNodes.length === 1) {
          return calculateSelectedNodePosition(selectedNodes[0].id)
        }

        // Use provided position or viewport center
        if (position) {
          return { nodePosition: position }
        }

        const viewportCenter = reactFlowInstance?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) || { x: 300, y: 300 }

        return {
          nodePosition: findNonOverlappingPosition(
            viewportCenter,
            DEFAULT_NODE_WIDTH,
            DEFAULT_NODE_HEIGHT
          ),
        }
      }

      // Service input connection (targetNodeId only)
      const isServiceInputConnection =
        insertionContext.targetNodeId && !insertionContext.sourceNodeId

      if (isServiceInputConnection) {
        return calculateServiceInputPosition(insertionContext.targetNodeId)
      }

      // Canvas drop connection (sourceNodeId only)
      if (insertionContext.sourceNodeId && !insertionContext.targetNodeId) {
        return calculateCanvasDropPosition(insertionContext.sourceNodeId, position)
      }

      // Insert between nodes (both sourceNodeId and targetNodeId)
      if (insertionContext.targetNodeId && insertionContext.sourceNodeId) {
        return calculateInsertBetweenPosition(
          insertionContext.sourceNodeId,
          insertionContext.targetNodeId,
          updateNode,
          workflow
        )
      }

      return { nodePosition: { x: 300, y: 300 } }
    },
    [
      reactFlowInstance,
      findNonOverlappingPosition,
      calculateServiceInputPosition,
      calculateCanvasDropPosition,
      calculateInsertBetweenPosition,
      calculateSelectedNodePosition,
    ]
  )

  return {
    calculateNodePosition,
    findNonOverlappingPosition,
  }
}
