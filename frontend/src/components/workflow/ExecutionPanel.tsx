import { ExecutionFlowStatus, ExecutionLogEntry, ExecutionState, NodeExecutionResult, WorkflowExecutionResult } from '@/types'
import { useState } from 'react'
import { ExecutionPanelContent } from './ExecutionPanelContent'
import { ExecutionPanelHeader } from './ExecutionPanelHeader'
import { ExecutionPanelTabs, TabType } from './ExecutionPanelTabs'

interface ExecutionPanelProps {
  executionState: ExecutionState
  lastExecutionResult: WorkflowExecutionResult | null
  executionLogs: ExecutionLogEntry[]
  realTimeResults: Map<string, NodeExecutionResult>
  flowExecutionStatus?: ExecutionFlowStatus | null
  isExpanded?: boolean
  onToggle?: () => void
  onClose?: () => void
  onClearLogs?: () => void
}

export function ExecutionPanel({
  executionState,
  lastExecutionResult,
  executionLogs,
  realTimeResults,
  flowExecutionStatus,
  isExpanded = true,
  onToggle,
  onClose,
  onClearLogs
}: ExecutionPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('progress')

  // Get display data for tabs
  const currentResults = Array.from(realTimeResults.values())
  const finalResults = lastExecutionResult?.nodeResults || []
  const displayResults = executionState.status === 'running' ? currentResults : finalResults

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else if (onClose) {
      onClose()
    }
  }

  return (
    <div className="h-full bg-background flex flex-col border-l border-border">
      <ExecutionPanelHeader
        executionState={executionState}
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />

        <div className="flex-1 flex flex-col">
          <ExecutionPanelTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            logsCount={executionLogs.length}
            resultsCount={displayResults.length}
          />

          <ExecutionPanelContent
            activeTab={activeTab}
            executionState={executionState}
            lastExecutionResult={lastExecutionResult}
            executionLogs={executionLogs}
            realTimeResults={realTimeResults}
            flowExecutionStatus={flowExecutionStatus}
            onClearLogs={onClearLogs}
          />
        </div>
    </div>
  )
}
