import { memo, useMemo } from 'react'
import { Bot, Code2, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReactFlowUIStore, useWorkflowStore } from '@/stores'
import { useNodeTypes } from '@/stores/nodeTypes'
import { QuickSettingsPanel } from './sidebar-panels/QuickSettingsPanel'
import { CopilotPanel } from './sidebar-panels/CopilotPanel'
import { CodePanel } from './sidebar-panels/CodePanel'

interface RightSidebarProps {
  selectedNodes: { id: string }[]
  readOnly?: boolean
}

export const RightSidebar = memo(function RightSidebar({ 
  selectedNodes,
  readOnly = false 
}: RightSidebarProps) {
  const {
    rightSidebarTab,
    setRightSidebarTab,
    closeRightSidebar,
  } = useReactFlowUIStore()

  const workflow = useWorkflowStore(state => state.workflow)
  const { activeNodeTypes } = useNodeTypes()

  // Get selected node data
  const selectedNode = useMemo(() => {
    if (selectedNodes.length !== 1 || !workflow) return null
    return workflow.nodes.find(n => n.id === selectedNodes[0].id) || null
  }, [selectedNodes, workflow])

  // Get node type for selected node
  const selectedNodeType = useMemo(() => {
    if (!selectedNode) return null
    return activeNodeTypes.find(nt => nt.identifier === selectedNode.type) || null
  }, [selectedNode, activeNodeTypes])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background border-l">
      {/* Header with tabs */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 border-b">
        <Tabs value={rightSidebarTab} onValueChange={(v) => setRightSidebarTab(v as any)} className="flex-1">
          <TabsList className="h-8 bg-transparent p-0 gap-1">
            <TabsTrigger 
              value="settings" 
              className="h-7 px-2 data-[state=active]:bg-muted rounded-md"
              title="Quick Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger 
              value="copilot" 
              className="h-7 px-2 data-[state=active]:bg-muted rounded-md"
              title="Copilot"
            >
              <Bot className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger 
              value="code" 
              className="h-7 px-2 data-[state=active]:bg-muted rounded-md"
              title="Code View"
            >
              <Code2 className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 flex-shrink-0"
          onClick={closeRightSidebar}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tab content - must be flex-1 with min-h-0 to allow proper scrolling */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightSidebarTab === 'settings' && (
          <QuickSettingsPanel 
            node={selectedNode}
            nodeType={selectedNodeType}
            readOnly={readOnly}
          />
        )}
        {rightSidebarTab === 'copilot' && (
          <CopilotPanel />
        )}
        {rightSidebarTab === 'code' && (
          <CodePanel 
            selectedNodes={selectedNodes}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  )
})
