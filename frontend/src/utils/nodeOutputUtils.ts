/**
 * Utility functions for extracting and processing node output data
 */

/**
 * Extracts meaningful data from node execution results
 * Handles different data structures from the backend
 */
export function extractNodeOutputData(nodeExecutionResult: any): any {
  try {
    // Handle the new standardized format from backend
    if (nodeExecutionResult?.data?.main || nodeExecutionResult?.data?.branches) {
      const { main, branches, metadata } = nodeExecutionResult.data

      // For branching nodes (like IF), return the branches structure
      if (metadata?.hasMultipleBranches && branches) {
        return {
          type: 'branches',
          branches: branches,
          metadata: metadata,
        }
      }

      // For regular nodes, extract the JSON data from main
      if (main && main.length > 0) {
        // If main contains objects with 'json' property, extract that
        if (main[0]?.json) {
          // If there are multiple items, return array of unwrapped json
          if (main.length > 1) {
            return main.map((item: any) => item.json)
          }
          // Single item: return just the json content
          return main[0].json
        }
        // Otherwise return the main array directly
        return main.length > 1 ? main : main[0]
      }
    }

    // Fallback for legacy format handling
    if (nodeExecutionResult?.data?.[0]?.main?.[0]?.json) {
      return nodeExecutionResult.data[0].main[0].json
    }

    if (Array.isArray(nodeExecutionResult?.data) && nodeExecutionResult.data.length > 0) {
      return nodeExecutionResult.data[0]
    }

    if (nodeExecutionResult?.data && typeof nodeExecutionResult.data === 'object') {
      return nodeExecutionResult.data
    }

    return null
  } catch (error) {
    console.warn('Failed to extract node output data:', error)
    return null
  }
}

/**
 * Check if output data represents a branching node result
 */
export function isBranchingOutput(data: any): boolean {
  return data?.type === 'branches'
}

/**
 * Check if data contains downloadable content
 */
export function hasDownloadableContent(data: any): boolean {
  if (!data || isBranchingOutput(data)) return false
  return !!(data?.content && data?.contentType)
}
