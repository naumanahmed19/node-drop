import {
  NodeProps,
  NodeResizer,
  NodeToolbar,
  useReactFlow,
} from '@xyflow/react'
import { Edit, Trash2, Ungroup } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useDetachNodes, useDeleteNodes } from '@/hooks/workflow'
import { useWorkflowStore } from '@/stores'
import { GroupEditDialog } from '../GroupEditDialog'

function GroupNode({ id, data }: NodeProps) {
  const detachNodes = useDetachNodes()
  const deleteNodes = useDeleteNodes()
  const { getNodes } = useReactFlow()
  const { workflow } = useWorkflowStore()
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Get the group node data from workflow store
  const workflowNode = workflow?.nodes.find(n => n.id === id)
  const groupName: string = workflowNode?.name || (data?.label as string) || ''
  const groupDescription: string | undefined = workflowNode?.description

  // Check if this group has child nodes
  const childNodes = getNodes().filter((node) => node.parentId === id)
  const hasChildNodes = childNodes.length > 0

  const onEdit = useCallback(() => {
    setShowEditDialog(true)
  }, [])

  const onDoubleClick = useCallback(() => {
    setShowEditDialog(true)
  }, [])

  const onDetach = useCallback(() => {
    const childNodeIds = childNodes.map((node) => node.id)
    detachNodes(childNodeIds, id)
  }, [childNodes, detachNodes, id])

  const onDeleteGroup = useCallback(() => {
    // Use shared delete handler for consistency
    deleteNodes([id])
  }, [id, deleteNodes])

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group-node" onDoubleClick={onDoubleClick}>
            <NodeResizer />
            
            {/* Group Label - only show if name is not empty */}
            {groupName && (
              <div className="group-node-label-container">
                <div className="group-node-label">
                  {groupName}
                </div>
                {groupDescription && (
                  <div className="group-node-description">
                    {groupDescription}
                  </div>
                )}
              </div>
            )}
            
            {hasChildNodes && (
              <NodeToolbar className="nodrag">
                <button className="group-node-button" onClick={onDetach}>
                  Ungroup
                </button>
              </NodeToolbar>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={onEdit}
            className="cursor-pointer"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Group
          </ContextMenuItem>
          {hasChildNodes && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={onDetach}
                className="cursor-pointer"
              >
                <Ungroup className="mr-2 h-4 w-4" />
                Ungroup
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onDeleteGroup}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Group
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      <GroupEditDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        groupId={id}
      />
    </>
  )
}

export default memo(GroupNode)
