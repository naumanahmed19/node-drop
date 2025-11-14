import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Terminal, Clock, FileText, Table, Code } from 'lucide-react'

interface DataPreviewOutputProps {
  data: any
}

/**
 * Custom output component for Data Preview node
 * Displays data in a terminal-like collapsible format
 */
export function DataPreviewOutput({ data }: DataPreviewOutputProps) {
  if (!data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No data to preview</p>
      </div>
    )
  }

  const preview = data?.preview as string
  const format = data?.format as string
  const lineCount = data?.lineCount as number
  const timestamp = data?.timestamp as string
  const metadata = data?.metadata

  const getFormatIcon = () => {
    switch (format) {
      case 'json':
      case 'json-compact':
        return <Code className="w-4 h-4" />
      case 'table':
        return <Table className="w-4 h-4" />
      case 'text':
        return <FileText className="w-4 h-4" />
      default:
        return <Terminal className="w-4 h-4" />
    }
  }

  const getFormatLabel = () => {
    switch (format) {
      case 'json':
        return 'JSON (Pretty)'
      case 'json-compact':
        return 'JSON (Compact)'
      case 'table':
        return 'Table'
      case 'text':
        return 'Text'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="space-y-3">
      {/* Terminal-like Preview Card */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Terminal Header */}
        <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-medium">Data Preview</span>
          </div>
          <div className="flex items-center space-x-2">
            {timestamp && (
              <div className="flex items-center space-x-1 text-xs text-gray-300">
                <Clock className="w-3 h-3" />
                <span>{new Date(timestamp).toLocaleTimeString()}</span>
              </div>
            )}
            <Badge variant="secondary" className="text-xs">
              {lineCount} {lineCount === 1 ? 'line' : 'lines'}
            </Badge>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="bg-gray-900 text-gray-100">
          <ScrollArea className="h-96 w-full">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {preview || 'No preview available'}
            </pre>
          </ScrollArea>
        </div>

        {/* Terminal Footer with Metadata */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              {getFormatIcon()}
              <div>
                <p className="text-gray-500">Format:</p>
                <p className="text-gray-900 font-medium">{getFormatLabel()}</p>
              </div>
            </div>
            
            {metadata && (
              <>
                <div>
                  <p className="text-gray-500">Input Items:</p>
                  <p className="text-gray-900 font-medium">{metadata.inputItems}</p>
                </div>
                <div>
                  <p className="text-gray-500">Data Type:</p>
                  <p className="text-gray-900 font-medium">
                    {metadata.isArray ? 'Array' : metadata.dataType}
                  </p>
                </div>
                {metadata.truncated && (
                  <div className="col-span-2">
                    <Badge variant="outline" className="text-xs">
                      ⚠️ Output truncated
                    </Badge>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
