import { useCallback } from 'react'
import { NodeType, WorkflowConnection } from '@/types'

interface NodeInsertionContext {
  sourceNodeId: string
  targetNodeId: string
  sourceOutput?: string
  targetInput?: string
}

interface CreateConnectionParams {
  newNodeId: string
  nodeType: NodeType
  insertionContext?: NodeInsertionContext
  sourceNodeIdForConnection?: string
  workflow: any
  addConnection: (connection: WorkflowConnection) => void
  removeConnection: (connectionId: string) => void
}

export function useNodeConnection() {
  const createServiceInputConnection = useCallback(
    (
      newNodeId: string,
      nodeType: NodeType,
      insertionContext: NodeInsertionContext,
      addConnection: (connection: WorkflowConnection) => void
    ) => {
      // Determine the output handle for the new node
      let newNodeOutput = insertionContext.sourceOutput || 'main'

      // If the node type has specific outputs, use the first matching one
      if (nodeType.outputs && nodeType.outputs.length > 0) {
        const matchingOutput = nodeType.outputs.find(
          (output) => output === insertionContext.sourceOutput
        )
        newNodeOutput = matchingOutput || nodeType.outputs[0]
      }

      const serviceConnection: WorkflowConnection = {
        id: `${newNodeId}-${insertionContext.targetNodeId}-${Date.now()}`,
        sourceNodeId: newNodeId,
        sourceOutput: newNodeOutput,
        targetNodeId: insertionContext.targetNodeId!,
        targetInput: insertionContext.targetInput || 'main',
      }

      addConnection(serviceConnection)
    },
    []
  )

  const createRegularConnection = useCallback(
    (params: CreateConnectionParams) => {
      const {
        newNodeId,
        nodeType,
        insertionContext,
        sourceNodeIdForConnection,
        workflow,
        addConnection,
        removeConnection,
      } = params

      const effectiveSourceNodeId =
        insertionContext?.sourceNodeId || sourceNodeIdForConnection

      if (!effectiveSourceNodeId) return

      // Check if inserting between nodes
      const isInsertingBetweenNodes =
        insertionContext?.targetNodeId && insertionContext.targetNodeId !== ''

      if (isInsertingBetweenNodes && insertionContext) {
        // Remove existing connection between source and target
        const existingConnection = workflow?.connections.find(
          (conn: WorkflowConnection) =>
            conn.sourceNodeId === insertionContext.sourceNodeId &&
            conn.targetNodeId === insertionContext.targetNodeId &&
            (conn.sourceOutput === insertionContext.sourceOutput ||
              (!conn.sourceOutput && !insertionContext.sourceOutput)) &&
            (conn.targetInput === insertionContext.targetInput ||
              (!conn.targetInput && !insertionContext.targetInput))
        )

        if (existingConnection) {
          removeConnection(existingConnection.id)
        }
      }

      // Create connection from source node to new node
      const sourceConnection: WorkflowConnection = {
        id: `${effectiveSourceNodeId}-${newNodeId}-${Date.now()}`,
        sourceNodeId: effectiveSourceNodeId,
        sourceOutput: insertionContext?.sourceOutput || 'main',
        targetNodeId: newNodeId,
        targetInput: 'main',
      }

      addConnection(sourceConnection)

      // If inserting between nodes, wire new node to target
      if (isInsertingBetweenNodes && insertionContext?.targetNodeId) {
        let newNodeOutput = 'main'
        if (nodeType.outputs && nodeType.outputs.length > 0) {
          newNodeOutput = nodeType.outputs[0]
        }

        const targetConnection: WorkflowConnection = {
          id: `${newNodeId}-${insertionContext.targetNodeId}-${Date.now() + 1}`,
          sourceNodeId: newNodeId,
          sourceOutput: newNodeOutput,
          targetNodeId: insertionContext.targetNodeId,
          targetInput: insertionContext.targetInput || 'main',
        }

        addConnection(targetConnection)
      }
    },
    []
  )

  const createConnections = useCallback(
    (params: CreateConnectionParams) => {
      const { insertionContext, addConnection } = params

      // Check if this is a service input connection
      const isServiceInputConnection =
        insertionContext?.targetNodeId && !insertionContext?.sourceNodeId

      if (isServiceInputConnection && insertionContext) {
        createServiceInputConnection(
          params.newNodeId,
          params.nodeType,
          insertionContext,
          addConnection
        )
      } else {
        createRegularConnection(params)
      }
    },
    [createServiceInputConnection, createRegularConnection]
  )

  return { createConnections }
}
