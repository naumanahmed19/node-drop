import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useDetachNodes } from '@/hooks/workflow'
import { useCopyPasteStore, useWorkflowStore } from '@/stores'
import { NodeProps, NodeResizer, useReactFlow } from '@xyflow/react'
import { Copy, Scissors, Trash2, Ungroup } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function AnnotationNode({ id, data, selected, parentId }: NodeProps) {
  const { updateNode, workflow, updateWorkflow, saveToHistory } = useWorkflowStore()
  const { copy, cut } = useCopyPasteStore()
  const { setNodes } = useReactFlow()
  const detachNodes = useDetachNodes()
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Get label from parameters or data
  const dataAny = data as any
  const currentLabel = (dataAny.parameters?.label || dataAny.label || 'Add your note here...') as string
  const [localText, setLocalText] = useState(currentLabel)
  
  // Check if node is in a group (parentId comes from React Flow props)
  const isInGroup = !!parentId

  // Sync local text with prop changes
  useEffect(() => {
    if (!isEditing) {
      setLocalText(currentLabel)
    }
  }, [currentLabel, isEditing])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback(() => {
    // Don't stop propagation - let React Flow handle selection
    setIsEditing(true)
  }, [])

  const handleSave = useCallback(() => {
    const trimmedText = localText.trim()
    
    if (trimmedText && trimmedText !== currentLabel) {
      updateNode(id, { 
        parameters: { 
          ...(typeof data.parameters === 'object' && data.parameters !== null ? data.parameters : {}),
          label: trimmedText
        } 
      })
    } else if (!trimmedText) {
      // Reset to previous value if empty
      setLocalText(currentLabel)
    }
    
    setIsEditing(false)
  }, [localText, currentLabel, id, updateNode, data.parameters])

  const handleCancel = useCallback(() => {
    setLocalText(currentLabel)
    setIsEditing(false)
  }, [currentLabel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation for all keys to prevent canvas from capturing them
    e.stopPropagation()
    
    // Only handle our specific keys
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
    // Let other keys (including Ctrl+C, Ctrl+V, Delete, Backspace) work normally
  }, [handleSave, handleCancel])

  // Handle clipboard events to ensure they work and don't propagate to canvas
  const handleClipboard = useCallback((e: React.ClipboardEvent) => {
    e.stopPropagation()
  }, [])

  // Handle mouse events to prevent canvas interference
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire
    setTimeout(() => {
      handleSave()
    }, 100)
  }, [handleSave])

  // Delete handler
  const handleDelete = useCallback(() => {
    if (!workflow) return
    
    saveToHistory('Delete annotation')
    
    // Remove from React Flow
    setNodes((nodes) => nodes.filter((node) => node.id !== id))
    
    // Remove from workflow store
    // Skip history since we already saved before deletion
    updateWorkflow({
      nodes: workflow.nodes.filter((node) => node.id !== id),
    }, true)
  }, [id, workflow, updateWorkflow, saveToHistory, setNodes])

  // Copy handler
  const handleCopy = useCallback(() => {
    // Select this node first
    setNodes((nodes) => 
      nodes.map((node) => ({
        ...node,
        selected: node.id === id
      }))
    )
    // Then call copy
    setTimeout(() => copy?.(), 50)
  }, [id, copy, setNodes])

  // Cut handler
  const handleCut = useCallback(() => {
    // Select this node first
    setNodes((nodes) => 
      nodes.map((node) => ({
        ...node,
        selected: node.id === id
      }))
    )
    // Then call cut
    setTimeout(() => cut?.(), 50)
  }, [id, cut, setNodes])

  // Ungroup handler
  const handleUngroup = useCallback(() => {
    detachNodes([id], undefined)
  }, [id, detachNodes])

  return (
    <>
      <NodeResizer 
        isVisible={selected}
        minWidth={100}
        minHeight={30}
      />
      {isEditing ? (
        <div className="nodrag nopan">
          <textarea
            ref={textareaRef}
            className='annotation-textarea'
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onContextMenu={(e) => e.stopPropagation()}
            onCopy={handleClipboard}
            onCut={handleClipboard}
            onPaste={handleClipboard}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            spellCheck={false}
            placeholder="Add your note here..."
          />
        </div>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div onContextMenu={(e) => e.stopPropagation()}>
              <div 
                className='annotation-display'
                onDoubleClick={handleDoubleClick}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom components for better styling - exclude ref to fix React 19 compatibility
                    h1: ({node, ref, ...props}) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                    h2: ({node, ref, ...props}) => <h2 className="text-xl font-bold mb-2" {...props} />,
                    h3: ({node, ref, ...props}) => <h3 className="text-lg font-bold mb-1" {...props} />,
                    h4: ({node, ref, ...props}) => <h4 className="text-base font-bold mb-1" {...props} />,
                    h5: ({node, ref, ...props}) => <h5 className="text-sm font-bold mb-1" {...props} />,
                    h6: ({node, ref, ...props}) => <h6 className="text-xs font-bold mb-1" {...props} />,
                    p: ({node, ref, ...props}) => <p className="mb-2" {...props} />,
                    ul: ({node, ref, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
                    ol: ({node, ref, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
                    li: ({node, ref, ...props}) => <li className="ml-2" {...props} />,
                    code: ({node, ref, inline, ...props}: any) => 
                      inline ? (
                        <code className="bg-purple-100 dark:bg-purple-900/30 px-1 rounded text-sm" {...props} />
                      ) : (
                        <code className="block bg-purple-100 dark:bg-purple-900/30 p-2 rounded text-sm my-2 overflow-x-auto" {...props} />
                      ),
                    pre: ({node, ref, ...props}) => <pre className="my-2" {...props} />,
                    blockquote: ({node, ref, ...props}) => <blockquote className="border-l-4 border-purple-500 pl-3 italic my-2" {...props} />,
                    a: ({node, ref, ...props}) => <a className="text-purple-600 dark:text-purple-400 underline hover:text-purple-800 dark:hover:text-purple-300" {...props} />,
                    strong: ({node, ref, ...props}) => <strong className="font-bold" {...props} />,
                    em: ({node, ref, ...props}) => <em className="italic" {...props} />,
                    hr: ({node, ref, ...props}) => <hr className="my-2 border-purple-300 dark:border-purple-700" {...props} />,
                    table: ({node, ref, ...props}) => <table className="border-collapse border border-purple-300 dark:border-purple-700 my-2" {...props} />,
                    thead: ({node, ref, ...props}) => <thead className="bg-purple-100 dark:bg-purple-900/30" {...props} />,
                    tbody: ({node, ref, ...props}) => <tbody {...props} />,
                    tr: ({node, ref, ...props}) => <tr className="border-b border-purple-200 dark:border-purple-800" {...props} />,
                    th: ({node, ref, ...props}) => <th className="border border-purple-300 dark:border-purple-700 px-2 py-1 font-semibold" {...props} />,
                    td: ({node, ref, ...props}) => <td className="border border-purple-300 dark:border-purple-700 px-2 py-1" {...props} />,
                  }}
                >
                  {currentLabel}
                </ReactMarkdown>
              </div>
            </div>
          </ContextMenuTrigger>
          
          <ContextMenuContent className="w-48">
            <ContextMenuItem
              onClick={handleCopy}
              className="cursor-pointer"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleCut}
              className="cursor-pointer"
            >
              <Scissors className="mr-2 h-4 w-4" />
              Cut
            </ContextMenuItem>

            {isInGroup && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={handleUngroup}
                  className="cursor-pointer"
                >
                  <Ungroup className="mr-2 h-4 w-4" />
                  Remove from Group
                </ContextMenuItem>
              </>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={handleDelete}
              className="cursor-pointer text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </>
  )
}

export default memo(AnnotationNode)
