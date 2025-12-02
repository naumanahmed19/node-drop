import { Button } from '@/components/ui/button'
import { useReactFlowUIStore } from '@/stores'
import { NodeType } from '@/types'
import { Sliders } from 'lucide-react'
import { memo } from 'react'

interface ConfigToolbarButtonProps {
  nodeId: string
  nodeType: NodeType
  disabled?: boolean
}

export const ConfigToolbarButton = memo(function ConfigToolbarButton({
  nodeId: _nodeId,
  nodeType: _nodeType,
  disabled = false,
}: ConfigToolbarButtonProps) {
  const { showRightSidebar, rightSidebarTab, openRightSidebar } = useReactFlowUIStore()

  // Hide button when sidebar is already open with settings tab
  if (showRightSidebar && rightSidebarTab === 'settings') {
    return null
  }

  const handleClick = () => {
    if (disabled) return
    openRightSidebar('settings')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      disabled={disabled}
      onClick={handleClick}
      title="Quick Settings"
      aria-label="Quick Settings"
    >
      <Sliders className="h-3.5 w-3.5" />
    </Button>
  )
})

ConfigToolbarButton.displayName = 'ConfigToolbarButton'
