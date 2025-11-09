import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useSidebarContext } from '@/contexts'
import { apiClient } from '@/services/api'
import { executionService, type ExecutionDetails } from '@/services/execution'
import { useWorkflowStore } from '@/stores/workflow'
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  StopCircle,
  XCircle
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ExecutionsHeader } from './ExecutionsHeader'

// Use ExecutionDetails from the service as our Execution type
type Execution = ExecutionDetails

interface ExecutionsListProps {}

export function ExecutionsList({}: ExecutionsListProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    setHeaderSlot
  } = useSidebarContext()
  const { workflow, updateWorkflow } = useWorkflowStore()
  
  const [allExecutions, setAllExecutions] = useState<Execution[]>([])
  const [workflowExecutions, setWorkflowExecutions] = useState<Execution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"workflow" | "all">("workflow")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Extract the currently active workflow ID from URL if in workflow editor
  const currentWorkflowId = useMemo(() => {
    // Match patterns: /workflows/{id}, /workflows/{id}/edit, /workflows/{id}/executions/{executionId}
    const pathMatch = location.pathname.match(/^\/workflows\/([^\/]+)/)
    return pathMatch ? pathMatch[1] : null
  }, [location.pathname])

  // Auto-switch to "all" tab when no current workflow
  useEffect(() => {
    if (!currentWorkflowId || currentWorkflowId === 'new') {
      setActiveTab("all")
    } else {
      // When viewing a specific execution, default to workflow tab to show context
      setActiveTab("workflow")
    }
  }, [currentWorkflowId])

  // Extract the currently active execution ID from URL if viewing execution details
  const activeExecutionId = useMemo(() => {
    const pathMatch = location.pathname.match(/\/executions\/([^\/]+)$/)
    return pathMatch ? pathMatch[1] : null
  }, [location.pathname])

  const fetchExecutions = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      
      // Fetch all executions
      const allExecutionsList = await executionService.listExecutions({
        status: statusFilter || undefined,
        limit: 50,
        page: 1
      })
      
      setAllExecutions(allExecutionsList)
      
      // Filter executions for current workflow if we have a workflow ID
      if (currentWorkflowId && currentWorkflowId !== 'new') {
        const workflowExecutionsList = await executionService.listExecutions({
          workflowId: currentWorkflowId,
          status: statusFilter || undefined,
          limit: 50,
          page: 1
        })
        setWorkflowExecutions(workflowExecutionsList)
      } else {
        setWorkflowExecutions([])
      }
      
    } catch (err) {
      console.error('Failed to fetch executions:', err)
      setError('Failed to load executions')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchExecutions(true)
  }

  const handleDeleteAll = () => {
    setShowDeleteDialog(true)
  }

  const confirmDeleteAll = async () => {
    setIsDeleting(true)
    
    try {
      const executionsToDelete = activeTab === 'workflow' ? workflowExecutions : allExecutions
      
      // Delete all executions
      await Promise.all(
        executionsToDelete.map(execution => 
          apiClient.delete(`/executions/${execution.id}`)
        )
      )

      // Refresh the list
      await fetchExecutions(true)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete executions:', error)
      // Keep dialog open to show error
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    fetchExecutions()
  }, [statusFilter, currentWorkflowId])

  // Get the current executions based on active tab
  const currentExecutions = useMemo(() => {
    return activeTab === "workflow" ? workflowExecutions : allExecutions
  }, [activeTab, workflowExecutions, allExecutions])

  // Filter executions based on search term
  const filteredExecutions = useMemo(() => {
    if (!searchTerm) return currentExecutions
    
    return currentExecutions.filter((execution: Execution) =>
      execution.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.workflowId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.status.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [currentExecutions, searchTerm])

  // Set header slot for executions
  useEffect(() => {
    setHeaderSlot(
      <ExecutionsHeader 
        executionCount={filteredExecutions.length}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentWorkflowId={currentWorkflowId}
        workflowExecutionCount={workflowExecutions.length}
        allExecutionCount={allExecutions.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onDeleteAll={handleDeleteAll}
      />
    )
    
    // Clean up header slot when component unmounts
    return () => {
      setHeaderSlot(null)
    }
  }, [setHeaderSlot, filteredExecutions.length, searchTerm, setSearchTerm, statusFilter, setStatusFilter, activeTab, setActiveTab, currentWorkflowId, workflowExecutions.length, allExecutions.length, isRefreshing])

  const handleExecutionClick = (executionId: string) => {
    // Find the execution to get its workflowId
    const execution = filteredExecutions.find(e => e.id === executionId)
    if (execution) {
      navigate(`/workflows/${execution.workflowId}/executions/${executionId}`)
    }
  }

  const handleExecutionAction = async (action: string, executionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    try {
      switch (action) {
        case 'cancel':
          await apiClient.post(`/executions/${executionId}/cancel`)
          // Refresh the list
          window.location.reload()
          break
        case 'retry':
          await apiClient.post(`/executions/${executionId}/retry`)
          // Refresh the list
          window.location.reload()
          break
        case 'delete':
          if (window.confirm('Are you sure you want to delete this execution?')) {
            await apiClient.delete(`/executions/${executionId}`)
            // Remove from both local states
            setAllExecutions(prev => prev.filter(exec => exec.id !== executionId))
            setWorkflowExecutions(prev => prev.filter(exec => exec.id !== executionId))
          }
          break
        default:
          console.log(`${action} execution:`, executionId)
      }
    } catch (err) {
      console.error(`Failed to ${action} execution:`, err)
      // You might want to show a toast notification here
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Less than 1 minute ago
    if (diffMins < 1) return 'Just now'
    // Less than 1 hour ago
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    // Less than 24 hours ago
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    // Less than 7 days ago
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    // More than 7 days ago, show full date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (startedAt: string, finishedAt?: string) => {
    const start = new Date(startedAt)
    const end = finishedAt ? new Date(finishedAt) : new Date()
    const durationMs = end.getTime() - start.getTime()
    
    if (durationMs < 1000) return '<1s'
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`
    return `${Math.round(durationMs / 3600000)}h`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
      case 'success':
        return <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
      case 'cancelled':
        return <StopCircle className="h-3.5 w-3.5 text-muted-foreground" />
      case 'paused':
        return <Pause className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
      case 'partial':
        return <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
      case 'cancelled':
        return 'bg-muted text-muted-foreground border-border'
      case 'paused':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800'
      case 'partial':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'border-l-blue-500 dark:border-l-blue-400'
      case 'success':
        return 'border-l-green-500 dark:border-l-green-400'
      case 'error':
        return 'border-l-red-500 dark:border-l-red-400'
      case 'cancelled':
        return 'border-l-muted-foreground'
      case 'paused':
        return 'border-l-yellow-500 dark:border-l-yellow-400'
      case 'partial':
        return 'border-l-orange-500 dark:border-l-orange-400'
      default:
        return 'border-l-muted-foreground'
    }
  }

  const renderExecutionItem = (execution: Execution) => {
    const isActive = activeExecutionId === execution.id
    const statusBorderColor = getStatusBorderColor(execution.status)
    const showWorkflowId = activeTab === 'all' // Only show workflow ID in "All Executions" tab
    
    return (
      <div
        key={execution.id}
        className={`
          group cursor-pointer transition-all duration-200 border-b last:border-b-0
          ${isActive 
            ? `bg-sidebar-accent/80 border-l-[3px] ${statusBorderColor}` 
            : `hover:bg-sidebar-accent/50 border-l-[3px] border-l-transparent hover:${statusBorderColor}`
          }
        `}
        onClick={() => handleExecutionClick(execution.id)}
      >
        <div className="p-3.5">
          {/* Execution Info with Status */}
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {formatTime(execution.startedAt)}
                </h4>
                <Badge 
                  variant="outline" 
                  className={`text-[11px] h-5 px-2 capitalize font-medium shrink-0 ${getStatusColor(execution.status)}`}
                >
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(execution.status)}
                    <span>{execution.status}</span>
                  </div>
                </Badge>
              </div>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="truncate">ID: {execution.id.slice(-12)}</span>
                {showWorkflowId && (
                  <span className="truncate">Workflow: {execution.workflowId.slice(0, 12)}...</span>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => handleExecutionAction('view', execution.id, e)}
                >
                  View Details
                </DropdownMenuItem>
                {execution.status === 'running' && (
                  <DropdownMenuItem
                    onClick={(e) => handleExecutionAction('cancel', execution.id, e)}
                  >
                    Cancel
                  </DropdownMenuItem>
                )}
                {(execution.status === 'error' || execution.status === 'cancelled') && (
                  <DropdownMenuItem
                    onClick={(e) => handleExecutionAction('retry', execution.id, e)}
                  >
                    Retry
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => handleExecutionAction('delete', execution.id, e)}
                  className="text-red-600"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground/60 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="text-[11px]">{formatDate(execution.startedAt)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                <span className="text-[11px] font-medium">{formatDuration(execution.startedAt, execution.finishedAt)}</span>
              </div>
              {execution.nodeExecutions && execution.nodeExecutions.length > 0 && (
                <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                  <Activity className="h-2.5 w-2.5" />
                  <span>{execution.nodeExecutions.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render banner for workflow tab
  const renderBanner = () => {
    if (!workflow || workflow.id !== currentWorkflowId || activeTab !== 'workflow') {
      return null
    }

    const saveExecutionEnabled = workflow.settings?.saveExecutionToDatabase !== false

    return (
      <div className={`p-3 border-b ${
        saveExecutionEnabled 
          ? 'bg-muted/30 border-border' 
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
      }`}>
        <div className="flex items-start gap-3">
          <Database className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
            saveExecutionEnabled 
              ? 'text-muted-foreground' 
              : 'text-amber-600 dark:text-amber-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${
              saveExecutionEnabled 
                ? 'text-foreground' 
                : 'text-amber-900 dark:text-amber-200'
            }`}>
              {saveExecutionEnabled ? 'Execution History Enabled' : 'Execution History Disabled'}
            </p>
            <p className={`text-xs mt-0.5 ${
              saveExecutionEnabled 
                ? 'text-muted-foreground' 
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              {saveExecutionEnabled 
                ? 'Executions are being saved to database' 
                : 'New executions won\'t be saved to database'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              checked={saveExecutionEnabled}
              onCheckedChange={async (checked) => {
                if (workflow) {
                  // Toggle execution history
                  updateWorkflow({
                    settings: {
                      ...workflow.settings,
                      saveExecutionToDatabase: checked,
                    },
                  })
                  // Note: Workflow will auto-save on changes
                  // Refresh execution list after a short delay
                  setTimeout(() => fetchExecutions(true), 500)
                }
              }}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>
      </div>
    )
  }

  // Shared component for loading, error, and empty states
  const renderContent = (isForWorkflow: boolean = false) => {
    if (isLoading) {
      return (
        <div className="p-3.5">
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b pb-3.5">
                <div className="animate-pulse">
                  {/* Status badge skeleton */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-6 w-20 bg-muted rounded"></div>
                  </div>
                  {/* Execution info skeleton */}
                  <div className="flex gap-2.5 mb-2.5">
                    <div className="h-4 w-4 bg-muted rounded mt-0.5"></div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                  {/* Metadata skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="h-3 bg-muted rounded w-20"></div>
                      <div className="h-3 bg-muted rounded w-16"></div>
                    </div>
                    <div className="h-3 w-12 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="p-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30">
              <RefreshCw className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Failed to load executions</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    if (filteredExecutions.length === 0) {
      return (
        <div className="p-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50">
              <Activity className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">
                {searchTerm || statusFilter 
                  ? 'No executions match your filters' 
                  : isForWorkflow 
                    ? 'No executions for this workflow'
                    : 'No executions found'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {isForWorkflow 
                  ? 'Run this workflow to see execution history'
                  : 'Run a workflow to see execution history'
                }
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-0">
        {filteredExecutions.map((execution) => renderExecutionItem(execution))}
      </div>
    )
  }

  const executionCount = activeTab === 'workflow' ? workflowExecutions.length : allExecutions.length

  return (
    <>
      <div className="p-0">
        {/* Show banner for workflow tab */}
        {renderBanner()}
        
        {/* Show tabs UI when we have a current workflow */}
        {currentWorkflowId && currentWorkflowId !== 'new' ? (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "workflow" | "all")} className="w-full">
            <TabsContent value="workflow" className="space-y-0 mt-0">
              {renderContent(true)}
            </TabsContent>
            
            <TabsContent value="all" className="space-y-0 mt-0">
              {renderContent(false)}
            </TabsContent>
          </Tabs>
        ) : (
          // Show all executions when no current workflow
          renderContent(false)
        )}
      </div>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Executions?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTab === 'workflow' 
                ? `This will permanently delete all ${executionCount} execution${executionCount !== 1 ? 's' : ''} for this workflow.`
                : `This will permanently delete all ${executionCount} execution${executionCount !== 1 ? 's' : ''}.`
              }
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAll}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
