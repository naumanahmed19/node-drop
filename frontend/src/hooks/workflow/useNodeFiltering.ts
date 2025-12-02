import { useMemo, useCallback } from 'react'
import { NodeType } from '@/types'
import { fuzzyFilter } from '@/utils/fuzzySearch'

interface NodeInsertionContext {
  sourceNodeId: string
  targetNodeId: string
  sourceOutput?: string
  targetInput?: string
}

interface UseNodeFilteringParams {
  activeNodeTypes: NodeType[]
  insertionContext?: NodeInsertionContext
  searchQuery: string
  groupFilter?: string | null
}

export function useNodeFiltering({
  activeNodeTypes,
  insertionContext,
  searchQuery,
  groupFilter,
}: UseNodeFilteringParams) {
  // Memoize the getter function for fuzzy search
  const nodeSearchGetter = useCallback(
    (node: NodeType) => [
      node.displayName,
      node.description,
      node.identifier,
      ...node.group,
    ],
    []
  )

  // Filter nodes by service type if connecting to service inputs
  const serviceFilteredNodes = useMemo(() => {
    const targetInput = insertionContext?.targetInput

    // If connecting to a service input, filter by output type
    if (targetInput && targetInput.endsWith('Service')) {
      return activeNodeTypes.filter((node) => node.outputs.includes(targetInput))
    }

    // No service filter, return all nodes
    return activeNodeTypes
  }, [activeNodeTypes, insertionContext?.targetInput])

  // Get all available groups for display
  const availableGroups = useMemo(() => {
    const groups = new Set<string>()
    serviceFilteredNodes.forEach((node) => {
      node.group.forEach((group) => groups.add(group))
    })
    return Array.from(groups).sort()
  }, [serviceFilteredNodes])

  // Filter nodes by group if group filter is active
  const groupFilteredNodes = useMemo(() => {
    if (!groupFilter) {
      return serviceFilteredNodes
    }

    // Case-insensitive partial match for group names
    const filterLower = groupFilter.toLowerCase()
    const filtered = serviceFilteredNodes.filter((node) =>
      node.group.some((group) => group.toLowerCase().includes(filterLower))
    )
    
    return filtered
  }, [serviceFilteredNodes, groupFilter])

  // Filter nodes using fuzzy search when there's a search query
  const filteredNodeTypes = useMemo(() => {
    // If we have a group filter (starts with /), don't apply text search
    if (groupFilter) {
      return groupFilteredNodes
    }

    if (!searchQuery.trim()) {
      return groupFilteredNodes
    }

    return fuzzyFilter(groupFilteredNodes, searchQuery, nodeSearchGetter)
  }, [groupFilteredNodes, searchQuery, nodeSearchGetter, groupFilter])

  // Group nodes by category
  const groupedNodes = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0
    const groups = new Map<string, NodeType[]>()

    filteredNodeTypes.forEach((node) => {
      // If we have a group filter, only show nodes under matching groups
      if (groupFilter) {
        const matchingGroups = node.group.filter((group) =>
          group.toLowerCase().includes(groupFilter.toLowerCase())
        )
        matchingGroups.forEach((group) => {
          if (!groups.has(group)) {
            groups.set(group, [])
          }
          groups.get(group)!.push(node)
        })
      } else {
        // No filter, show all groups
        node.group.forEach((group) => {
          if (!groups.has(group)) {
            groups.set(group, [])
          }
          groups.get(group)!.push(node)
        })
      }
    })

    // Sort groups alphabetically
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    )

    // When searching, fuzzy filter already sorted by relevance
    // When not searching, sort nodes alphabetically within groups
    return sortedGroups.map(([groupName, nodes]) => ({
      name: groupName,
      nodes: hasSearch
        ? nodes
        : nodes.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
  }, [filteredNodeTypes, searchQuery, groupFilter])

  return {
    filteredNodeTypes,
    groupedNodes,
    availableGroups,
  }
}
