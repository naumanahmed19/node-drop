import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { Box, Clipboard, Copy, Eye, EyeOff, Lock, Maximize2, Minimize2, PackagePlus, Play, Scissors, Settings, Trash2, Ungroup, Unlock } from 'lucide-react'
import { isNodeExecutable } from '@/utils/nodeTypeUtils'
import { NodeType } from '@/types'

interface NodeContextMenuProps {
  onOpenProperties: () => void
  onExecute: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleLock: () => void
  onToggleCompact?: () => void
  onToggleDisabled?: () => void
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onUngroup?: () => void
  onGroup?: () => void
  onCreateTemplate?: () => void
  isLocked: boolean
  isDisabled?: boolean
  isCompact?: boolean
  readOnly?: boolean
  canCopy?: boolean
  canPaste?: boolean
  isInGroup?: boolean
  canGroup?: boolean
  canCreateTemplate?: boolean
  nodeType?: NodeType // Optional node type to check if executable
}

export function NodeContextMenu({
  onOpenProperties,
  onExecute,
  onDuplicate,
  onDelete,
  onToggleLock,
  onToggleCompact,
  onToggleDisabled,
  onCopy,
  onCut,
  onPaste,
  onUngroup,
  onGroup,
  onCreateTemplate,
  isLocked,
  isDisabled = false,
  isCompact = false,
  readOnly = false,
  canCopy = false,
  canPaste = false,
  isInGroup = false,
  canGroup = false,
  canCreateTemplate = false,
  nodeType,
}: NodeContextMenuProps) {
  // Check if node is executable (not service or tool type)
  const canExecute = nodeType ? isNodeExecutable(nodeType) : true

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem
        onClick={onOpenProperties}
        className="cursor-pointer"
      >
        <Settings className="mr-2 h-4 w-4" />
        Properties
      </ContextMenuItem>

      {/* Only show execute option for executable nodes */}
      {canExecute && (
        <ContextMenuItem
          onClick={onExecute}
          disabled={readOnly}
          className="cursor-pointer"
        >
          <Play className="mr-2 h-4 w-4" />
          Execute Node
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem
        onClick={onToggleLock}
        disabled={readOnly}
        className="cursor-pointer"
      >
        {isLocked ? (
          <>
            <Unlock className="mr-2 h-4 w-4" />
            Unlock Node
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Lock Node
          </>
        )}
      </ContextMenuItem>

      {onToggleDisabled && (
        <ContextMenuItem
          onClick={onToggleDisabled}
          disabled={readOnly}
          className="cursor-pointer"
        >
          {isDisabled ? (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Enable Node
            </>
          ) : (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Disable Node
            </>
          )}
        </ContextMenuItem>
      )}

      {onToggleCompact && (
        <ContextMenuItem
          onClick={onToggleCompact}
          disabled={readOnly}
          className="cursor-pointer"
        >
          {isCompact ? (
            <>
              <Maximize2 className="mr-2 h-4 w-4" />
              Expand Node
            </>
          ) : (
            <>
              <Minimize2 className="mr-2 h-4 w-4" />
              Compact Node
            </>
          )}
        </ContextMenuItem>
      )}

      {/* Ungroup option - only show if node is in a group */}
      {isInGroup && onUngroup && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onUngroup}
            disabled={readOnly}
            className="cursor-pointer"
          >
            <Ungroup className="mr-2 h-4 w-4" />
            Remove from Group
          </ContextMenuItem>
        </>
      )}

      {/* Group option - show if node(s) can be grouped */}
      {canGroup && onGroup && !isInGroup && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onGroup}
            disabled={readOnly}
            className="cursor-pointer"
          >
            <Box className="mr-2 h-4 w-4" />
            Add to Group
          </ContextMenuItem>
        </>
      )}

      {/* Create Template option - show if multiple nodes are selected */}
      {canCreateTemplate && onCreateTemplate && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={onCreateTemplate}
            disabled={readOnly}
            className="cursor-pointer"
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            Create Template
          </ContextMenuItem>
        </>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem
        onClick={onDuplicate}
        disabled={readOnly}
        className="cursor-pointer"
      >
        <Copy className="mr-2 h-4 w-4" />
        Duplicate
      </ContextMenuItem>

      {/* Copy/Cut/Paste Options */}
      {onCopy && (
        <ContextMenuItem
          onClick={onCopy}
          disabled={!canCopy || readOnly}
          className="cursor-pointer"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>
      )}

      {onCut && (
        <ContextMenuItem
          onClick={onCut}
          disabled={!canCopy || readOnly}
          className="cursor-pointer"
        >
          <Scissors className="mr-2 h-4 w-4" />
          Cut
        </ContextMenuItem>
      )}

      {onPaste && (
        <ContextMenuItem
          onClick={onPaste}
          disabled={!canPaste || readOnly}
          className="cursor-pointer"
        >
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />
      
      <ContextMenuItem
        onClick={onDelete}
        disabled={readOnly}
        className="cursor-pointer text-red-600 focus:text-red-600"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
