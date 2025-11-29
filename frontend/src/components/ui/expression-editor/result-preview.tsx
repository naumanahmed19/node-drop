"use client"

import { CheckCircle2, XCircle, AlertCircle, ChevronUp, ChevronDown } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type PreviewSize = "default" | "compact"

interface ResultPreviewProps {
  result: {
    success: boolean
    value: unknown
    type: string
    error?: string
  }
  size?: PreviewSize
  collapsible?: boolean
  defaultExpanded?: boolean
  className?: string
  onClickExpand?: () => void
}

export function formatResultValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export function ResultPreview({
  result,
  size = "default",
  collapsible = true,
  defaultExpanded = true,
  className,
  onClickExpand,
}: ResultPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!result) {
    return null
  }

  const isCompact = size === "compact"
  const formattedValue = formatResultValue(result.value)

  if (isCompact) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 rounded border transition-colors",
          result.success
            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-300 dark:hover:border-green-700"
            : "bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700",
          onClickExpand && "cursor-pointer",
          className,
        )}
        onClick={onClickExpand}
        role={onClickExpand ? "button" : undefined}
      >
        {result.success ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <pre className="font-mono text-xs whitespace-pre-wrap break-words line-clamp-3 text-foreground">
            {result.success ? formattedValue.slice(0, 250) : result.error}
          </pre>
        </div>
      </div>
    )
  }

  const HeaderContent = (
    <div className="flex items-center gap-2">
      {result.success ? (
        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
      ) : (
        <XCircle size={14} className="text-red-600 dark:text-red-400" />
      )}
      <span className="text-xs font-medium text-muted-foreground">Result</span>
      {result.success && (
        <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{result.type}</span>
      )}
    </div>
  )

  return (
    <div className={cn("border-t border-border bg-muted", className)}>
      {/* Header */}
      {collapsible ? (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full h-10 px-4 flex items-center justify-between hover:bg-accent transition-colors"
        >
          {HeaderContent}
          {isExpanded ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronUp size={14} className="text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="h-10 px-4 flex items-center">{HeaderContent}</div>
      )}

      {/* Result Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {result.success ? (
            <div className="bg-background rounded-lg p-3 border border-border max-h-32 overflow-auto">
              <pre className="font-mono text-sm text-green-600 dark:text-green-400 whitespace-pre-wrap break-all">{formattedValue}</pre>
            </div>
          ) : (
            <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-destructive/80 mt-1">{result.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
