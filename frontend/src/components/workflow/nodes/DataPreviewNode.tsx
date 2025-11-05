import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkflowStore } from '@/stores'
import { Node, NodeProps } from '@xyflow/react'
import { Terminal, Code, Table, FileText, Copy, Check } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BaseNodeWrapper } from './BaseNodeWrapper'

interface DataPreviewNodeData extends Record<string, unknown> {
  label: string
  nodeType: string
  parameters: Record<string, any>
  disabled: boolean
  locked?: boolean
  status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'
  executionResult?: any
  lastExecutionData?: any
  inputs?: string[]
  outputs?: string[]
  executionCapability?: 'trigger' | 'action' | 'transform' | 'condition'
}

type DataPreviewNodeType = Node<DataPreviewNodeData>

/**
 * DataPreviewNode - Terminal-style data preview with collapsible interface
 * 
 * Features:
 * - Terminal-style display with dark theme
 * - Multiple format options (JSON, Text, Table)
 * - Collapsible preview sections
 * - Copy to clipboard functionality
 * - Real-time execution data display
 */
export const DataPreviewNode = memo(function DataPreviewNode({ data, selected, id }: NodeProps<DataPreviewNodeType>) {
  const { updateNode, workflow, lastExecutionResult } = useWorkflowStore()
  const isReadOnly = false

  // Track expanded state
  const [isExpanded, setIsExpanded] = useState(data.parameters?.isExpanded ?? false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [lastProcessedExecutionId, setLastProcessedExecutionId] = useState<string | null>(null)
  
  // Use ref to avoid including data.parameters in useEffect dependencies
  const parametersRef = useRef(data.parameters)
  parametersRef.current = data.parameters

  // Get parameters from node configuration
  const format = data.parameters?.previewFormat || 'json'
  const showTimestamp = data.parameters?.showTimestamp ?? true
  const appendMode = data.parameters?.appendMode ?? false

  // Get data from execution results
  const getDataFromExecution = useCallback(() => {
    if (!workflow || !lastExecutionResult) {
      return null
    }

    // Find this node's execution result
    const nodeExecution = lastExecutionResult.nodeResults?.find(
      nr => nr.nodeId === id
    )

    if (!nodeExecution || !nodeExecution.data) return null

    // Extract the preview data from the _preview property
    let execData = nodeExecution.data

    // If data has a 'main' output array, get the first item
    if (execData.main && Array.isArray(execData.main) && execData.main.length > 0) {
      const mainOutput = execData.main[0]
      // Look for the _preview metadata that we added in the backend
      if (mainOutput._preview) {
        return mainOutput._preview
      }
      // Fallback to json if no _preview (for backwards compatibility)
      if (mainOutput.json) {
        execData = mainOutput.json
      }
    }

    return execData
  }, [workflow, lastExecutionResult, id])

  // Update preview when execution results change
  useEffect(() => {
    if (!lastExecutionResult) return

    const executionId = lastExecutionResult.executionId
    
    // Don't process the same execution twice
    if (executionId === lastProcessedExecutionId) return

    const execData = getDataFromExecution()
    if (execData) {
      setPreviewData(execData)
      
      // If append mode is enabled, update node parameters with history
      if (appendMode && execData.previewHistory) {
        updateNode(id, {
          parameters: {
            ...parametersRef.current,
            previewHistory: execData.previewHistory
          }
        })
      }
      
      setLastProcessedExecutionId(executionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastExecutionResult, appendMode, id, lastProcessedExecutionId])

  // Handle expand/collapse toggle
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    updateNode(id, {
      parameters: {
        ...data.parameters,
        isExpanded: newExpanded
      }
    })
  }, [isExpanded, id, data.parameters, updateNode])

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    if (!previewData?.preview) return

    navigator.clipboard.writeText(previewData.preview).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [previewData])

  // Get format icon
  const getFormatIcon = useCallback(() => {
    switch (format) {
      case 'json':
      case 'json-compact':
        return Code
      case 'table':
        return Table
      case 'text':
        return FileText
      default:
        return Terminal
    }
  }, [format])

  const FormatIcon = getFormatIcon()

  // Prepare header info text
  const headerInfo = useMemo(() => {
    if (!previewData) return 'Waiting for data'
    
    if (appendMode && previewData.historyCount) {
      return `${previewData.historyCount} ${previewData.historyCount === 1 ? 'preview' : 'previews'}`
    }
    
    const lines = previewData.lineCount || 0
    return `${lines} ${lines === 1 ? 'line' : 'lines'}`
  }, [previewData, appendMode])

  // Collapsed content (small preview)
  const collapsedContent = useMemo(() => {
    if (!previewData) return null

    // In append mode, show the latest preview from history
    const preview = appendMode && previewData.previewHistory?.[0]?.preview 
      ? previewData.previewHistory[0].preview 
      : previewData.preview

    if (!preview) return null

    const lines = preview.split('\n').slice(0, 3).join('\n')

    return (
      <div className="w-full bg-gray-900 rounded overflow-hidden">
        <pre className="p-2 text-[10px] font-mono text-gray-100 whitespace-pre-wrap break-all leading-tight">
          {lines}
          {preview.split('\n').length > 3 && '\n...'}
        </pre>
      </div>
    )
  }, [previewData, appendMode])

  // Expanded content (full preview)
  const expandedContent = useMemo(() => (
    <div >
      {!previewData ? (
        <div className="flex flex-col items-center justify-center h-[300px]  border-gray-300">
          <Terminal className="w-16 h-16 mb-2 text-gray-400" />
          <p className="text-sm text-muted-foreground text-center px-4">
            No data to preview
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Execute the workflow to see data
          </p>
        </div>
      ) : appendMode && previewData.previewHistory ? (
        // Append mode: Show history with latest on top
        <div className="space-y-2 h-[300px] overflow-y-auto">
          {previewData.previewHistory.map((historyItem: any, index: number) => (
            <div key={historyItem.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              {/* Preview Header */}
              <div className="bg-gray-800 text-white px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs h-5">
                    {index === 0 ? 'Latest' : `#${index + 1}`}
                  </Badge>
                  {showTimestamp && historyItem.timestamp && (
                    <span className="text-xs text-gray-300">
                      {new Date(historyItem.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs h-5">
                  {historyItem.lineCount || 0} lines
                </Badge>
              </div>

              {/* Preview Content */}
              <div className="bg-gray-900 text-gray-100 max-h-[150px] overflow-y-auto">
                <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {historyItem.preview || 'No preview available'}
                </pre>
              </div>

              {/* Preview Footer */}
              {historyItem.metadata && (
                <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">Items:</span>
                    <span className="text-gray-900 font-medium">
                      {historyItem.metadata.inputItems}
                    </span>
                  </div>
                  {historyItem.metadata.truncated && (
                    <Badge variant="outline" className="text-xs">
                      ⚠️ Truncated
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Normal mode: Show single preview
        <div className="space-y-2">
          {/* Terminal-style Preview */}
          <div className="  overflow-hidden bg-white shadow-sm">
    
            {/* Terminal Content */}
            <div className="bg-gray-900 text-gray-100 h-[240px] overflow-y-auto">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                {previewData.preview || 'No preview available'}
              </pre>
            </div>

            {/* Terminal Footer */}
            {previewData.metadata && (
              <div className="bg-gray-50 border-t border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <FormatIcon className="w-3 h-3 text-gray-600" />
                    <span className="text-gray-600">Format:</span>
                    <span className="text-gray-900 font-medium">
                      {previewData.format === 'json' ? 'JSON (Pretty)' :
                        previewData.format === 'json-compact' ? 'JSON (Compact)' :
                          previewData.format === 'table' ? 'Table' : 'Text'}
                    </span>

                       <div className="flex items-center space-x-2">
         
                <Badge variant="secondary" className="text-xs h-5">
                  {previewData.lineCount || 0} lines
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-5 w-5 p-0 hover:bg-gray-700"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
                  </div>
                  {previewData.metadata.truncated && (
                    <Badge variant="outline" className="text-xs">
                      ⚠️ Truncated
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata Info */}
          {previewData.metadata && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-600">Input Items:</span>
                <span className="ml-1 text-gray-900 font-medium">
                  {previewData.metadata.inputItems}
                </span>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-600">Data Type:</span>
                <span className="ml-1 text-gray-900 font-medium">
                  {previewData.metadata.isArray ? 'Array' : previewData.metadata.dataType}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  ), [previewData, showTimestamp, handleCopy, copied, FormatIcon, appendMode])

  return (
    <BaseNodeWrapper
      id={id}
      selected={selected}
      data={data}
      isReadOnly={isReadOnly}
      isExpanded={isExpanded}
      onToggleExpand={handleToggleExpand}
      Icon={Terminal}
      iconColor="bg-green-500"
      collapsedWidth="200px"
      expandedWidth="360px"
      headerInfo={headerInfo}
      collapsedContent={collapsedContent}
      expandedContent={expandedContent}
      showInputHandle={true}
      showOutputHandle={true}
      inputHandleColor="!bg-green-500"
      outputHandleColor="!bg-green-500"
    />
  )
})
