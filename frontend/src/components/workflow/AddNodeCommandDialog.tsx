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
import { useTemplateExpansion } from '@/hooks/workflow'
import { useAddNodeDialogStore, useNodeTypes, useWorkflowStore } from '@/stores'
import { NodeType, WorkflowConnection, WorkflowNode } from '@/types'
import { fuzzyFilter } from '@/utils/fuzzySearch'
import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  const { addNode, addConnection, removeConnection, workflow, updateNode } = useWorkflowStore()
  const { insertionContext } = useAddNodeDialogStore()
  const reactFlowInstance = useReactFlow()
  const { isTemplateNode, handleTemplateExpansion } = useTemplateExpansion()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Get only active node types from the store
  const { activeNodeTypes, fetchNodeTypes, refetchNodeTypes, isLoading, hasFetched } = useNodeTypes()

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
    }
  }, [open])

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150) // Small delay for debouncing

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Memoize the getter function to avoid creating new arrays on every render
  const nodeSearchGetter = useCallback((node: NodeType) => [
    node.displayName,
    node.description,
    node.type,
    ...node.group
  ], [])

  // Filter nodes by service type if connecting to service inputs
  const serviceFilteredNodes = useMemo(() => {
    const targetInput = insertionContext?.targetInput
    
    // If connecting to a service input, filter by output type
    if (targetInput === 'model') {
      // Only show nodes with 'model' output
      return activeNodeTypes.filter(node => node.outputs.includes('model'))
    } else if (targetInput === 'memory') {
      // Only show nodes with 'memory' output
      return activeNodeTypes.filter(node => node.outputs.includes('memory'))
    } else if (targetInput === 'tools') {
      // Only show nodes with 'tool' output
      return activeNodeTypes.filter(node => node.outputs.includes('tool'))
    }
    
    // No service filter, return all nodes
    return activeNodeTypes
  }, [activeNodeTypes, insertionContext?.targetInput])

  // Filter nodes using fuzzy search when there's a search query
  const filteredNodeTypes = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return serviceFilteredNodes
    }

    // Use fuzzy search to filter and sort nodes
    return fuzzyFilter(
      serviceFilteredNodes,
      debouncedSearchQuery,
      nodeSearchGetter
    )
  }, [serviceFilteredNodes, debouncedSearchQuery, nodeSearchGetter])

  // Group nodes by category - only filtered nodes will be shown
  const groupedNodes = useMemo(() => {
    const hasSearch = debouncedSearchQuery.trim().length > 0
    const groups = new Map<string, NodeType[]>()

    filteredNodeTypes.forEach(node => {
      node.group.forEach(group => {
        if (!groups.has(group)) {
          groups.set(group, [])
        }
        groups.get(group)!.push(node)
      })
    })

    // Sort groups alphabetically
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    // When searching, fuzzy filter already sorted by relevance - don't re-sort
    // When not searching, sort nodes alphabetically within groups
    return sortedGroups.map(([groupName, nodes]) => ({
      name: groupName,
      nodes: hasSearch ? nodes : nodes.sort((a, b) => a.displayName.localeCompare(b.displayName))
    }))
  }, [filteredNodeTypes, debouncedSearchQuery])

  // Helper function to check if a position overlaps with existing nodes
  const findNonOverlappingPosition = useCallback((
    initialPosition: { x: number; y: number },
    nodeWidth = 200,
    nodeHeight = 100,
    parentId?: string
  ) => {
    const allNodes = reactFlowInstance?.getNodes() || []
    const padding = 20

    // Filter nodes to check - only nodes in the same parent (or no parent)
    const nodesToCheck = allNodes.filter(n =>
      n.type !== 'group' && n.parentId === parentId
    )

    const isOverlapping = (pos: { x: number; y: number }) => {
      return nodesToCheck.some(node => {
        const nodeW = (node.width || 200) + padding
        const nodeH = (node.height || 100) + padding

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
      // Try right
      const rightPos = { x: initialPosition.x + (radius * step), y: initialPosition.y }
      if (!isOverlapping(rightPos)) return rightPos

      // Try down
      const downPos = { x: initialPosition.x, y: initialPosition.y + (radius * step) }
      if (!isOverlapping(downPos)) return downPos

      // Try down-right diagonal
      const diagPos = { x: initialPosition.x + (radius * step), y: initialPosition.y + (radius * step) }
      if (!isOverlapping(diagPos)) return diagPos

      // Try up
      const upPos = { x: initialPosition.x, y: initialPosition.y - (radius * step) }
      if (!isOverlapping(upPos)) return upPos
    }

    // Fallback to initial position if no free space found
    return initialPosition
  }, [reactFlowInstance])

  const handleSelectNode = useCallback((nodeType: NodeType) => {
    if (!reactFlowInstance) return

    // Check if this is a template node
    if (isTemplateNode(nodeType)) {
      // Calculate position where to add the template
      let templatePosition = { x: 300, y: 300 }

      if (position) {
        templatePosition = position
      } else {
        // Get center of viewport as fallback
        const viewportCenter = reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
        templatePosition = viewportCenter
      }

      // Handle template expansion (with or without variables)
      handleTemplateExpansion(nodeType, templatePosition, () => {
        onOpenChange(false)
      })
      return
    }

    // Regular node (not a template) - continue with normal flow
    // Calculate position where to add the node
    let nodePosition = { x: 300, y: 300 }
    let parentGroupId: string | undefined = undefined
    let sourceNodeIdForConnection: string | undefined = undefined

    if (insertionContext) {
      // Check if this is a service input connection (clicking on model/memory/tools input)
      const isServiceInputConnection = insertionContext.targetNodeId && !insertionContext.sourceNodeId
      
      if (isServiceInputConnection) {
        // Service input connection - position new node below the target node
        const targetNode = reactFlowInstance.getNode(insertionContext.targetNodeId)
        
        if (targetNode && targetNode.parentId) {
          // Check if target node is in a group
          parentGroupId = targetNode.parentId
        }

        if (targetNode) {
          const targetHeight = targetNode.height || 100
          const gap = 80

          // Initial position: below the target node
          const initialPosition = {
            x: targetNode.position.x,
            y: targetNode.position.y + targetHeight + gap
          }

          // Find non-overlapping position
          nodePosition = findNonOverlappingPosition(initialPosition, 200, 100, parentGroupId)
        }
      } else if (insertionContext.sourceNodeId && !insertionContext.targetNodeId) {
        // Connection was dropped on canvas - position to the right of source node
        const sourceNode = reactFlowInstance.getNode(insertionContext.sourceNodeId)
        sourceNodeIdForConnection = insertionContext.sourceNodeId

        if (sourceNode && sourceNode.parentId) {
          // Check if source node is in a group
          parentGroupId = sourceNode.parentId
        }

        if (sourceNode) {
          const sourceWidth = sourceNode.width || 200
          const gap = 100

          // Initial position: to the right of source node
          const initialPosition = {
            x: sourceNode.position.x + sourceWidth + gap,
            y: sourceNode.position.y
          }

          // Find non-overlapping position
          nodePosition = findNonOverlappingPosition(initialPosition, 200, 100, parentGroupId)
        }
      } else if (insertionContext.targetNodeId) {
        // Inserting between nodes
        const sourceNode = reactFlowInstance.getNode(insertionContext.sourceNodeId)
        const targetNode = reactFlowInstance.getNode(insertionContext.targetNodeId)

        if (sourceNode && targetNode) {
          // Check if source node is in a group
          if (sourceNode.parentId) {
            parentGroupId = sourceNode.parentId
          }

          const sourceWidth = sourceNode.width || 200
          const targetWidth = targetNode.width || 200
          const newNodeWidth = 200
          const gap = 80

          // Calculate the vector from source to target
          const deltaX = targetNode.position.x - sourceNode.position.x
          const deltaY = targetNode.position.y - sourceNode.position.y
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

          // Calculate direction vector (normalized)
          const directionX = deltaX / distance
          const directionY = deltaY / distance

          // Calculate minimum distance needed for all three nodes
          const minDistanceNeeded = sourceWidth + gap + newNodeWidth + gap

          // Position new node between source and target
          if (distance >= minDistanceNeeded + targetWidth) {
            // Enough space - place in the middle
            const distanceFromSource = sourceWidth + gap
            nodePosition = {
              x: sourceNode.position.x + directionX * distanceFromSource,
              y: sourceNode.position.y + directionY * distanceFromSource
            }
          } else {
            // Not enough space - shift target and downstream nodes
            const additionalSpace = minDistanceNeeded - distance + targetWidth
            const shiftX = directionX * additionalSpace
            const shiftY = directionY * additionalSpace

            // Helper function to recursively shift nodes
            const shiftNodeAndDownstream = (nodeId: string, visited = new Set<string>()) => {
              if (visited.has(nodeId)) return
              visited.add(nodeId)

              const node = reactFlowInstance.getNode(nodeId)
              if (!node) return

              // Shift this node
              updateNode(nodeId, {
                position: {
                  x: node.position.x + shiftX,
                  y: node.position.y + shiftY
                }
              })

              // Find all connections where this node is the source and shift their targets
              workflow?.connections.forEach(conn => {
                if (conn.sourceNodeId === nodeId) {
                  shiftNodeAndDownstream(conn.targetNodeId, visited)
                }
              })
            }

            // Start shifting from the target node
            shiftNodeAndDownstream(insertionContext.targetNodeId)

            // Now position the new node
            const distanceFromSource = sourceWidth + gap
            nodePosition = {
              x: sourceNode.position.x + directionX * distanceFromSource,
              y: sourceNode.position.y + directionY * distanceFromSource
            }
          }
        } else if (sourceNode) {
          // Fallback: position to the right of source node
          const sourceWidth = sourceNode.width || 200
          const initialPosition = {
            x: sourceNode.position.x + sourceWidth + 100,
            y: sourceNode.position.y
          }
          nodePosition = findNonOverlappingPosition(initialPosition, 200, 100, sourceNode.parentId)
        }
      }
    } else {
      // No insertion context - check if there's a selected node to connect from
      const selectedNodes = reactFlowInstance.getNodes().filter(node => node.selected)

      if (selectedNodes.length === 1) {
        // Single node selected - position new node to the right and connect
        const selectedNode = selectedNodes[0]
        sourceNodeIdForConnection = selectedNode.id

        // Check if selected node is in a group
        if (selectedNode.parentId) {
          parentGroupId = selectedNode.parentId
        }

        // Position to the right of the selected node with overlap detection
        const selectedWidth = selectedNode.width || 200
        const gap = 100
        const initialPosition = {
          x: selectedNode.position.x + selectedWidth + gap,
          y: selectedNode.position.y
        }
        nodePosition = findNonOverlappingPosition(initialPosition, 200, 100, parentGroupId)
      } else if (position) {
        // Position provided (e.g., from keyboard shortcut or viewport center)
        // Check for overlaps and adjust if needed
        nodePosition = findNonOverlappingPosition(position, 200, 100)
      } else {
        // Get center of viewport as fallback
        const viewportCenter = reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
        nodePosition = findNonOverlappingPosition(viewportCenter, 200, 100)
      }
    }

    // Initialize parameters with defaults from node type
    const parameters: Record<string, any> = { ...nodeType.defaults }

    // Add default values from properties
    nodeType.properties.forEach((property) => {
      if (
        property.default !== undefined &&
        parameters[property.name] === undefined
      ) {
        parameters[property.name] = property.default
      }
    })

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: nodeType.type,
      name: nodeType.displayName,
      parameters,
      position: nodePosition,
      credentials: [],
      disabled: false,
      // Add icon and color from node type definition
      icon: nodeType.icon,
      color: nodeType.color,
      // If source node is in a group, add new node to the same group
      ...(parentGroupId && {
        parentId: parentGroupId,
        extent: 'parent' as const
      }),
    }

    // Add the node first
    addNode(newNode)

    // Create connection based on insertion context
    // Check if this is a service input connection (new node as SOURCE → target node as TARGET)
    const isServiceInputConnection = insertionContext?.targetNodeId && !insertionContext?.sourceNodeId

    if (isServiceInputConnection && insertionContext) {
      // Service input connection: new node provides service to target node
      // Example: Memory node (new) → AI Agent (target)
      
      // Determine the output handle for the new node
      // Use the sourceOutput from context (which indicates the service type: model, memory, tool)
      let newNodeOutput = insertionContext.sourceOutput || 'main'
      
      // If the node type has specific outputs, use the first matching one
      if (nodeType.outputs && nodeType.outputs.length > 0) {
        // Try to find an output that matches the service type
        const matchingOutput = nodeType.outputs.find(output => 
          output === insertionContext.sourceOutput
        )
        if (matchingOutput) {
          newNodeOutput = matchingOutput
        } else {
          // Use first available output
          newNodeOutput = nodeType.outputs[0]
        }
      }

      const serviceConnection: WorkflowConnection = {
        id: `${newNode.id}-${insertionContext.targetNodeId}-${Date.now()}`,
        sourceNodeId: newNode.id,
        sourceOutput: newNodeOutput,
        targetNodeId: insertionContext.targetNodeId,
        targetInput: insertionContext.targetInput || 'main',
      }

      addConnection(serviceConnection)
    } else {
      // Regular connection: source node → new node
      const effectiveSourceNodeId = insertionContext?.sourceNodeId || sourceNodeIdForConnection

      if (effectiveSourceNodeId) {
        // Check if this is inserting between nodes (only possible with insertionContext)
        const isInsertingBetweenNodes = insertionContext?.targetNodeId && insertionContext.targetNodeId !== ''

        if (isInsertingBetweenNodes && insertionContext) {
          // First, find and remove the existing connection between source and target
          const existingConnection = workflow?.connections.find(
            conn =>
              conn.sourceNodeId === insertionContext.sourceNodeId &&
              conn.targetNodeId === insertionContext.targetNodeId &&
              (conn.sourceOutput === insertionContext.sourceOutput || (!conn.sourceOutput && !insertionContext.sourceOutput)) &&
              (conn.targetInput === insertionContext.targetInput || (!conn.targetInput && !insertionContext.targetInput))
          )

          if (existingConnection) {
            removeConnection(existingConnection.id)
          }
        }

        // Create connection from source node to new node
        const sourceConnection: WorkflowConnection = {
          id: `${effectiveSourceNodeId}-${newNode.id}-${Date.now()}`,
          sourceNodeId: effectiveSourceNodeId,
          sourceOutput: insertionContext?.sourceOutput || 'main',
          targetNodeId: newNode.id,
          targetInput: 'main',
        }

        addConnection(sourceConnection)

        // If there's a target node specified (inserting between nodes), wire the new node to it
        if (isInsertingBetweenNodes && insertionContext?.targetNodeId) {
          // Determine the appropriate output handle for the new node
          // Use the first available output from the node type, or 'main' as fallback
          let newNodeOutput = 'main'
          if (nodeType.outputs && nodeType.outputs.length > 0) {
            newNodeOutput = nodeType.outputs[0] // outputs is string[], not object[]
          }

          const targetConnection: WorkflowConnection = {
            id: `${newNode.id}-${insertionContext.targetNodeId}-${Date.now() + 1}`,
            sourceNodeId: newNode.id,
            sourceOutput: newNodeOutput,
            targetNodeId: insertionContext.targetNodeId,
            targetInput: insertionContext.targetInput || 'main',
          }

          addConnection(targetConnection)
        }
      }
    }

    // Auto-select the newly added node
    // First, deselect all existing nodes
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === newNode.id, // Only select the new node
      }))
    )

    onOpenChange(false)
  }, [addNode, addConnection, removeConnection, updateNode, workflow, onOpenChange, position, reactFlowInstance, insertionContext, findNonOverlappingPosition, isTemplateNode, handleTemplateExpansion])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search nodes..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No nodes found.</CommandEmpty>
        {(() => {
          // Track which nodes have already been rendered to avoid duplicates
          const renderedNodeTypes = new Set<string>()

          return groupedNodes.map((group, index) => (
            <div key={group.name}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup>
                {group.nodes.map((node) => {
                  // Skip if this node has already been rendered in a previous group
                  if (renderedNodeTypes.has(node.type)) {
                    return null
                  }
                  renderedNodeTypes.add(node.type)

                  return (
                    <CommandItem
                      key={node.type}
                      value={`${node.displayName} ${node.description} ${node.group.join(' ')}`}
                      onSelect={() => handleSelectNode(node)}
                      className="flex items-center gap-3 p-3"
                    >
                      <NodeIconRenderer
                        icon={node.icon}
                        nodeType={node.type}
                        nodeGroup={node.group}
                        displayName={node.displayName}
                        backgroundColor={node.color || '#6b7280'}
                        isTrigger={node.group.includes('trigger')}
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
