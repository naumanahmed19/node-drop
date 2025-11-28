import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useNodeConfigDialogStore, useWorkflowStore } from '@/stores'
import { useNodeTypes } from '@/stores/nodeTypes'
import { NodeExecutionResult, NodeType } from '@/types'
import {
  FileText
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { InputsColumn } from '../node-config/InputsColumn'
import { MiddleColumn } from '../node-config/MiddleColumn'
import { OutputColumn } from '../node-config/OutputColumn'

interface InspectTabContentProps {
  displayResults: NodeExecutionResult[]
}

export function InspectTabContent({ displayResults }: InspectTabContentProps) {
  const { workflow, selectedNodeId } = useWorkflowStore()
  const { activeNodeTypes } = useNodeTypes()
  const { openDialog } = useNodeConfigDialogStore()

  // Get the currently selected node from the canvas
  const selectedNode = useMemo(() => {
    if (!workflow || !selectedNodeId) return null
    return workflow.nodes.find(n => n.id === selectedNodeId)
  }, [workflow, selectedNodeId])

  const selectedNodeType = useMemo(() => {
    if (!selectedNode) return null
    return activeNodeTypes.find((nt: NodeType) => nt.identifier === selectedNode.type)
  }, [selectedNode, activeNodeTypes])

  // Initialize dialog store when node is selected
  useEffect(() => {
    if (selectedNode && selectedNodeType) {
      openDialog(selectedNode, selectedNodeType)
    }
  }, [selectedNode, selectedNodeType, openDialog])

  if (displayResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Execution Data</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to inspect node data
        </p>
      </div>
    )
  }

  if (!selectedNode || !selectedNodeType) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Node Selected</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Select a node from the canvas to inspect its configuration and data
        </p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Column - Inputs */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
          <InputsColumn node={selectedNode} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Column - Node Configuration */}
        <ResizablePanel defaultSize={25} minSize={25} maxSize={25}>
          <MiddleColumn 
            node={selectedNode} 
            nodeType={selectedNodeType}
            onDelete={() => {}}
            onExecute={() => {}}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Column - Outputs */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <OutputColumn node={selectedNode} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
