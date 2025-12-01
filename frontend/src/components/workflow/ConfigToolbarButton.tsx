import { useReactFlowUIStore } from '@/stores'
import { NodeType } from '@/types'
import { Sliders } from 'lucide-react'
import { memo } from 'react'
import './toolbar-buttons.css'

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
  const { openRightSidebar } = useReactFlowUIStore()

  const handleClick = () => {
    if (disabled) return
    // Open the sidebar with settings tab
    openRightSidebar('settings')
  }

  return (
    <button
      className="toolbar-button"
      disabled={disabled}
      onClick={handleClick}
      title="Quick Settings"
      aria-label="Quick Settings"
      tabIndex={0}
      role="button"
    >
      <Sliders className="h-3.5 w-3.5" />
    </button>
  )
})

ConfigToolbarButton.displayName = 'ConfigToolbarButton'
