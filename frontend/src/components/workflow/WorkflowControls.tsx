import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAddNodeDialogStore, useWorkflowStore } from '@/stores'
import { WorkflowNode } from '@/types'
import { canExecuteWorkflow } from '@/utils/workflowExecutionGuards'
import { useReactFlow, useStore } from '@xyflow/react'
import { Box, Maximize2, MessageSquare, Plus, Redo, Undo, ZoomIn, ZoomOut } from 'lucide-react'
import { ReactNode, useCallback, useState } from 'react'
import { WorkflowExecuteButton } from './WorkflowExecuteButton'

interface WorkflowControlsProps {
  className?: string
  showAddNode?: boolean
  showExecute?: boolean
  showUndoRedo?: boolean
}

export function WorkflowControls({ className, showAddNode = true, showExecute = true, showUndoRedo = true }: WorkflowControlsProps) {
  const { zoomIn, zoomOut, fitView, screenToFlowPosition, setNodes, getNodes, getNodesBounds } = useReactFlow()
  const { openDialog } = useAddNodeDialogStore()
  const { workflow, undo, redo, canUndo, canRedo, updateWorkflow, saveToHistory, setDirty } = useWorkflowStore()
  const [isSaving] = useState(false)

  // Get selected nodes count for the group button
  const selectedNodes = useStore((state) => {
    return state.nodes.filter(
      (node) =>
        node.selected && 
        !node.parentId && 
        !state.parentLookup.get(node.id) &&
        node.type !== 'group'
    )
  })
  const selectedNodeCount = selectedNodes.length

  const handleAddNode = () => {
    // Calculate center of viewport
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    
    // Open add node dialog at center
    openDialog(viewportCenter)
  }

  const handleAddGroup = () => {
    // Take snapshot for undo/redo
    saveToHistory('Add group node')
    
    // Calculate center of viewport
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    
    // Create group node with default size
    const groupId = `group_${Date.now()}`
    const groupNode = {
      id: groupId,
      type: 'group',
      position: {
        x: viewportCenter.x - 150, // Center the 300px wide group
        y: viewportCenter.y - 100, // Center the 200px tall group
      },
      style: {
        width: 300,
        height: 200,
      },
      data: {},
    }

    // Update React Flow nodes
    setNodes([...getNodes(), groupNode])
    
    // Sync to Zustand workflow store
    if (workflow) {
      const updatedWorkflowNodes = [
        ...workflow.nodes,
        {
          id: groupId,
          type: 'group',
          name: '',
          description: undefined,
          parameters: {},
          position: groupNode.position,
          disabled: false,
          style: groupNode.style as any,
        }
      ]
      
      updateWorkflow({ nodes: updatedWorkflowNodes })
    }
  }

  const handleGroupSelectedNodes = () => {
    if (selectedNodes.length < 1) return

    // Take snapshot for undo/redo
    saveToHistory('Group nodes')
    
    const groupId = `group_${Math.random() * 10000}`
    const selectedNodesRectangle = getNodesBounds(selectedNodes)
    const GROUP_PADDING = 25
    const groupNodePosition = {
      x: selectedNodesRectangle.x,
      y: selectedNodesRectangle.y,
    }

    // Create the group node
    const groupNode = {
      id: groupId,
      type: 'group',
      position: groupNodePosition,
      style: {
        width: selectedNodesRectangle.width + GROUP_PADDING * 2,
        height: selectedNodesRectangle.height + GROUP_PADDING * 2,
      },
      data: {},
    }

    const allNodes = getNodes()
    const selectedNodeIds = selectedNodes.map(n => n.id)
    
    const nextNodes = allNodes.map((node) => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          // Calculate relative position of the node inside the group
          position: {
            x: node.position.x - groupNodePosition.x + GROUP_PADDING,
            y: node.position.y - groupNodePosition.y + GROUP_PADDING,
          },
          extent: 'parent' as const,
          parentId: groupId,
          expandParent: true,
          selected: false, // Deselect after grouping
        }
      }
      return node
    })

    // Update React Flow nodes
    setNodes([groupNode, ...nextNodes])
    
    // Sync to Zustand workflow store
    if (workflow) {
      const allNodesUpdated = [groupNode, ...nextNodes]
      const existingNodesMap = new Map(workflow.nodes.map(n => [n.id, n]))
      
      const updatedWorkflowNodes: WorkflowNode[] = []
      
      allNodesUpdated.forEach((rfNode) => {
        const existingNode = existingNodesMap.get(rfNode.id)
        
        if (rfNode.type === 'group') {
          // Add the new group node
          updatedWorkflowNodes.push({
            id: rfNode.id,
            type: 'group',
            name: '',
            description: undefined,
            parameters: rfNode.data || {},
            position: rfNode.position,
            disabled: false,
            style: rfNode.style as any,
          })
        } else if (existingNode) {
          // Update existing node with parent relationship
          const anyRfNode = rfNode as any
          updatedWorkflowNodes.push({
            ...existingNode,
            position: rfNode.position,
            parentId: anyRfNode.parentId || undefined,
            extent: (anyRfNode.extent || undefined) as any,
          })
        }
      })
      
      updateWorkflow({ nodes: updatedWorkflowNodes })
      setDirty(true)
    }
  }

  const handleAddAnnotation = useCallback(() => {
    // Take snapshot for undo/redo
    saveToHistory('Add annotation')

    // Calculate center of viewport
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })

    // Create new annotation node ID
    const annotationId = `annotation_${Date.now()}`

    // Create React Flow node
    const newNode = {
      id: annotationId,
      type: 'annotation',
      position: viewportCenter,
      data: {
        label: 'Add your note here...',
      },
    }

    // Add to React Flow
    setNodes((nodes) => [...nodes, newNode])

    // Add to Zustand workflow store
    if (workflow) {
      const newWorkflowNode: WorkflowNode = {
        id: annotationId,
        type: 'annotation',
        name: 'Annotation',
        parameters: {
          label: 'Add your note here...',
        },
        position: viewportCenter,
        disabled: false,
      }

      updateWorkflow({
        nodes: [...workflow.nodes, newWorkflowNode],
      })
      setDirty(true)
    }
  }, [screenToFlowPosition, setNodes, workflow, updateWorkflow, setDirty, saveToHistory])

  const handleExecuteWorkflow = async (triggerNodeId?: string) => {
    if (!workflow) return
    
    // Check if workflow can be executed (must be saved first)
    if (!canExecuteWorkflow()) {
      return
    }
    
    try {
      // Execute the workflow using the workflow store's executeNode method
      const { executeNode } = useWorkflowStore.getState()
      await executeNode(triggerNodeId || workflow.nodes.find(n => 
        n.type.includes('trigger') || 
        ['manual-trigger', 'webhook-trigger', 'schedule-trigger', 'workflow-called'].includes(n.type)
      )?.id || '', undefined, 'workflow')
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  return (
    <div
      className={cn(
        'absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-card px-1.5 py-1.5 shadow-lg',
        className
      )}
    >
      {/* Execute Button */}
      {showExecute && (
        <>
          <WorkflowExecuteButton 
            onExecute={handleExecuteWorkflow}
            disabled={isSaving}
          />
          <div className="mx-1 h-6 w-px bg-border" />
        </>
      )}

      {/* Add Node */}
      {showAddNode && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleAddNode}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label="Add Node"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Add Node</p>
            </TooltipContent>
          </Tooltip>

          {/* Group Selected Nodes / Add Group */}
          {selectedNodeCount >= 2 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleGroupSelectedNodes}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Group ${selectedNodeCount} selected nodes`}
                >
                  <Box className="h-4 w-4" />
                  <span className="text-xs font-medium">{selectedNodeCount}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Group {selectedNodeCount} selected nodes</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAddGroup}
                  disabled={true}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Add Group (Select at least 2 nodes)"
                >
                  <Box className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Select at least 2 nodes to group</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Add Annotation */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleAddAnnotation}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label="Add Annotation"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Add Annotation</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Divider */}
      {showAddNode && (
        <div className="mx-1 h-6 w-px bg-border" />
      )}

      {/* Zoom Out */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => zoomOut()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Zoom Out</p>
        </TooltipContent>
      </Tooltip>

      {/* Zoom In */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => zoomIn()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Zoom In</p>
        </TooltipContent>
      </Tooltip>

      {/* Fit View */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => fitView({ padding: 0.1 })}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label="Fit View"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Fit View</p>
        </TooltipContent>
      </Tooltip>

      {/* Undo/Redo */}
      {showUndoRedo && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          
          {/* Undo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label="Undo"
              >
                <Undo className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>

          {/* Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label="Redo"
              >
                <Redo className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Redo (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  )
}

// Individual control button component for consistency
interface ControlButtonProps {
  onClick: () => void
  title: string
  icon: ReactNode
  className?: string
}

export function WorkflowControlButton({ onClick, title, icon, className }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  )
}
