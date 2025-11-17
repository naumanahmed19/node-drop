import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useWorkflowStore } from '@/stores'
import { WorkflowNode } from '@/types'
import { getNodeExecutionCapability } from '@/utils/nodeTypeClassification'
import { isNodeExecutable } from '@/utils/nodeTypeUtils'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Code,
  Info,
  Play,
  Settings,
  Table,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { WebhookTriggerInput } from './WebhookTriggerInput'
import { NodeIconRenderer } from '@/components/common/NodeIconRenderer'
import { useNodeTypes } from '@/stores'

/**
 * Main props for the InputsColumn component
 * @param node - The workflow node whose inputs/connections to display
 */
interface InputsColumnProps {
  node: WorkflowNode
  readOnly?: boolean
}

/**
 * Props for SchemaViewer - Renders JSON data as an expandable tree structure
 * Uses recursive rendering to handle nested objects/arrays with proper visual hierarchy
 * @param data - The JSON data to display (object, array, or primitive value)
 * @param level - Current nesting depth for indentation (0 = root level)
 * @param keyName - Property name from parent object for context display
 * @param parentPath - Full path from root for tooltip display
 */
interface SchemaViewerProps {
  data: any
  level: number
  keyName?: string
  parentPath?: string
}

/**
 * Props for UnifiedTreeNode - Combines workflow node header with execution data
 * Creates a unified tree where each node shows both metadata and actual data results
 * @param node - Workflow node containing metadata (name, type, etc.)
 * @param connection - Connection info (input/output mapping details)
 * @param nodeExecutionResult - Actual execution data from workflow runs
 * @param level - Tree depth for proper visual nesting
 * @param expandedState - Global expand/collapse state for all tree nodes
 * @param onExpandedChange - Callback to update expansion state
 * @param getNodeIcon - Function to get appropriate icon for node type
 * @param getNodeStatusBadge - Function to get status badge for execution state
 * @param onExecuteNode - Callback to execute a specific node
 */
interface UnifiedTreeNodeProps {
  node: WorkflowNode
  connection: any
  nodeExecutionResult: any
  level: number
  expandedState: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
  getNodeStatusBadge: (status?: string) => React.ReactNode
  onExecuteNode: (nodeId: string) => void
}

/**
 * UnifiedTreeNode Component - Node Header + Data Integration
 * 
 * CONCEPT:
 * - Combines workflow node metadata with actual execution data
 * - Creates single tree hierarchy instead of separate sections
 * - Node header acts as parent, execution data as children
 * 
 * STRUCTURE:
 * - Header: Node name, icon, status badge, connection details (in tooltip)
 * - Content: Execution data rendered through SchemaViewer
 * - Both use same expansion state for unified experience
 * 
 * DATA EXTRACTION:
 * - Uses getRelevantData() to extract meaningful data from execution results
 * - Handles different data structures (arrays, objects, primitives)
 * - Filters out empty/null values for cleaner display
 */
function UnifiedTreeNode({
  node: inputNode,
  connection,
  nodeExecutionResult,
  level,
  expandedState,
  onExpandedChange,
  getNodeStatusBadge,
  onExecuteNode
}: UnifiedTreeNodeProps) {
  const isNodeExpanded = expandedState[inputNode.id] || false
  const nodeData = nodeExecutionResult?.data ? getRelevantData(nodeExecutionResult.data) : null
  
  // Get node type definition for icon rendering
  const { nodeTypes } = useNodeTypes()
  const nodeTypeDefinition = useMemo(() => 
    nodeTypes.find(nt => nt.type === inputNode.type),
    [nodeTypes, inputNode.type]
  )
  
  // Determine if this is a trigger node for icon shape
  const isTrigger = useMemo(() => {
    const capability = getNodeExecutionCapability(inputNode.type)
    return capability === 'trigger'
  }, [inputNode.type])

  // Indentation for tree hierarchy - matches SchemaViewer pattern
  const indentStyle = { paddingLeft: `${level * 12}px` }

  return (
    <div style={indentStyle}>
      <Collapsible open={isNodeExpanded} onOpenChange={(open) => onExpandedChange(inputNode.id, open)}>
        {/* Node Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between w-full p-3 bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors text-left group cursor-pointer">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isNodeExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <NodeIconRenderer
                icon={inputNode.icon || nodeTypeDefinition?.icon}
                nodeType={inputNode.type}
                nodeGroup={nodeTypeDefinition?.group}
                displayName={inputNode.name}
                backgroundColor={inputNode.color || nodeTypeDefinition?.color || '#6b7280'}
                isTrigger={isTrigger}
                size="sm"
                className="flex-shrink-0"
              />
              <span className="text-sm font-medium truncate">
                {inputNode.name}
              </span>
              {!connection.id && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">
                  Indirect
                </Badge>
              )}
              {connection.id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Output: <code className="bg-muted px-1 rounded">{connection.sourceOutput}</code>
                        {' → '}
                        Input: <code className="bg-muted px-1 rounded">{connection.targetInput}</code>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {!connection.id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-blue-500 hover:text-blue-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Previous node in workflow (not directly connected)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span
                className={`w-2 h-2 rounded-full ${inputNode.disabled ? 'bg-muted-foreground' : 'bg-green-500'
                  }`}
                title={inputNode.disabled ? "Disabled" : "Enabled"}
              />
              {/* Show data preview in header */}
              {nodeData && (
                <span className="text-xs text-muted-foreground italic">
                  {Array.isArray(nodeData) ? `[${nodeData.length} items]` :
                    typeof nodeData === 'object' ? `{${Object.keys(nodeData).length} keys}` :
                      typeof nodeData}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Only show execute button for executable nodes */}
              {nodeTypeDefinition && isNodeExecutable(nodeTypeDefinition) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onExecuteNode(inputNode.id)
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Execute {inputNode.name}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {nodeExecutionResult && (
                <div>
                  {getNodeStatusBadge(nodeExecutionResult.status)}
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Node Data as part of the tree */}
        <CollapsibleContent className="space-y-0">
          {nodeData ? (
            <div className="bg-muted/20">
              {Array.isArray(nodeData) ? (
                // For arrays, show items directly
                nodeData.map((item, index) => (
                  <SchemaViewer
                    key={index}
                    data={item}
                    level={level + 1}
                    keyName={`[${index}]`}
                    parentPath="json"
                    expandedState={expandedState}
                    onExpandedChange={onExpandedChange}
                  />
                ))
              ) : (
                // For objects, show properties directly
                Object.entries(nodeData).map(([key, value]) => (
                  <SchemaViewer
                    key={key}
                    data={value}
                    level={level + 1}
                    keyName={key}
                    parentPath="json"
                    expandedState={expandedState}
                    onExpandedChange={onExpandedChange}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted/30 text-xs text-muted-foreground italic">
              No execution data available. Run the workflow to see data.
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * SchemaViewer Component - Recursive JSON Data Tree Renderer
 * 
 * PURPOSE:
 * - Displays JSON data as expandable tree matching exact structure
 * - Handles nested objects/arrays with proper visual hierarchy
 * - Shows data types and previews for all value types
 * 
 * VISUAL RULES:
 * - Each level indented by 16px for clear nesting
 * - Sibling properties align at same visual level
 * - Complex types (objects/arrays) are expandable
 * - Primitive values show inline with type hints
 * 
 * RECURSION PATTERN:
 * - Calls itself for each nested property/array item
 * - Maintains level counter for proper indentation
 * - Uses unique keys for independent expand/collapse state
 */
function SchemaViewer({ data, level, keyName, parentPath = 'json', expandedState, onExpandedChange }: SchemaViewerProps & {
  expandedState?: Record<string, boolean>
  onExpandedChange?: (key: string, expanded: boolean) => void
}) {
  const itemKey = keyName ? `${level}-${keyName}` : `${level}-root`
  const isExpanded = expandedState ? (expandedState[itemKey] ?? (level < 2)) : (level < 2)

  // Build the current path for this item
  const currentPath = keyName 
    ? keyName.startsWith('[') 
      ? `${parentPath}${keyName}` // Array index like [0]
      : `${parentPath}.${keyName}` // Object property like .user
    : parentPath

  // Helper functions for data type analysis and display
  const getValueType = (value: any): string => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return `array[${value.length}]`
    return typeof value
  }

  const getValuePreview = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return `"${value.length > 20 ? value.slice(0, 20) + '...' : value}"`
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return `{${Object.keys(value).length} keys}`
    return String(value)
  }

  const isComplexType = (value: any): boolean => {
    return value !== null && (typeof value === 'object' || Array.isArray(value))
  }

  const indentStyle = { paddingLeft: `${level * 12}px` }
  const bgColor = level % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'

  if (!isComplexType(data)) {
    // Simple value - just display inline
    return (
      <div style={indentStyle} className={`flex items-center gap-2 py-1 px-2 ${bgColor} border-l-2 border-transparent hover:border-primary/30 hover:bg-accent/50 transition-colors relative`}>
        <div className="absolute left-0 top-0 bottom-0 w-px bg-border/30" style={{ left: `${level * 12 - 1}px` }}></div>
        {keyName && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span 
                    className="font-mono text-blue-600 text-xs font-medium bg-white px-1.5 py-0.5 rounded-sm border border-border cursor-grab active:cursor-grabbing select-none hover:bg-accent hover:text-accent-foreground transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', currentPath)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    {keyName}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-mono">{currentPath}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground">:</span>
          </>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-sm border border-border cursor-grab active:cursor-grabbing select-none hover:bg-accent hover:text-accent-foreground transition-colors"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `{{${currentPath}}}`)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                {getValuePreview(data)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-mono">{`{{${currentPath}}}`}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-xs text-muted-foreground italic">
          ({getValueType(data)})
        </span>
      </div>
    )
  }

  // Complex object or array
  return (
    <div style={indentStyle} className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-px bg-border/30" style={{ left: `${level * 12 - 1}px` }}></div>
      <Collapsible
        open={isExpanded}
        onOpenChange={(open) => onExpandedChange?.(itemKey, open)}
      >
        <CollapsibleTrigger asChild>
          <div className={`flex items-center gap-2 py-1 px-2 ${bgColor} hover:bg-accent/50 border-l-2 border-transparent hover:border-primary/30 transition-colors cursor-pointer group`}>
            <div className="flex items-center justify-center w-4 h-4 rounded-sm hover:bg-accent transition-colors">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            {keyName && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span 
                        className="font-mono text-blue-600 text-xs font-medium bg-white px-1.5 py-0.5 rounded-sm border border-border cursor-grab active:cursor-grabbing select-none hover:bg-accent hover:text-accent-foreground transition-colors"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', currentPath)
                          e.dataTransfer.effectAllowed = 'copy'
                          e.stopPropagation()
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {keyName}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-mono">{currentPath}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">:</span>
              </>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span 
                    className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-sm border border-border cursor-grab active:cursor-grabbing select-none hover:bg-accent hover:text-accent-foreground transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `{{${currentPath}}}`)
                      e.dataTransfer.effectAllowed = 'copy'
                      e.stopPropagation()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Array.isArray(data) ? `[${data.length}]` : `{${Object.keys(data).length}}`}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-mono">{`{{${currentPath}}}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-xs text-muted-foreground italic">
              ({getValueType(data)})
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-l border-border/20 ml-2">
            {Array.isArray(data) ? (
              // Array handling
              data.map((item, index) => (
                <SchemaViewer
                  key={index}
                  data={item}
                  level={level + 1}
                  keyName={`[${index}]`}
                  parentPath={currentPath}
                  expandedState={expandedState}
                  onExpandedChange={onExpandedChange}
                />
              ))
            ) : (
              // Object handling
              Object.entries(data).map(([key, value]) => (
                <SchemaViewer
                  key={key}
                  data={value}
                  level={level + 1}
                  keyName={key}
                  parentPath={currentPath}
                  expandedState={expandedState}
                  onExpandedChange={onExpandedChange}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * getRelevantData - Data Extraction Utility
 * 
 * PURPOSE:
 * - Extracts meaningful data from nodeDrop execution results
 * - Handles nested execution metadata to find actual user data
 * - Standardizes different data structure patterns
 * 
 * nodeDrop DATA PATTERNS:
 * - Array[0].json - Most common: data wrapped in execution array
 * - Array[0].main - Recursive: data in 'main' property  
 * - Object.json - Direct: data in 'json' property
 * - Raw values - Primitive data types
 * 
 * FILTERING:
 * - Returns first item from arrays (nodeDrop executions often single-item)
 * - Unwraps execution metadata to reveal actual payload
 * - Falls back to raw data if no known patterns match
 */
function getRelevantData(executionData: any): any {
  // Extract the most relevant data from execution result
  // Usually the actual data is nested within execution metadata

  // If it's an array, get the first item (common in nodeDrop)
  if (Array.isArray(executionData) && executionData.length > 0) {
    const firstItem = executionData[0]

    // If the first item has a 'json' property, use that (common nodeDrop pattern)
    if (firstItem && typeof firstItem === 'object' && firstItem.json) {
      return firstItem.json
    }

    // If the first item has a 'main' property with data
    if (firstItem && typeof firstItem === 'object' && firstItem.main) {
      return getRelevantData(firstItem.main)
    }

    return firstItem
  }

  // If it's an object with 'json' property
  if (executionData && typeof executionData === 'object' && executionData.json) {
    return executionData.json
  }

  // If it's an object with 'main' property
  if (executionData && typeof executionData === 'object' && executionData.main) {
    return getRelevantData(executionData.main)
  }

  // Return as-is if we can't find a better structure
  return executionData
}

/**
 * InputsColumn Component Architecture Overview:
 * 
 * STRUCTURE:
 * 1. Tab Interface (Schema, JSON, Table) - allows switching data view modes
 * 2. Unified Tree - merges node headers with execution data in single hierarchy
 * 3. Recursive SchemaViewer - handles nested data display with proper indentation
 * 
 * DATA FLOW:
 * - Fetches input connections for current node
 * - Retrieves execution results for each connected node
 * - Unifies node metadata with execution data
 * - Renders as expandable tree matching JSON structure
 * 
 * VISUAL HIERARCHY:
 * - Each tree level uses 16px indentation increment
 * - Sibling properties appear at same visual level as in JSON
 * - Connection details moved to tooltips for cleaner interface
 */
export function InputsColumn({ node }: InputsColumnProps) {
  const { workflow, getNodeExecutionResult, executeNode } = useWorkflowStore()
  const { nodeTypes } = useNodeTypes()

  // State management for tree expansion and active tab view
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'schema' | 'json' | 'table'>('schema')

  // Check if current node is a trigger - triggers should not have inputs
  const isTriggerNode = useMemo(() => {
    const capability = getNodeExecutionCapability(node.type)
    return capability === 'trigger'
  }, [node.type])

  // Handle node execution
  const handleExecuteNode = (nodeId: string) => {
    const nodeToExecute = workflow?.nodes.find(n => n.id === nodeId)
    if (nodeToExecute) {
      // Check if it's a trigger node to determine execution mode
      const triggerNodeTypes = [
        "manual-trigger",
        "webhook-trigger",
        "schedule-trigger",
        "workflow-called",
      ];
      const mode = triggerNodeTypes.includes(nodeToExecute.type) ? "workflow" : "single";

      // Execute with undefined inputData (will use data from connected nodes)
      executeNode(nodeId, undefined, mode)
    }
  }

  // Get ALL previous nodes in the workflow (not just directly connected)
  // This allows users to access variables from any node that comes before in the workflow
  const getAllPreviousNodes = useMemo(() => {
    if (!workflow) return []
    
    const visited = new Set<string>()
    const previousNodes: WorkflowNode[] = []
    
    // Recursive function to traverse backwards through the workflow
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      
      // Find all connections that target this node
      const incomingConnections = workflow.connections.filter(
        conn => conn.targetNodeId === nodeId
      )
      
      // For each incoming connection, add the source node and traverse it
      incomingConnections.forEach(conn => {
        const sourceNode = workflow.nodes.find(n => n.id === conn.sourceNodeId)
        if (sourceNode && !previousNodes.find(n => n.id === sourceNode.id)) {
          previousNodes.push(sourceNode)
        }
        // Recursively traverse to find all ancestors
        traverse(conn.sourceNodeId)
      })
    }
    
    // Start traversal from current node
    traverse(node.id)
    
    return previousNodes
  }, [workflow, node.id])

  // Get direct input connections for connection metadata
  const inputConnections = useMemo(() => {
    if (!workflow) return []
    return workflow.connections.filter(conn => conn.targetNodeId === node.id)
  }, [workflow, node.id])

  // Use all previous nodes instead of just directly connected ones
  const inputNodes = getAllPreviousNodes

  // Create node items with connections (if they exist)
  const nodeItems = useMemo(() => {
    return inputNodes.map((inputNode) => {
      // Find direct connection to this node (if exists)
      const directConnection = inputConnections.find(
        conn => conn.sourceNodeId === inputNode.id
      )
      
      return {
        node: inputNode,
        connection: directConnection || {
          // Provide default connection info for indirect nodes
          sourceNodeId: inputNode.id,
          targetNodeId: node.id,
          sourceOutput: 'output',
          targetInput: 'input'
        }
      }
    })
  }, [inputNodes, inputConnections, node.id])

  // Initialize expanded state for all nodes
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {}
    nodeItems.forEach(item => {
      if (!(item.node.id in expandedCategories)) {
        initialExpanded[item.node.id] = false // Start collapsed by default
      }
    })
    if (Object.keys(initialExpanded).length > 0) {
      setExpandedCategories(prev => ({ ...prev, ...initialExpanded }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeItems]) // Only depend on nodeItems, not expandedCategories to prevent infinite loop

  const getNodeStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Success</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Error</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Running</Badge>
      case 'skipped':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Skipped</Badge>
      default:
        return <Badge variant="outline">Idle</Badge>
    }
  }

  // If this is a trigger node, show a message that triggers don't have inputs
  if (isTriggerNode) {
    return (
      <div className="flex w-full h-full border-r flex-col">
        {/* No header for trigger nodes - they don't have inputs */}
        <div className="h-full overflow-y-auto flex items-center justify-center">
          {/* Show webhook-specific UI for webhook triggers */}
          {node.type === 'webhook-trigger' ? (
            <WebhookTriggerInput node={node} />
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div>
                <Zap className="w-8 h-8 text-yellow-400 mb-2 mx-auto" />
                <p className="text-sm font-medium text-gray-700">Trigger Node</p>
                <p className="text-xs text-gray-500 mt-1">Triggers don't accept inputs</p>
                <p className="text-xs text-gray-400 mt-2">They are the starting point of your workflow</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (inputNodes.length === 0) {
    return (
      <div className="flex w-full h-full border-r flex-col">
        <div className="p-4 border-b h-[72px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
              <h3 className="font-medium">Inputs</h3>
              <Badge variant="outline">0</Badge>
            </div>
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80" side="bottom" align="end">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Input Connections</h4>
                  <p className="text-sm text-gray-600">
                    This panel shows categorized input connections to this node, organized by node types.
                  </p>
                  <div className="text-xs text-gray-500">
                    • Nodes grouped by category (Triggers, Actions, etc.)<br />
                    • Click categories to expand/collapse<br />
                    • Execute workflow to view live data<br />
                    • Click "View Data" to inspect details
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>

        <div className="h-[calc(100dvh-222px)] overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <ArrowLeft className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No input connections</p>
            <p className="text-xs text-gray-400">Connect nodes to see categorized input data</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full h-full border-r flex-col">
      <div className="border-b">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium">Inputs</h3>
            <Badge variant="outline">{inputNodes.length}</Badge>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList>
              <TabsTrigger value="schema" className="flex items-center gap-2 text-xs">
                <Settings className="h-3 w-3" />
                Schema
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2 text-xs">
                <Code className="h-3 w-3" />
                JSON
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2 text-xs">
                <Table className="h-3 w-3" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <div className="h-[calc(100dvh-262px)] overflow-y-auto">

          {/* Schema Tab - Unified Tree */}
          <TabsContent value="schema" className="m-0 p-0">
            <div className="space-y-0">
              {nodeItems.map((item) => {
                const { node: inputNode, connection } = item
                const nodeExecutionResult = getNodeExecutionResult(inputNode.id)

                return (
                  <UnifiedTreeNode
                    key={inputNode.id}
                    node={inputNode}
                    connection={connection}
                    nodeExecutionResult={nodeExecutionResult}
                    level={0}
                    expandedState={expandedCategories}
                    onExpandedChange={(key, expanded) => {
                      setExpandedCategories(prev => ({
                        ...prev,
                        [key]: expanded
                      }))
                    }}
                    getNodeStatusBadge={getNodeStatusBadge}
                    onExecuteNode={handleExecuteNode}
                  />
                )
              })}
            </div>
          </TabsContent>

          {/* JSON Tab */}
          <TabsContent value="json" className="m-0 p-0">
            <div className="p-4">
              {nodeItems.map((item) => {
                const { node: inputNode } = item
                const nodeExecutionResult = getNodeExecutionResult(inputNode.id)
                const nodeTypeDefinition = nodeTypes.find(nt => nt.type === inputNode.type)
                const isTrigger = getNodeExecutionCapability(inputNode.type) === 'trigger'

                return (
                  <div key={inputNode.id} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <NodeIconRenderer
                        icon={inputNode.icon || nodeTypeDefinition?.icon}
                        nodeType={inputNode.type}
                        nodeGroup={nodeTypeDefinition?.group}
                        displayName={inputNode.name}
                        backgroundColor={inputNode.color || nodeTypeDefinition?.color || '#6b7280'}
                        isTrigger={isTrigger}
                        size="sm"
                      />
                      <span className="text-sm font-medium">{inputNode.name}</span>
                      {nodeExecutionResult && getNodeStatusBadge(nodeExecutionResult.status)}
                    </div>

                    {nodeExecutionResult?.data ? (
                      <pre className="text-xs bg-muted p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap">
                        {JSON.stringify(nodeExecutionResult.data, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-3 bg-muted rounded border">
                        No execution data available
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* Table Tab */}
          <TabsContent value="table" className="m-0 p-0">
            <div className="p-4">
              <div className="text-xs">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-gray-300 p-2 text-left">Node</th>
                      <th className="border border-gray-300 p-2 text-left">Type</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                      <th className="border border-gray-300 p-2 text-left">Data Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeItems.map((item) => {
                      const { node: inputNode } = item
                      const nodeExecutionResult = getNodeExecutionResult(inputNode.id)
                      const nodeTypeDefinition = nodeTypes.find(nt => nt.type === inputNode.type)
                      const isTrigger = getNodeExecutionCapability(inputNode.type) === 'trigger'

                      return (
                        <tr key={inputNode.id} className="hover:bg-muted/50">
                          <td className="border border-gray-300 p-2">
                            <div className="flex items-center gap-2">
                              <NodeIconRenderer
                                icon={inputNode.icon || nodeTypeDefinition?.icon}
                                nodeType={inputNode.type}
                                nodeGroup={nodeTypeDefinition?.group}
                                displayName={inputNode.name}
                                backgroundColor={inputNode.color || nodeTypeDefinition?.color || '#6b7280'}
                                isTrigger={isTrigger}
                                size="sm"
                              />
                              <span className="font-medium">{inputNode.name}</span>
                            </div>
                          </td>
                          <td className="border border-gray-300 p-2">
                            <Badge variant="outline" className="text-xs">
                              {inputNode.type}
                            </Badge>
                          </td>
                          <td className="border border-gray-300 p-2">
                            {nodeExecutionResult ?
                              getNodeStatusBadge(nodeExecutionResult.status) :
                              <Badge variant="outline">Not Run</Badge>
                            }
                          </td>
                          <td className="border border-gray-300 p-2">
                            {nodeExecutionResult?.data ? (
                              <Badge className="bg-green-100 text-green-800">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
