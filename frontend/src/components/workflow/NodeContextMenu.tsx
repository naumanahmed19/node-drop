import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Copy, Play, Settings, Trash2 } from 'lucide-react';
import React from 'react';

interface NodeContextMenuProps {
  children: React.ReactNode
  nodeId: string
  onOpenProperties: (nodeId: string) => void
  onExecuteNode?: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
  onDelete?: (nodeId: string) => void
}

export function NodeContextMenu({
  children,
  nodeId,
  onOpenProperties,
  onExecuteNode,
  onDuplicate,
  onDelete
}: NodeContextMenuProps) {
  const handleMenuAction = (action: () => void) => {
    action()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* Properties option */}
        <ContextMenuItem
          onClick={() => handleMenuAction(() => onOpenProperties(nodeId))}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Properties
        </ContextMenuItem>

        {/* Execute Node option (if provided) */}
        {onExecuteNode && (
          <ContextMenuItem
            onClick={() => handleMenuAction(() => onExecuteNode(nodeId))}
            className="cursor-pointer"
          >
            <Play className="mr-2 h-4 w-4" />
            Execute Node
          </ContextMenuItem>
        )}

        {/* Separator */}
        <ContextMenuSeparator />

        {/* Duplicate option (if provided) */}
        {onDuplicate && (
          <ContextMenuItem
            onClick={() => handleMenuAction(() => onDuplicate(nodeId))}
            className="cursor-pointer"
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
        )}

        {/* Delete option (if provided) */}
        {onDelete && (
          <>
            {onDuplicate && <ContextMenuSeparator />}
            <ContextMenuItem
              onClick={() => handleMenuAction(() => onDelete(nodeId))}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
