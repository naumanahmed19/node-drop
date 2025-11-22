import { Button } from '@/components/ui/button'
import { executionWebSocket } from '@/services/ExecutionWebSocket'
import { WorkflowNode } from '@/types'
import {
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Radio,
  Square,
  Webhook
} from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Complete input section for webhook trigger nodes
 */
export function WebhookTriggerInput({ node }: { node: WorkflowNode }) {
  const [isListening, setIsListening] = useState(() => executionWebSocket.isConnected())
  const [isConnecting, setIsConnecting] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  
  // Build webhook URL from node parameters
  useEffect(() => {
    const webhookId = node.parameters?.webhookUrl || ''
    const webhookPath = node.parameters?.webhookPath || ''
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const baseUrl = apiUrl.replace(/\/api$/, '')
    const webhookBase = `${baseUrl}/webhook`
    
    const cleanId = webhookId?.trim() || ''
    const cleanPath = webhookPath?.trim().replace(/^\/+/, '') || ''
    
    let url = webhookBase
    if (cleanId && cleanPath) {
      url = `${webhookBase}/${cleanId}/${cleanPath}`
    } else if (cleanId) {
      url = `${webhookBase}/${cleanId}`
    } else if (cleanPath) {
      url = `${webhookBase}/${cleanPath}`
    }
    
    setWebhookUrl(`${url}?test=true`)
  }, [node.parameters])
  
  // Check connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsListening(executionWebSocket.isConnected())
    }
    
    checkConnection()
    const interval = setInterval(checkConnection, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  const startListening = async () => {
    setIsConnecting(true)
    try {
      await executionWebSocket.connect()
      setIsListening(true)
    } catch (error) {
      console.error('Failed to start listening:', error)
      setIsListening(false)
    } finally {
      setIsConnecting(false)
    }
  }
  
  const stopListening = () => {
    try {
      executionWebSocket.disconnect()
      setIsListening(false)
    } catch (error) {
      console.error('Failed to stop listening:', error)
    }
  }
  
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }
  
  const openUrl = () => {
    window.open(webhookUrl, '_blank')
  }
  
  // Check if webhook URL was successfully built (not just the base URL)
  // This updates whenever webhookUrl changes
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const baseUrl = apiUrl.replace(/\/api$/, '')
  const baseWebhookUrl = `${baseUrl}/webhook?test=true`
  const hasWebhookConfig = webhookUrl && webhookUrl !== baseWebhookUrl
  
  return (
    <div className="flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
      {/* Webhook Icon and Title */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <Webhook className={`w-10 h-10 text-blue-500 mb-2 ${isListening ? 'animate-pulse' : ''}`} />
          {isListening && (
            <Radio className="w-4 h-4 text-green-500 absolute -top-1 -right-1 animate-ping" />
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800">Webhook Trigger</p>
        <p className="text-xs text-gray-500 mt-1">
          {isListening ? 'Listening for webhook calls...' : 'Waiting to receive webhook data'}
        </p>
      </div>
      
      {/* Listen Controls */}
      {hasWebhookConfig ? (
        <WebhookListenControls
          isListening={isListening}
          isConnecting={isConnecting}
          webhookUrl={webhookUrl}
          onStartListening={startListening}
          onStopListening={stopListening}
          onCopyUrl={copyUrl}
          onOpenUrl={openUrl}
        />
      ) : (
        <div className="text-xs text-gray-500 px-4 space-y-2">
          <p>💡 Save the workflow to enable testing</p>
          <p className="text-[10px]">The webhook URL will be available after saving</p>
        </div>
      )}
    </div>
  )
}

/**
 * Webhook listen controls component
 */
function WebhookListenControls({
  isListening,
  isConnecting,
  webhookUrl,
  onStartListening,
  onStopListening,
  onCopyUrl,
  onOpenUrl,
}: {
  isListening: boolean
  isConnecting: boolean
  webhookUrl: string
  onStartListening: () => void
  onStopListening: () => void
  onCopyUrl: () => void
  onOpenUrl: () => void
}) {

  return (
    <div className="w-full px-4 space-y-3 flex flex-col items-center">
      {/* Listen Button - Centered */}
      <Button
        type="button"
        variant={isListening ? "default" : "outline"}
        size="sm"
        onClick={isListening ? onStopListening : onStartListening}
        disabled={isConnecting}
        className="h-8 px-4 text-xs"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            Connecting...
          </>
        ) : isListening ? (
          <>
            <Square className="w-3 h-3 mr-1.5" />
            Stop Listening
          </>
        ) : (
          <>
            <Play className="w-3 h-3 mr-1.5" />
            Listen for Test Event
          </>
        )}
      </Button>
      
      {isListening && (
        <p className="text-xs text-muted-foreground text-center">
          Waiting for webhook call...
        </p>
      )}
      
      {/* URL Display with Copy and Open Buttons - Centered */}
      <div className="space-y-1.5 w-full max-w-md">
        <div className="text-xs text-gray-500 font-mono break-all bg-gray-50 p-2 rounded border border-gray-200 text-center">
          {webhookUrl}
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCopyUrl}
            className="h-7 px-2 text-xs"
            title="Copy test URL"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenUrl}
            className="h-7 px-2 text-xs"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open
          </Button>
        </div>
      </div>
    </div>
  )
}
