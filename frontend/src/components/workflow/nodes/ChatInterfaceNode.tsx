import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExecutionControls } from '@/hooks/workflow'
import { useWorkflowStore } from '@/stores'
import { Node, NodeProps } from '@xyflow/react'
import { MessageCircle, Send, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BaseNodeWrapper } from './BaseNodeWrapper'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceNodeData extends Record<string, unknown> {
  label: string
  nodeType: string
  parameters: Record<string, any>
  disabled: boolean
  locked?: boolean
  status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'
  executionResult?: any
  lastExecutionData?: any
  // Dynamic handles from node definition
  inputs?: string[]
  outputs?: string[]
  executionCapability?: 'trigger' | 'action' | 'transform' | 'condition'
  // Custom properties for chat
  icon?: string
  color?: string
}

type ChatInterfaceNodeType = Node<ChatInterfaceNodeData>

export const ChatInterfaceNode = memo(function ChatInterfaceNode({ data, selected, id }: NodeProps<ChatInterfaceNodeType>) {
  const { executionState, updateNode, workflow, lastExecutionResult } = useWorkflowStore()
  const { executeWorkflow } = useExecutionControls()
  // For chat nodes, only set read-only during actual execution, not just when execution ID exists
  const isReadOnly = false // Chat should always be interactive
  const isExecuting = executionState.status === 'running'
  
  // Memoize parameters object to prevent recreation on every render
  const parameters = useMemo(() => data.parameters || {}, [data.parameters])
  
  // Track expanded state (stored in node parameters to persist)
  const [isExpanded, setIsExpanded] = useState(parameters.isExpanded ?? false)
  
  // Get parameters from node configuration
  const placeholder = useMemo(() => parameters.placeholder || 'Type a message...', [parameters.placeholder])
  
  // State for input and UI
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [lastProcessedExecutionId, setLastProcessedExecutionId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false) // Prevent infinite loops

  // Memoize stored messages to prevent unnecessary recalculations
  const storedMessages = useMemo(() => 
    (parameters.conversationHistory as Message[]) || [],
    [parameters.conversationHistory]
  )

  // Get connected node's output (e.g., OpenAI response)
  const getConnectedNodeResponse = useCallback(() => {
    if (!workflow || !lastExecutionResult) return null
    
    // Find connections where this chat node is the source
    const outgoingConnections = workflow.connections.filter(
      conn => conn.sourceNodeId === id
    )
    
    if (outgoingConnections.length === 0) return null
    
    // Get the first connected node's execution result
    const connectedNodeId = outgoingConnections[0].targetNodeId
    const connectedNodeExecution = lastExecutionResult.nodeResults?.find(
      nr => nr.nodeId === connectedNodeId
    )
    
    if (!connectedNodeExecution || !connectedNodeExecution.data) return null
    
    // Extract response from the execution data
    let data = connectedNodeExecution.data
    
    // If data has a 'main' output array, get the first item's json
    if (data.main && Array.isArray(data.main) && data.main.length > 0) {
      const mainOutput = data.main[0]
      if (mainOutput.json) {
        data = mainOutput.json
      }
    }
    
    // Try different response formats
    if (data.response) return data.response
    if (data.message) return data.message
    if (data.text) return data.text
    
    // If output is an array, get first item
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0]
      return firstItem.response || firstItem.message || firstItem.text || JSON.stringify(firstItem)
    }
    
    return null
  }, [workflow, lastExecutionResult, id])

  // Append new messages from execution to conversation history
  useEffect(() => {
    if (!lastExecutionResult || !workflow) return
    
    const executionId = lastExecutionResult.executionId
    
    // Don't process the same execution twice
    if (executionId === lastProcessedExecutionId) return
    
    // Prevent infinite loops - if already processing, exit
    if (processingRef.current) return
    
    // Only process execution results for THIS specific chat node
    const triggerNodeId = lastExecutionResult.triggerNodeId
    
    // If triggerNodeId is set and doesn't match this node, ignore this execution
    if (triggerNodeId && triggerNodeId !== id) return
    
    // Set processing flag
    processingRef.current = true
    
    const chatNodeResult = lastExecutionResult.nodeResults?.find(nr => nr.nodeId === id)
    
    if (!chatNodeResult) {
      setLastProcessedExecutionId(executionId)
      processingRef.current = false
      return
    }
    
    if (chatNodeResult && chatNodeResult.data) {
      // Get user message from node parameters (we set it before execution)
      // Find the node in the workflow to get its current parameters
      const chatNode = workflow.nodes.find(n => n.id === id)
      const userMessage = chatNode?.parameters?.userMessage
      
      if (userMessage) {
        const currentMessages = (parameters.conversationHistory as Message[]) || []
        
        // Check if we already have a user message with this execution ID
        const userMsgId = `${executionId}-user`
        const hasUserMsg = currentMessages.some(msg => msg.id === userMsgId)
        
        // Get AI response if available
        const aiResponse = getConnectedNodeResponse()
        const assistantMsgId = `${executionId}-assistant`
        const hasAssistantMsg = currentMessages.some(msg => msg.id === assistantMsgId)
        
        // If both messages already exist, we're done
        if (hasUserMsg && (hasAssistantMsg || !aiResponse)) {
          setLastProcessedExecutionId(executionId)
          processingRef.current = false
          return
        }
        
        let updatedHistory = [...currentMessages]
        
        // Replace temporary user message with permanent one (if not already added)
        if (!hasUserMsg) {
          // Find and remove any temporary user message
          updatedHistory = updatedHistory.filter(msg => !msg.id.startsWith('temp-'))
          
          // Add permanent user message
          updatedHistory.push({
            id: userMsgId,
            role: 'user',
            content: typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage),
            timestamp: new Date(chatNodeResult.startTime || Date.now())
          })
        }
        
        // Add AI response if available and not already added
        if (aiResponse && !hasAssistantMsg) {
          updatedHistory.push({
            id: assistantMsgId,
            role: 'assistant',
            content: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
            timestamp: new Date(chatNodeResult.endTime || Date.now())
          })
        }
        
        // Update node parameters with new conversation history
        updateNode(id, {
          parameters: {
            ...parameters,
            conversationHistory: updatedHistory
          }
        })
        
        setLastProcessedExecutionId(executionId)
        
        // Clear processing flag after a short delay to prevent immediate re-trigger
        setTimeout(() => {
          processingRef.current = false
        }, 100)
      } else {
        // Clear processing flag if no user message
        processingRef.current = false
      }
    } else {
      // Clear processing flag if no chat result data
      processingRef.current = false
    }
    // Only depend on lastExecutionResult changes - not on workflow or parameters
    // We get workflow from the closure scope, don't need it as dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastExecutionResult, id])

  // Memoize display messages array reference
  const displayMessages: Message[] = useMemo(() => storedMessages, [storedMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      // Direct scroll without looking for nested elements
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [displayMessages.length, isTyping])

  // Turn off typing indicator when execution completes and we have a response
  useEffect(() => {
    if (!isExecuting && isTyping) {
      const aiResponse = getConnectedNodeResponse()
      if (aiResponse || executionState.status === 'error') {
        setIsTyping(false)
      }
    }
  }, [isExecuting, isTyping, executionState.status, getConnectedNodeResponse])

  // Refocus input after execution completes
  useEffect(() => {
    if (!isExecuting && !isTyping && isExpanded) {
      // Small delay to ensure the input is enabled
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isExecuting, isTyping, isExpanded])

  // Handle expand/collapse toggle
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    // Save expanded state to node parameters
    updateNode(id, {
      parameters: {
        ...parameters,
        isExpanded: newExpanded
      }
    })
  }, [isExpanded, id, parameters, updateNode])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isExecuting) return
    
    const messageToSend = inputValue
    setInputValue('')
    setIsTyping(true)

    // Refocus the input after clearing
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)

    try {
      // Optimistically add user message to conversation history immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced after execution
        role: 'user',
        content: messageToSend,
        timestamp: new Date()
      }
      
      const updatedHistory = [...storedMessages, userMessage]
      
      updateNode(id, {
        parameters: {
          ...parameters,
          userMessage: messageToSend,
          conversationHistory: updatedHistory
        },
        disabled: false
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      
      await executeWorkflow(id)
      
      setIsTyping(false)
    } catch (error) {
      setIsTyping(false)
      
      // Add error message to conversation history
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error: Failed to execute workflow. ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      
      const updatedHistory = [...storedMessages, errorMessage]
      updateNode(id, {
        parameters: {
          ...parameters,
          conversationHistory: updatedHistory
        }
      })
    }
  }, [inputValue, isExecuting, id, parameters, updateNode, executeWorkflow, storedMessages])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleClearChat = useCallback(() => {
    // Clear conversation history
    updateNode(id, {
      parameters: {
        ...parameters,
        conversationHistory: []
      }
    })
  }, [id, parameters, updateNode])

  // Memoize header info to prevent recalculation
  const headerInfo = useMemo(() => 
    displayMessages.length > 0 
      ? `${displayMessages.length} message${displayMessages.length !== 1 ? 's' : ''}`
      : undefined,
    [displayMessages.length]
  )

  // Memoize expanded content JSX to prevent recreation on every render
  const expandedContent = useMemo(() => (
    <>
      {/* Chat Messages Area */}
      <div
        ref={scrollAreaRef}
        className="h-[250px] p-3 overflow-y-auto"
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-xs text-center">Type a message below to start</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-1 ${
                  message.role === 'user' ? 'items-start' : 'items-end'
                }`}
              >
                <div
                  className={`rounded-lg px-3 py-2 max-w-[75%] ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  <p className="text-xs whitespace-pre-wrap">
                    {typeof message.content === 'string' 
                      ? message.content 
                      : JSON.stringify(message.content)}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground px-1">
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <div className="rounded-lg px-3 py-2 bg-secondary text-foreground">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="border-t ">
        {/* Clear chat button - only show when there are messages */}
        {displayMessages.length > 0 && (
          <div className="px-3 pt-2 pb-1 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearChat}
              disabled={isExecuting}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear chat
            </Button>
          </div>
        )}
        
        <div className="p-3 pt-2">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={isExecuting ? 'Processing...' : placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onContextMenu={(e) => e.stopPropagation()}
              disabled={isTyping || isExecuting}
              className="h-10 text-sm pr-10"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || isExecuting}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-accent"
            >
              {isExecuting ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-primary" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  ), [displayMessages, isTyping, isExecuting, placeholder, inputValue, handleKeyPress, handleSendMessage, handleClearChat])

  return (
    <BaseNodeWrapper
      id={id}
      selected={selected}
      data={data}
      isReadOnly={isReadOnly}
      isExpanded={isExpanded}
      onToggleExpand={handleToggleExpand}
      Icon={MessageCircle}
      iconColor="bg-blue-500"
      headerInfo={headerInfo}
      expandedContent={expandedContent}
      showInputHandle={true}
      showOutputHandle={true}
      inputHandleColor="!bg-blue-500"
      outputHandleColor="!bg-green-500"
    />
  )
})
