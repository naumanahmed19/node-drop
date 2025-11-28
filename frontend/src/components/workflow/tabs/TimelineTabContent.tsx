import { ExecutionFlowStatus, NodeExecutionResult } from '@/types'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Clock, Activity, CheckCircle2, XCircle, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflow'

interface TimelineTabContentProps {
  flowExecutionStatus?: ExecutionFlowStatus | null
  realTimeResults: Map<string, NodeExecutionResult>
}

interface TimelineEvent {
  nodeId: string
  nodeName: string
  nodeType: string
  startTime: number
  endTime: number | null
  duration: number
  status: string
  index: number
}

export function TimelineTabContent({
  flowExecutionStatus,
  realTimeResults,
}: TimelineTabContentProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const { workflow } = useWorkflowStore()

  const timelineData = useMemo(() => {
    const nodeResults = Array.from(realTimeResults.entries())
    if (nodeResults.length === 0) return null

    const now = Date.now()
    const events: TimelineEvent[] = nodeResults
      .map(([nodeId, result], index) => {
        const node = workflow?.nodes.find((n) => n.id === nodeId)
        const startTime = result.startTime
          ? new Date(result.startTime).getTime()
          : 0
        
        // Handle endTime - if it's before startTime, treat as still running
        let endTime: number | null = null
        let duration = 0
        
        if (result.endTime) {
          const parsedEndTime = new Date(result.endTime).getTime()
          // Check if endTime is valid (after startTime)
          if (parsedEndTime > startTime) {
            endTime = parsedEndTime
            duration = endTime - startTime
          } else {
            // Invalid endTime (before startTime), treat as running
            endTime = null
            duration = now - startTime
          }
        } else {
          // No endTime, still running
          duration = now - startTime
        }

        return {
          nodeId,
          nodeName: node?.name || nodeId,
          nodeType: node?.type || 'unknown',
          startTime,
          endTime,
          duration,
          status: result.status || 'running',
          index,
        }
      })
      .filter((e) => e.startTime > 0)

    if (events.length === 0) return null

    const minTime = Math.min(...events.map((e) => e.startTime))
    const maxTime = Math.max(...events.map((e) => e.endTime || now))
    const totalDuration = maxTime - minTime

    return { events, minTime, maxTime, totalDuration }
  }, [realTimeResults, workflow])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}m`
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const ms = date.getMilliseconds().toString().padStart(3, '0')
    return `${timeStr}.${ms}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-red-600" />
      case 'skipped':
        return <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
      case 'running':
        return <Activity className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-700'
      case 'error':
        return 'bg-red-500 dark:bg-red-600 border-red-600 dark:border-red-700'
      case 'skipped':
        return 'bg-yellow-500 dark:bg-yellow-600 border-yellow-600 dark:border-yellow-700'
      case 'running':
        return 'bg-blue-500 dark:bg-blue-600 border-blue-600 dark:border-blue-700'
      default:
        return 'bg-gray-500 dark:bg-gray-600 border-gray-600 dark:border-gray-700'
    }
  }

  if (!flowExecutionStatus || !timelineData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Timeline Data</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to see the execution timeline
        </p>
      </div>
    )
  }

  const { events, minTime, maxTime, totalDuration } = timelineData

  // Chart dimensions
  const rowHeight = 48
  const yAxisWidth = 220
  const xAxisHeight = 60
  const chartPadding = 40 // Padding on left and right of chart
  const baseChartWidth = Math.max(800, window.innerWidth - yAxisWidth - 100)
  const chartWidth = baseChartWidth * zoom
  const effectiveChartWidth = chartWidth - chartPadding * 2

  // Add 5% padding to time range for better visibility
  const timePadding = totalDuration * 0.05
  const displayMinTime = minTime - timePadding
  const displayMaxTime = maxTime + timePadding
  const displayDuration = displayMaxTime - displayMinTime

  // Generate time ticks
  const numTicks = Math.max(6, Math.floor(chartWidth / 150))
  const timeStep = displayDuration / numTicks
  const timeTicks = Array.from({ length: numTicks + 1 }, (_, i) => displayMinTime + i * timeStep)

  // Debug logging
  console.log('=== Timeline Debug ===')
  console.log('Chart dimensions:', {
    chartWidth,
    effectiveChartWidth,
    chartPadding,
    baseChartWidth,
    zoom,
  })
  console.log('Time range:', {
    minTime: new Date(minTime).toISOString(),
    maxTime: new Date(maxTime).toISOString(),
    totalDuration,
    displayMinTime: new Date(displayMinTime).toISOString(),
    displayMaxTime: new Date(displayMaxTime).toISOString(),
    displayDuration,
  })
  console.log('Events:', events.map(e => ({
    nodeName: e.nodeName,
    startTime: new Date(e.startTime).toISOString(),
    endTime: e.endTime ? new Date(e.endTime).toISOString() : 'null',
    duration: e.duration,
    x: chartPadding + ((e.startTime - displayMinTime) / displayDuration) * effectiveChartWidth,
    width: Math.max(4, (e.duration / displayDuration) * effectiveChartWidth),
  })))

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm mb-1">Execution Timeline</h4>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Total Duration: {formatDuration(totalDuration)}</span>
              <span>•</span>
              <span>{events.length} nodes</span>
              <span>•</span>
              <span>Status: {flowExecutionStatus.overallStatus}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-2 border rounded hover:bg-accent transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              className="p-2 border rounded hover:bg-accent transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            {/* Y-Axis (Node Names) */}
            <div
              className="flex-shrink-0 border-r bg-muted/30 sticky left-0 z-10"
              style={{ width: yAxisWidth }}
            >
              {/* Y-Axis Header */}
              <div
                className="border-b bg-background flex items-center px-4 font-semibold text-xs text-muted-foreground"
                style={{ height: xAxisHeight }}
              >
                Node Name
              </div>

              {/* Y-Axis Labels */}
              {events.map((event) => (
                <div
                  key={event.nodeId}
                  className={cn(
                    'border-b px-4 flex items-center gap-2 transition-colors',
                    hoveredNodeId === event.nodeId && 'bg-muted'
                  )}
                  style={{ height: rowHeight }}
                  onMouseEnter={() => setHoveredNodeId(event.nodeId)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  {getStatusIcon(event.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">
                      {event.nodeName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {event.nodeType}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart Area */}
            <div className="flex-1" style={{ width: chartWidth }}>
              {/* X-Axis (Time) */}
              <div
                className="border-b bg-background relative"
                style={{ height: xAxisHeight }}
              >
                {timeTicks.map((tick, i) => {
                  const x = chartPadding + ((tick - displayMinTime) / displayDuration) * effectiveChartWidth
                  return (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center"
                      style={{ left: x, transform: 'translateX(-50%)' }}
                    >
                      <div className="h-2 w-px bg-border" />
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(tick)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Timeline Rows */}
              <div className="relative">
                {/* Grid Lines */}
                {timeTicks.map((tick, i) => {
                  const x = chartPadding + ((tick - displayMinTime) / displayDuration) * effectiveChartWidth
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-border/30"
                      style={{ left: x }}
                    />
                  )
                })}

                {/* Timeline Bars */}
                <TooltipProvider delayDuration={200}>
                  {events.map((event) => {
                    const y = events.indexOf(event) * rowHeight
                    const x =
                      chartPadding +
                      ((event.startTime - displayMinTime) / displayDuration) * effectiveChartWidth
                    const width = Math.max(4, (event.duration / displayDuration) * effectiveChartWidth)
                    const isHovered = hoveredNodeId === event.nodeId

                    return (
                      <div
                        key={event.nodeId}
                        className={cn('absolute border-b transition-colors', isHovered && 'bg-muted')}
                        style={{
                          top: y,
                          left: 0,
                          right: 0,
                          height: rowHeight,
                        }}
                        onMouseEnter={() => setHoveredNodeId(event.nodeId)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="relative h-full flex items-center">
                          {/* Timeline Bar with Tooltip */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'absolute rounded border-2 transition-all cursor-pointer',
                                  getStatusColor(event.status),
                                  isHovered ? 'opacity-100 shadow-lg' : 'opacity-90'
                                )}
                                style={{
                                  left: x,
                                  width: width,
                                  height: 28,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                }}
                              >
                                {/* Bar Label */}
                                {width > 60 && (
                                  <div className="absolute inset-0 flex items-center px-2">
                                    <span className="text-xs font-medium text-white truncate">
                                      {formatDuration(event.duration)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] bg-white dark:bg-white text-gray-900 dark:text-gray-900 border-gray-200">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-sm text-gray-900">{event.nodeName}</span>
                                  <Badge variant="outline" className="text-xs border-gray-300 text-gray-700">
                                    {event.status}
                                  </Badge>
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-600">Duration:</span>
                                    <span className="font-medium text-gray-900">
                                      {formatDuration(event.duration)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-600">Start:</span>
                                    <span className="font-medium text-gray-900">
                                      {formatTimestamp(event.startTime)}
                                    </span>
                                  </div>
                                  {event.endTime && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-gray-600">End:</span>
                                      <span className="font-medium text-gray-900">
                                        {formatTimestamp(event.endTime)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-600">Type:</span>
                                    <span className="font-medium text-gray-900">{event.nodeType}</span>
                                  </div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 border-t px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500 dark:bg-green-600 border-2 border-green-600" />
            <span className="text-muted-foreground">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500 dark:bg-red-600 border-2 border-red-600" />
            <span className="text-muted-foreground">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500 dark:bg-yellow-600 border-2 border-yellow-600" />
            <span className="text-muted-foreground">Skipped</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500 dark:bg-blue-600 border-2 border-blue-600" />
            <span className="text-muted-foreground">Running</span>
          </div>
        </div>
      </div>
    </div>
  )
}
