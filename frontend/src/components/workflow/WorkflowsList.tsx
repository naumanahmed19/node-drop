import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkflowsHeader } from '@/components/workflow/WorkflowsHeader'
import { WorkflowOnboardingDialog } from '@/components/workflow/WorkflowOnboardingDialog'
import { useSidebarContext } from '@/contexts'
import { workflowService } from '@/services'
import type { Workflow } from '@/types'
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  Workflow as WorkflowIcon
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface WorkflowsListProps { }

export function WorkflowsList({ }: WorkflowsListProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    workflowsData: workflows,
    setWorkflowsData: setWorkflows,
    isWorkflowsLoaded,
    setIsWorkflowsLoaded,
    workflowsError: error,
    setWorkflowsError: setError,
    setHeaderSlot
  } = useSidebarContext()

  const [isLoading, setIsLoading] = useState(!isWorkflowsLoaded)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'categorized'>('list')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [workflowToDuplicate, setWorkflowToDuplicate] = useState<{ id: string; name: string; category?: string; saveExecutionHistory: boolean } | null>(null)
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // Extract the currently active workflow ID from URL if in editor
  const activeWorkflowId = useMemo(() => {
    // Check if we're in the workflow editor (path: /workflows/:id/edit or /workflows/:id)
    const pathMatch = location.pathname.match(/^\/workflows\/([^\/]+)(?:\/edit)?$/)
    return pathMatch ? pathMatch[1] : null
  }, [location.pathname])

  const fetchWorkflows = async (forceRefresh = false) => {
    // Don't fetch if we already have data loaded (unless force refresh)
    if (!forceRefresh && isWorkflowsLoaded && workflows.length > 0) {
      setIsLoading(false)
      return
    }

    try {
      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      // Fetch fresh data
      const response = await workflowService.getWorkflows()
      console.log(response)
      setWorkflows(response.data)
      setIsWorkflowsLoaded(true)
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setError('Failed to load workflows')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchWorkflows(true)
  }

  useEffect(() => {
    console.log('fetch workflows')
    fetchWorkflows()
  }, [isWorkflowsLoaded, setWorkflows, setIsWorkflowsLoaded, setError])

  // Filter workflows based on search term
  const filteredWorkflows = useMemo(() => {
    if (!searchTerm) return workflows


    console.log('workflows workflows', workflows)
    return workflows.filter(workflow =>
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [workflows, searchTerm])

  // Group workflows by category
  const categorizedWorkflows = useMemo(() => {
    const groups: Record<string, Workflow[]> = {}

    filteredWorkflows.forEach(workflow => {
      const category = workflow.category || 'Uncategorized'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(workflow)
    })

    // Sort categories alphabetically, but put "Uncategorized" at the end
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })

    return sortedCategories.map(category => ({
      category,
      workflows: groups[category],
      count: groups[category].length
    }))
  }, [filteredWorkflows])

  // Initialize expanded state for all categories
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {}
    categorizedWorkflows.forEach(group => {
      if (!(group.category in expandedCategories)) {
        initialExpanded[group.category] = false // Start collapsed
      }
    })
    if (Object.keys(initialExpanded).length > 0) {
      setExpandedCategories(prev => ({ ...prev, ...initialExpanded }))
    }
  }, [categorizedWorkflows, expandedCategories])

  // Set header slot for workflows
  useEffect(() => {
    setHeaderSlot(
      <WorkflowsHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        workflowCount={filteredWorkflows.length}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    )

    // Clean up header slot when component unmounts
    return () => {
      setHeaderSlot(null)
    }
  }, [setHeaderSlot, viewMode, setViewMode, filteredWorkflows.length, searchTerm, setSearchTerm, isRefreshing])

  const handleWorkflowClick = (workflowId: string) => {
    // Use replace to avoid adding to history stack and help with component reuse
    navigate(`/workflows/${workflowId}/edit`, { replace: true })
  }

  const handleWorkflowAction = async (action: string, workflowId: string, workflow: Workflow, event: React.MouseEvent) => {
    event.stopPropagation()

    if (action === 'delete') {
      const confirmed = await showConfirm({
        title: 'Delete Workflow',
        message: `Are you sure you want to delete "${workflow.name}"? This action cannot be undone.`,
        details: [
          'All workflow data will be permanently deleted',
          'Execution history will be removed',
          'This action cannot be reversed'
        ],
        confirmText: 'Delete Workflow',
        cancelText: 'Cancel',
        severity: 'danger'
      })

      if (!confirmed) return

      try {
        await workflowService.deleteWorkflow(workflowId)

        // Remove the workflow from the local state
        setWorkflows(workflows.filter(w => w.id !== workflowId))

        // If we're currently viewing this workflow, navigate away
        if (activeWorkflowId === workflowId) {
          navigate('/')
        }
      } catch (error) {
        console.error('Failed to delete workflow:', error)
        setError('Failed to delete workflow. Please try again.')
      }
    } else if (action === 'edit') {
      handleWorkflowClick(workflowId)
    } else if (action === 'duplicate') {
      // Open the onboarding dialog for duplication
      setWorkflowToDuplicate({
        id: workflowId,
        name: workflow.name,
        category: workflow.category,
        saveExecutionHistory: workflow.settings?.saveExecutionToDatabase ?? true
      })
      setDuplicateDialogOpen(true)
    }
  }

  const handleDuplicateWorkflow = async (data: {
    name: string
    category: string
    saveExecutionHistory: boolean
  }) => {
    if (!workflowToDuplicate) return

    try {
      // Call the duplicate API
      const duplicatedWorkflow = await workflowService.duplicateWorkflow(
        workflowToDuplicate.id,
        data.name
      )
      
      // Update the duplicated workflow with the selected category if different
      if (data.category && data.category !== duplicatedWorkflow.category) {
        await workflowService.updateWorkflow(duplicatedWorkflow.id, {
          category: data.category
        })
        duplicatedWorkflow.category = data.category
      }
      
      // Add the new workflow to the list
      setWorkflows([duplicatedWorkflow, ...workflows])
      
      // Close the dialog
      setDuplicateDialogOpen(false)
      setWorkflowToDuplicate(null)
      
      // Navigate to the new workflow
      navigate(`/workflows/${duplicatedWorkflow.id}/edit`)
    } catch (error) {
      console.error('Failed to duplicate workflow:', error)
      setError('Failed to duplicate workflow. Please try again.')
      setDuplicateDialogOpen(false)
      setWorkflowToDuplicate(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <WorkflowIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (filteredWorkflows.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <WorkflowIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">
            {searchTerm ? 'No workflows match your search' : 'No workflows found'}
          </p>
          {!searchTerm && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => navigate('/workflows/new')}
            >
              Create Your First Workflow
            </Button>
          )}
        </div>
      </div>
    )
  }

  const renderWorkflowItem = (workflow: Workflow) => {
    const isActive = activeWorkflowId === workflow.id

    return (
      <div
        key={workflow.id}
        className={`
          border-b last:border-b-0 cursor-pointer group transition-colors
          ${isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-l-primary'
            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }
        `}
        onClick={() => handleWorkflowClick(workflow.id)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <WorkflowIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h4 className="text-sm font-medium truncate">{workflow.name}</h4>
              <span
                className={`w-2 h-2 rounded-full mr-2 ${workflow.active ? 'bg-green-500' : 'bg-muted-foreground'
                  }`}
                title={workflow.active ? "Active" : "Inactive"}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => handleWorkflowAction('edit', workflow.id, workflow, e)}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => handleWorkflowAction('duplicate', workflow.id, workflow, e)}
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => handleWorkflowAction('delete', workflow.id, workflow, e)}
                  className="text-red-600"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {workflow.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {workflow.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(workflow.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                <span>{workflow.nodes?.length || 0} nodes</span>
              </div>
            </div>

            {workflow.category && (
              <Badge variant="outline" className="text-xs h-4">
                {workflow.category}
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-0">
        {/* Content */}
        <div className="space-y-0">
          {viewMode === 'list' ? (
            // Regular list view
            filteredWorkflows.map((workflow) => renderWorkflowItem(workflow))
          ) : (
            // Categorized view
            categorizedWorkflows.map((group) => (
              <Collapsible
                key={group.category}
                open={expandedCategories[group.category]}
                onOpenChange={(open) => {
                  if (open) {
                    // Close all other categories when opening this one
                    const newState: Record<string, boolean> = {}
                    Object.keys(expandedCategories).forEach(key => {
                      newState[key] = key === group.category
                    })
                    setExpandedCategories(newState)
                  } else {
                    // Just close this category
                    setExpandedCategories(prev => ({
                      ...prev,
                      [group.category]: false
                    }))
                  }
                }}
                className="border-b last:border-b-0"
              >
                {/* Category Header */}
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    {expandedCategories[group.category] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {group.category}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs h-5">
                    {group.count}
                  </Badge>
                </CollapsibleTrigger>

                {/* Category Workflows */}
                <CollapsibleContent className="space-y-0">
                  {group.workflows.map((workflow) => renderWorkflowItem(workflow))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog />
      <WorkflowOnboardingDialog
        isOpen={duplicateDialogOpen}
        onStartBuilding={handleDuplicateWorkflow}
        onClose={() => {
          setDuplicateDialogOpen(false)
          setWorkflowToDuplicate(null)
        }}
        defaultName={workflowToDuplicate ? `${workflowToDuplicate.name} (Copy)` : 'My Workflow'}
        defaultCategory={workflowToDuplicate?.category || ''}
        defaultSaveExecutionHistory={workflowToDuplicate?.saveExecutionHistory ?? true}
      />
    </>
  )
}
