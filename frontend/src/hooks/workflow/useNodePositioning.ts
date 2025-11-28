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

  const calculateServiceInputPosition = useCallback(
    (targetNodeId: string): PositionResult => {
      const targetNode = reactFlowInstance?.getNode(targetNodeId)
      const parentGroupId = targetNode?.parentId

      if (!targetNode) {
        return { nodePosition: { x: 300, y: 300 }, parentGroupId }
      }

      const targetHeight = targetNode.height || DEFAULT_NODE_HEIGHT
      const initialPosition = {
        x: targetNode.position.x,
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

      // Fallback: position to the right of source node
      if (sourceNode) {
        const sourceWidth = sourceNode.width || DEFAULT_NODE_WIDTH
        const initialPosition = {
          x: sourceNode.position.x + sourceWidth + DEFAULT_GAP,
          y: sourceNode.position.y,
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
      const targetWidth = targetNode.width || DEFAULT_NODE_WIDTH
      const newNodeWidth = DEFAULT_NODE_WIDTH
      const gap = SERVICE_GAP

      // Calculate the vector from source to target
      const deltaX = targetNode.position.x - sourceNode.position.x
      const deltaY = targetNode.position.y - sourceNode.position.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Calculate direction vector (normalized)
      const directionX = deltaX / distance
      const directionY = deltaY / distance

      // Calculate minimum distance needed for all three nodes
      const minDistanceNeeded = sourceWidth + gap + newNodeWidth + gap

      let nodePosition: { x: number; y: number }

      if (distance >= minDistanceNeeded + targetWidth) {
        // Enough space - place in the middle
        const distanceFromSource = sourceWidth + gap
        nodePosition = {
          x: sourceNode.position.x + directionX * distanceFromSource,
          y: sourceNode.position.y + directionY * distanceFromSource,
        }
      } else {
        // Not enough space - shift target and downstream nodes
        const additionalSpace = minDistanceNeeded - distance + targetWidth
        const shiftX = directionX * additionalSpace
        const shiftY = directionY * additionalSpace

        // Helper function to recursively shift nodes
        const shiftNodeAndDownstream = (
          nodeId: string,
          visited = new Set<string>()
        ) => {
          if (visited.has(nodeId)) return
          visited.add(nodeId)

          const node = reactFlowInstance?.getNode(nodeId)
          if (!node) return

          // Shift this node
          updateNode(nodeId, {
            position: {
              x: node.position.x + shiftX,
              y: node.position.y + shiftY,
            },
          })

          // Find all connections where this node is the source and shift their targets
          workflow?.connections.forEach((conn: any) => {
            if (conn.sourceNodeId === nodeId) {
              shiftNodeAndDownstream(conn.targetNodeId, visited)
            }
          })
        }

        // Start shifting from the target node
        shiftNodeAndDownstream(targetNodeId)

        // Now position the new node
        const distanceFromSource = sourceWidth + gap
        nodePosition = {
          x: sourceNode.position.x + directionX * distanceFromSource,
          y: sourceNode.position.y + directionY * distanceFromSource,
        }
      }

      return { nodePosition, parentGroupId }
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

      // Service input connection
      const isServiceInputConnection =
        insertionContext.targetNodeId && !insertionContext.sourceNodeId

      if (isServiceInputConnection) {
        return calculateServiceInputPosition(insertionContext.targetNodeId)
      }

      // Canvas drop connection
      if (insertionContext.sourceNodeId && !insertionContext.targetNodeId) {
        return calculateCanvasDropPosition(insertionContext.sourceNodeId, position)
      }

      // Insert between nodes
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
