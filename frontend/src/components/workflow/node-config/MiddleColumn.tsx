import { NodeIconRenderer } from '@/components/common/NodeIconRenderer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNodeConfigDialogStore, useWorkflowStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { NodeValidator } from '@/utils/nodeValidation'
import {
  AlertCircle,
  CheckCircle,
  Database,
  FileText,
  Info,
  Loader2,
  MoreVertical,
  Play,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  XCircle
} from 'lucide-react'
import { ConfigTab } from './tabs/ConfigTab'
import { DocsTab } from './tabs/DocsTab'
import { ResponseTab } from './tabs/ResponseTab'
import { SettingsTab } from './tabs/SettingsTab'
import { TestTab } from './tabs/TestTab'

interface MiddleColumnProps {
  node: WorkflowNode
  nodeType: NodeType
  onDelete: () => void
  onExecute: () => void
  readOnly?: boolean
}

export function MiddleColumn({ node, nodeType, onDelete, onExecute, readOnly = false }: MiddleColumnProps) {
  const {
    nodeName,
    isDisabled,
    isEditingName,
    isExecuting,
    validationErrors,
    activeTab,
    updateNodeName,
    updateDisabled,
    setIsEditingName,
    setActiveTab
  } = useNodeConfigDialogStore()

  const {
    getNodeExecutionResult,
    executionState
  } = useWorkflowStore()

  const nodeExecutionResult = getNodeExecutionResult(node.id)

  return (
    <div className="flex w-full h-full flex-col">
      {/* Node Title Section */}
      <div className="p-4 border-b bg-muted/30 dark:bg-muted/20 h-[72px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <HoverCard>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer">
                  <NodeIconRenderer
                    icon={nodeType.icon}
                    nodeType={nodeType.type}
                    nodeGroup={nodeType.group}
                    displayName={nodeType.displayName}
                    backgroundColor={nodeType.color}
                    size="lg"
                    className="rounded-lg"
                  />
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-80" side="bottom" align="start">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center space-x-2">
                    <Info className="w-4 h-4" />
                    <span>{nodeType.displayName}</span>
                  </h4>
                  <p className="text-sm text-gray-600">
                    {nodeType.description}
                  </p>
                  <div className="text-xs text-gray-500">
                    • Configure node parameters<br />
                    • Set up credentials if required<br />
                    • Test node execution<br />
                    • View response data and documentation
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <div className="flex-1 min-w-0">
              {isEditingName && !readOnly ? (
                <Input
                  value={nodeName}
                  onChange={(e) => updateNodeName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false)
                    }
                  }}
                  className={`text-sm font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0 ${NodeValidator.getFieldError(validationErrors, 'name') ? 'text-red-600' : ''
                    }`}
                  placeholder="Node name..."
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => !readOnly && setIsEditingName(true)}
                  className={`text-sm font-semibold px-1 py-0.5 rounded transition-colors ${readOnly ? '' : 'cursor-pointer hover:bg-muted'
                    }`}
                >
                  {nodeName || nodeType.displayName}
                </div>
              )}
              {NodeValidator.getFieldError(validationErrors, 'name') && (
                <div className="flex items-center space-x-1 mt-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-xs">{NodeValidator.getFieldError(validationErrors, 'name')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Execute Node Button - Hidden in read-only mode */}
            {!readOnly && (
              <div className="relative">
                <Button
                  onClick={onExecute}
                  disabled={isExecuting || executionState.status === 'running' || validationErrors.length > 0}
                  size="icon"
                  variant="outline"
                  title="Run Node"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                {/* Status Icon - positioned at top-right corner */}
                {nodeExecutionResult?.status === 'success' && (
                  <CheckCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-green-600 bg-white rounded-full" />
                )}
                {nodeExecutionResult?.status === 'error' && (
                  <XCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-red-600 bg-white rounded-full" />
                )}
              </div>
            )}

            {/* More Actions Dropdown - Hidden in read-only mode */}
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => updateDisabled(!isDisabled)}
                    className="flex items-center space-x-2"
                  >
                    {isDisabled ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    <span>{isDisabled ? 'Enable Node' : 'Disable Node'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Node</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 border-b">
          <div className="flex space-x-0 -mb-px">
            <TabsList className="h-auto p-0 bg-transparent grid w-full grid-cols-5 shadow-none">
              <TabsTrigger
                value="config"
                className="flex items-center space-x-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent shadow-none transition-all duration-200 text-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="font-medium">Config</span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex items-center space-x-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent shadow-none transition-all duration-200 text-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="font-medium">Settings</span>
              </TabsTrigger>
              <TabsTrigger
                value="test"
                className="flex items-center space-x-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent shadow-none transition-all duration-200 text-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span className="font-medium">Test</span>
              </TabsTrigger>
              <TabsTrigger
                value="response"
                className="flex items-center space-x-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent shadow-none transition-all duration-200 text-sm"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="font-medium">Response</span>
              </TabsTrigger>
              <TabsTrigger
                value="docs"
                className="flex items-center space-x-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent shadow-none transition-all duration-200 text-sm"
              >
                <FileText className="w-4 h-4" />
                <span className="font-medium">Docs</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="config" className="h-full mt-0">
            <ConfigTab node={node} nodeType={nodeType} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="settings" className="h-full mt-0">
            <SettingsTab node={node} nodeType={nodeType} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="test" className="h-full mt-0">
            <TestTab node={node} nodeType={nodeType} />
          </TabsContent>

          <TabsContent value="response" className="h-full mt-0">
            <ResponseTab node={node} />
          </TabsContent>

          <TabsContent value="docs" className="h-full mt-0">
            <DocsTab nodeType={nodeType} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
