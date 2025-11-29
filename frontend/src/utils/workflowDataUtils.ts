import type { Workflow, NodeExecutionResult } from '@/types'

/**
 * Build mock data from connected workflow nodes for expression evaluation
 * Extracts execution results from nodes connected to the current node
 * Also includes workflow, execution context, and variables information
 */
export async function buildMockDataFromWorkflow(
  nodeId: string | undefined,
  workflow?: Workflow,
  executionId?: string,
  getNodeExecutionResult?: (nodeId: string) => NodeExecutionResult | undefined,
  variables?: Record<string, string>
): Promise<Record<string, unknown>> {
  const mockData: Record<string, unknown> = {
    $json: {},
    $workflow: {
      id: 'workflow-id',
      name: 'Workflow Name',
      active: true,
    },
    $execution: {
      id: executionId || 'execution-id',
      mode: 'manual',
    },
    $vars: variables || {},
  }

  if (!nodeId || !workflow) return mockData

  try {
    // Update workflow info with actual data
    if (workflow.id) {
      mockData.$workflow = {
        id: workflow.id,
        name: workflow.name || 'Workflow',
        active: workflow.active !== false,
      }
    }

    // Find all connections where the current node is the target
    const inputConnections = workflow.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    )

    if (inputConnections.length === 0) return mockData

    // If multiple inputs, create an array structure
    if (inputConnections.length > 1) {
      mockData.$json = []
    }

    // Process each connected source node
    if (getNodeExecutionResult) {
      inputConnections.forEach((connection, connectionIndex) => {
        const sourceNodeId = connection.sourceNodeId
        const sourceNode = workflow.nodes.find(n => n.id === sourceNodeId)
        if (!sourceNode) return

        // Get execution result for this source node
        const sourceNodeResult = getNodeExecutionResult(sourceNodeId)
        if (!sourceNodeResult?.data) return

        // Extract data structure
        let sourceData: any[] = []
        if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
          sourceData = sourceNodeResult.data.main
        }

        if (sourceData.length === 0) return

        // Get the data - could be array or object
        let itemData = sourceData[0]?.json || sourceData[0]
        if (!itemData) return

        if (inputConnections.length > 1) {
          // For multiple inputs, preserve the full structure (array or object)
          (mockData.$json as any[])[connectionIndex] = itemData
        } else {
          // For single input with array data, store the array
          if (Array.isArray(itemData)) {
            mockData.$json = itemData
          } else if (typeof itemData === 'object') {
            // For single input with object data, merge into $json
            Object.assign(mockData.$json as Record<string, unknown>, itemData as Record<string, unknown>)
          }
        }
      })
    }
  } catch (error) {
    console.error('Error building mock data:', error)
  }

  return mockData
}
