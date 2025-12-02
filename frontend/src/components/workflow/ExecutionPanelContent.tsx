import { ExecutionFlowStatus, ExecutionState, NodeExecutionResult, WorkflowExecutionResult } from '@/types'
import { TabType } from './ExecutionPanelTabs'
import { LogsTabContent } from './tabs/LogsTabContent'
import { ProgressTabContent } from './tabs/ProgressTabContent'
import { ResultsTabContent } from './tabs/ResultsTabContent'
import { TimelineTabContent } from './tabs/TimelineTabContent'
import type { ExecutionLogEntry } from '@/types/execution'

interface ExecutionPanelContentProps {
  activeTab: TabType
  executionState: ExecutionState
  lastExecutionResult: WorkflowExecutionResult | null
  executionLogs: ExecutionLogEntry[]
  realTimeResults: Map<string, NodeExecutionResult>
  flowExecutionStatus?: ExecutionFlowStatus | null
  onClearLogs?: () => void
}

export function ExecutionPanelContent({
  activeTab,
  executionState,
  lastExecutionResult,
  executionLogs,
  realTimeResults,
  flowExecutionStatus,
  onClearLogs
}: ExecutionPanelContentProps) {
  // Get current and final results for display
  const currentResults = Array.from(realTimeResults.values())
  const finalResults = lastExecutionResult?.nodeResults || []
  const displayResults = executionState.status === 'running' ? currentResults : finalResults

  return (
    <div className="flex-1 min-h-0 relative">
      {activeTab === 'progress' && (
        <ProgressTabContent executionState={executionState} />
      )}
      
      {activeTab === 'timeline' && (
        <TimelineTabContent 
          flowExecutionStatus={flowExecutionStatus}
          realTimeResults={realTimeResults}
        />
      )}
      
      {activeTab === 'logs' && (
        <LogsTabContent 
          logs={executionLogs}
          isActive={activeTab === 'logs'}
          onClearLogs={onClearLogs}
        />
      )}
      
      {activeTab === 'results' && (
        <ResultsTabContent displayResults={displayResults} />
      )}
    </div>
  )
}
