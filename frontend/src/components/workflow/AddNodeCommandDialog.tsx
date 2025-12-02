import { NodeIconRenderer } from '@/components/common/NodeIconRenderer'
import { Badge } from '@/components/ui/badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import {
  useTemplateExpansion,
  useNodePositioning,
  useNodeConnection,
  useNodeFiltering
} from '@/hooks/workflow'
import { useAddNodeDialogStore, useNodeTypes, useWorkflowStore } from '@/stores'
import { NodeType } from '@/types'
import { createWorkflowNode } from '@/utils/nodeCreation'
import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'

interface AddNodeCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  position?: { x: number; y: number }
}

export function AddNodeCommandDialog({
  open,
  onOpenChange,
  position,
}: AddNodeCommandDialogProps) {
  const { addNode, addConnection, removeConnection, workflow, updateNode } =
    useWorkflowStore()
  const { insertionContext } = useAddNodeDialogStore()
  const reactFlowInstance = useReactFlow()
  const { isTemplateNode, handleTemplateExpansion } = useTemplateExpansion()
  const { calculateNodePosition } = useNodePositioning()
  const { createConnections } = useNodeConnection()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null)

  // Get only active node types from the store
  const { activeNodeTypes, fetchNodeTypes, refetchNodeTypes, isLoading, hasFetched } =
    useNodeTypes()

  // Initialize store if needed
  useEffect(() => {
    if (activeNodeTypes.length === 0 && !isLoading && !hasFetched) {
      fetchNodeTypes()
    }
  }, [activeNodeTypes.length, isLoading, hasFetched, fetchNodeTypes])

  // Refresh node types when dialog opens to ensure we have the latest nodes
  useEffect(() => {
    if (open && hasFetched) {
      // Silently refresh to get any newly uploaded nodes
      refetchNodeTypes()
    }
  }, [open, hasFetched, refetchNodeTypes])

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setDebouncedSearchQuery('')
      setActiveGroupFilter(null)
    }
  }, [open])

  // Handle shortcut filters (e.g., /tools, /models)
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase()
    if (query.startsWith('/')) {
      const filterGroup = query.slice(1)
      setActiveGroupFilter(filterGroup || null)
    } else {
      setActiveGroupFilter(null)
    }
  }, [searchQuery])

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Use custom hook for node filtering and grouping
  // When using group filter, pass empty search query to avoid interference
  const { groupedNodes, availableGroups } = useNodeFiltering({
    activeNodeTypes,
    insertionContext,
    searchQuery: activeGroupFilter ? '' : debouncedSearchQuery,
    groupFilter: activeGroupFilter,
  })

  const handleSelectNode = useCallback(
    (nodeType: NodeType) => {
      if (!reactFlowInstance) return

      // Handle template nodes
      if (isTemplateNode(nodeType)) {
        const templatePosition =
          position ||
          reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          })

        handleTemplateExpansion(nodeType, templatePosition, () => {
          onOpenChange(false)
        })
        return
      }

      // Calculate node position using custom hook
      const { nodePosition, parentGroupId, sourceNodeIdForConnection } =
        calculateNodePosition(
          { insertionContext, position },
          updateNode,
          workflow
        )

      // Create the new node
      const newNode = createWorkflowNode(nodeType, nodePosition, parentGroupId)

      // Add the node
      addNode(newNode)

      // Create connections using custom hook
      createConnections({
        newNodeId: newNode.id,
        nodeType,
        insertionContext,
        sourceNodeIdForConnection,
        workflow,
        addConnection,
        removeConnection,
      })

      // Auto-select the newly added node
      reactFlowInstance.setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: node.id === newNode.id,
        }))
      )

      onOpenChange(false)
    },
    [
      reactFlowInstance,
      isTemplateNode,
      handleTemplateExpansion,
      position,
      insertionContext,
      calculateNodePosition,
      updateNode,
      workflow,
      addNode,
      createConnections,
      addConnection,
      removeConnection,
      onOpenChange,
    ]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder={
          activeGroupFilter
            ? `Filtering by: ${activeGroupFilter} (clear to reset)`
            : 'Search nodes... (try /tools, /models, etc.)'
        }
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {activeGroupFilter ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">
                No nodes found for "/{activeGroupFilter}"
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Did you mean one of these?
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {availableGroups
                  .filter((group) => 
                    group.toLowerCase().includes(activeGroupFilter.toLowerCase()) ||
                    activeGroupFilter.toLowerCase().includes(group.toLowerCase())
                  )
                  .slice(0, 10)
                  .map((group) => (
                    <Badge
                      key={group}
                      variant="default"
                      className="text-xs cursor-pointer hover:bg-primary/80"
                      onClick={() => setSearchQuery(`/${group.toLowerCase()}`)}
                    >
                      /{group.toLowerCase()}
                    </Badge>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 mb-2">
                All available groups:
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {availableGroups.map((group) => (
                  <Badge
                    key={group}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent"
                    onClick={() => setSearchQuery(`/${group.toLowerCase()}`)}
                  >
                    /{group.toLowerCase()}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">No nodes found.</p>
              <p className="text-xs text-muted-foreground mb-3">
                Filter by group using / prefix:
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {availableGroups.map((group) => (
                  <Badge
                    key={group}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent"
                    onClick={() => setSearchQuery(`/${group.toLowerCase()}`)}
                  >
                    /{group.toLowerCase()}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CommandEmpty>
        {searchQuery === '/' && availableGroups.length > 0 && (
          <div className="p-4 border-b">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              Quick Filters - Select a group:
            </p>
            <div className="flex flex-wrap gap-2">
              {availableGroups.map((group) => (
                <Badge
                  key={group}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setSearchQuery(`/${group.toLowerCase()}`)}
                >
                  {group}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {(() => {
          // Track which nodes have already been rendered to avoid duplicates
          const renderedNodeTypes = new Set<string>()

          return groupedNodes.map((group, index) => (
            <div key={group.name}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={activeGroupFilter ? `${group.name} (filtered)` : undefined}>
                {group.nodes.map((node) => {
                  // Skip if this node has already been rendered in a previous group
                  if (renderedNodeTypes.has(node.identifier)) {
                    return null
                  }
                  renderedNodeTypes.add(node.identifier)

                  return (
                    <CommandItem
                      key={node.identifier}
                      value={node.identifier}
                      onSelect={() => handleSelectNode(node)}
                      className="flex items-center gap-3 p-3"
                    >
                      <NodeIconRenderer
                        icon={node.icon}
                        nodeType={node.identifier}
                        nodeGroup={node.group}
                        displayName={node.displayName}
                        backgroundColor={node.color || '#6b7280'}
                        isTrigger={node.nodeCategory === 'trigger'}
                        size="md"
                        className="flex-shrink-0 shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {node.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {node.description}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {node.group.slice(0, 2).map((g) => (
                          <Badge
                            key={g}
                            variant="secondary"
                            className="text-xs h-5"
                          >
                            {g}
                          </Badge>
                        ))}
                        {node.group.length > 2 && (
                          <Badge variant="outline" className="text-xs h-5">
                            +{node.group.length - 2}
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </div>
          ))
        })()}
      </CommandList>
    </CommandDialog>
  )
}
