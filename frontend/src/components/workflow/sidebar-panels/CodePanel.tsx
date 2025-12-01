import { memo, useMemo, useState, useEffect } from 'react'
import { RotateCcw, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonEditor } from '@/components/ui/json-editor'
import { useWorkflowStore } from '@/stores'

interface CodePanelProps {
  selectedNodes: { id: string }[]
  readOnly?: boolean
}

export const CodePanel = memo(function CodePanel({
  selectedNodes,
  readOnly = false,
}: CodePanelProps) {
  const workflow = useWorkflowStore(state => state.workflow)
  const updateWorkflow = useWorkflowStore(state => state.updateWorkflow)
  
  const [codeTab, setCodeTab] = useState<'full' | 'selected'>('full')
  const [codeContent, setCodeContent] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate code content based on tab
  const generateContent = useMemo(() => {
    if (!workflow) return ''
    
    if (codeTab === 'selected' && selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id))
      const nodes = workflow.nodes.filter(n => selectedNodeIds.has(n.id))
      const connections = workflow.connections.filter(
        c => selectedNodeIds.has(c.sourceNodeId) && selectedNodeIds.has(c.targetNodeId)
      )
      return JSON.stringify({ nodes, connections }, null, 2)
    }
    
    return JSON.stringify({
      nodes: workflow.nodes,
      connections: workflow.connections,
    }, null, 2)
  }, [workflow, selectedNodes, codeTab])

  // Sync content when workflow or tab changes
  useEffect(() => {
    setCodeContent(generateContent)
    setCodeError(null)
  }, [generateContent])

  const handleReset = () => {
    setCodeContent(generateContent)
    setCodeError(null)
  }

  const handleApply = () => {
    if (readOnly) return
    try {
      const parsed = JSON.parse(codeContent)
      if (parsed.nodes && parsed.connections) {
        updateWorkflow(parsed)
        setCodeError(null)
      } else {
        setCodeError('Invalid format: must have nodes and connections')
      }
    } catch (e) {
      setCodeError('Invalid JSON')
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Tabs value={codeTab} onValueChange={(v) => setCodeTab(v as any)} className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b">
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="full" className="text-xs h-6 px-2">
            Full
          </TabsTrigger>
          <TabsTrigger 
            value="selected" 
            className="text-xs h-6 px-2"
            disabled={selectedNodes.length === 0}
          >
            Selected ({selectedNodes.length})
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} title="Copy">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset} title="Reset">
            <RotateCcw className="h-3 w-3" />
          </Button>
          {!readOnly && (
            <Button size="sm" className="h-6 text-xs px-2" onClick={handleApply}>
              Apply
            </Button>
          )}
        </div>
      </div>

      <TabsContent value="full" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto">
          <JsonEditor
            value={codeContent}
            onValueChange={(value) => {
              setCodeContent(value)
              setCodeError(null)
            }}
            error={codeError || undefined}
          />
        </div>
      </TabsContent>

      <TabsContent value="selected" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto">
          <JsonEditor
            value={codeContent}
            onValueChange={(value) => {
              setCodeContent(value)
              setCodeError(null)
            }}
            error={codeError || undefined}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
})
