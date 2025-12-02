import { useNodeConfigDialogStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { NodeSettingsForm } from '@/components/workflow/shared/NodeSettingsForm'
import { useCallback } from 'react'

interface SettingsTabProps {
  node: WorkflowNode
  nodeType: NodeType
  readOnly?: boolean
}

export function SettingsTab({ nodeType, readOnly = false }: SettingsTabProps) {
  const { nodeSettings, updateNodeSettings } = useNodeConfigDialogStore()

  // Handle field value changes - sync with dialog store
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    if (readOnly) return
    updateNodeSettings({ ...nodeSettings, [fieldName]: value })
  }, [readOnly, nodeSettings, updateNodeSettings])

  return (
    <div className="h-[calc(100dvh-222px)] overflow-y-auto p-4">
      <div className="p-6 space-y-6">
        <NodeSettingsForm
          nodeType={nodeType}
          values={nodeSettings || {}}
          onChange={handleFieldChange}
          disabled={readOnly}
        />
      </div>
    </div>
  )
}
