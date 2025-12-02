import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNodeConfigDialogStore, useWorkflowStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { NodeValidator } from '@/utils/nodeValidation'
import { isNodeExecutable } from '@/utils/nodeTypeUtils'
import {
  Database,
  FileText,
  MoreVertical,
  Play,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react'
import { NodeHeader } from '@/components/workflow/shared/NodeHeader'
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
    isExecuting,
    validationErrors,
    activeTab,
    updateNodeName,
    updateDisabled,
    setActiveTab,
  } = useNodeConfigDialogStore()

  const {
    getNodeExecutionResult,
    executionState
  } = useWorkflowStore()

  const nodeExecutionResult = getNodeExecutionResult(node.id)

  // Actions dropdown for the header
  const headerActions = !readOnly && (
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
  )

  return (
    <div className="flex w-full h-full flex-col">
      <NodeHeader
        nodeType={nodeType}
        nodeName={nodeName}
        onNameChange={updateNodeName}
        onExecute={isNodeExecutable(nodeType) ? onExecute : undefined}
        isExecuting={isExecuting}
        executionDisabled={executionState.status === 'running' || validationErrors.length > 0}
        executionStatus={nodeExecutionResult?.status as 'success' | 'error' | 'running' | 'pending' | 'skipped' | null}
        nameError={NodeValidator.getFieldError(validationErrors, 'name')}
        readOnly={readOnly}
        actions={headerActions}
      />

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
