import { useEffect, useMemo, useState } from 'react'
import { Workflow } from '@/types'

interface CodePanelNode {
  id: string
  selected?: boolean
}

interface UseCodePanelOptions {
  workflow: Workflow | null
  nodes: CodePanelNode[]
  isCodeMode: boolean
}

export function useCodePanel({ workflow, nodes, isCodeMode }: UseCodePanelOptions) {
  const [codeContent, setCodeContent] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeTab, setCodeTab] = useState<'full' | 'selected'>('full')

  // Get selected nodes from React Flow
  const selectedNodes = useMemo(() => {
    return nodes.filter(node => node.selected)
  }, [nodes])

  // Compute selected workflow (selected nodes + their connections)
  const selectedWorkflow = useMemo(() => {
    if (!workflow || selectedNodes.length === 0) return null

    const selectedNodeIds = new Set(selectedNodes.map(n => n.id))
    
    // Filter nodes
    const filteredNodes = workflow.nodes.filter(node => selectedNodeIds.has(node.id))
    
    // Filter connections - only include connections between selected nodes
    const filteredConnections = workflow.connections.filter(conn => 
      selectedNodeIds.has(conn.sourceNodeId) && selectedNodeIds.has(conn.targetNodeId)
    )

    // Return only nodes and connections
    return {
      nodes: filteredNodes,
      connections: filteredConnections
    }
  }, [workflow, selectedNodes])

  // Get current content based on active tab
  const getCurrentContent = () => {
    if (codeTab === 'selected' && selectedWorkflow) {
      return selectedWorkflow
    }
    return workflow
  }

  // Initialize code content when code panel opens
  useEffect(() => {
    if (isCodeMode && workflow) {
      const content = getCurrentContent()
      setCodeContent(JSON.stringify(content, null, 2))
      setCodeError(null)
    }
  }, [isCodeMode])

  // Update code content when workflow, tab, or selection changes (only in code mode)
  useEffect(() => {
    if (isCodeMode && workflow) {
      const content = getCurrentContent()
      setCodeContent(JSON.stringify(content, null, 2))
    }
  }, [workflow, isCodeMode, codeTab, selectedWorkflow])

  // Reset code content to current view
  const resetCodeContent = () => {
    const content = getCurrentContent()
    setCodeContent(JSON.stringify(content, null, 2))
    setCodeError(null)
  }

  // Validate and parse code content
  const validateCodeContent = () => {
    try {
      const parsed = JSON.parse(codeContent)
      
      // Basic workflow structure validation
      if (!parsed || typeof parsed !== 'object') {
        setCodeError('Workflow must be an object')
        return null
      }
      
      if (!Array.isArray(parsed.nodes)) {
        setCodeError('Workflow must have a "nodes" array')
        return null
      }
      
      if (!Array.isArray(parsed.connections)) {
        setCodeError('Workflow must have a "connections" array')
        return null
      }
      
      // Validate node structure
      for (let i = 0; i < parsed.nodes.length; i++) {
        const node = parsed.nodes[i]
        if (!node.id) {
          setCodeError(`Node at index ${i} is missing "id" field`)
          return null
        }
        if (!node.type) {
          setCodeError(`Node "${node.id}" is missing "type" field`)
          return null
        }
      }
      
      // Validate connection structure
      for (let i = 0; i < parsed.connections.length; i++) {
        const conn = parsed.connections[i]
        if (!conn.sourceNodeId) {
          setCodeError(`Connection at index ${i} is missing "sourceNodeId" field`)
          return null
        }
        if (!conn.targetNodeId) {
          setCodeError(`Connection at index ${i} is missing "targetNodeId" field`)
          return null
        }
      }
      
      setCodeError(null)
      return parsed
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Extract line number from syntax error if available
        const match = error.message.match(/at position (\d+)/)
        if (match) {
          const position = parseInt(match[1])
          const lines = codeContent.substring(0, position).split('\n')
          setCodeError(`JSON Syntax Error at line ${lines.length}: ${error.message}`)
        } else {
          setCodeError(`JSON Syntax Error: ${error.message}`)
        }
      } else {
        setCodeError(error instanceof Error ? error.message : 'Invalid JSON')
      }
      return null
    }
  }

  return {
    codeContent,
    setCodeContent,
    codeError,
    setCodeError,
    codeTab,
    setCodeTab,
    selectedNodes,
    selectedWorkflow,
    resetCodeContent,
    validateCodeContent,
  }
}
