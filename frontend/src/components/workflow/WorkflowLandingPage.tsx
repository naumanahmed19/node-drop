import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarContext } from '@/contexts'
import { workflowService } from '@/services'
import { Workflow as WorkflowType } from '@/types'
import { ArrowRight, Clock, FileText, Loader2, Settings, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function WorkflowLandingPage() {
  const navigate = useNavigate()
  const { setOpen } = useSidebar()
  const { setActiveWorkflowItem } = useSidebarContext()
  const [workflows, setWorkflows] = useState<WorkflowType[]>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)

  // Load recent workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setIsLoadingWorkflows(true)
        const response = await workflowService.getWorkflows({
          limit: 6,
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        })
        setWorkflows(response.data)
      } catch (error) {
        console.error('Failed to load workflows:', error)
      } finally {
        setIsLoadingWorkflows(false)
      }
    }

    loadWorkflows()
  }, [])

  const quickActions = [
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Create New Workflow",
      description: "Start from scratch",
      action: () => navigate('/workflows/new')
    },
    {
      icon: <Workflow className="w-5 h-5" />,
      title: "Browse Workflows",
      description: "View all your workflows",
      action: () => {
        // Set active sidebar item to "All Workflows" and open sidebar
        setActiveWorkflowItem({
          title: "All Workflows",
          url: "#",
          icon: Workflow,
          isActive: true,
        })
        setOpen(true)
      }
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: "View Documentation",
      description: "Learn how to use workflows",
      action: () => window.open('https://nodedrop.app', '_blank')
    }
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-background">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-6">
            <Workflow className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to NodeDrop
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Build, automate, and scale your workflows with ease
          </p>
          <button
            onClick={() => navigate('/workflows/new')}
            className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Create Your First Workflow
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-12">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="flex flex-col items-start p-4 border border-border rounded-lg hover:border-foreground/20 hover:bg-accent/50 transition-all group"
            >
              <div className="text-muted-foreground group-hover:text-foreground transition-colors mb-3">
                {action.icon}
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                {action.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
            </button>
          ))}
        </div>

        {/* Recent Workflows */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Recent Workflows</h2>
          {isLoadingWorkflows ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <Workflow className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No workflows yet. Create your first one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                  className="flex flex-col p-4 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-card-foreground line-clamp-1">
                      {workflow.name}
                    </h3>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${workflow.active
                      ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                      : 'bg-muted text-muted-foreground'
                      }`}>
                      {workflow.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {workflow.description}
                    </p>
                  )}
                  <div className="flex items-center text-xs text-muted-foreground mt-auto">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Select a workflow from the sidebar to get started, or{' '}
            <button
              onClick={() => {
                setActiveWorkflowItem({
                  title: "All Workflows",
                  url: "#",
                  icon: Workflow,
                  isActive: true,
                })
                setOpen(true)
              }}
              className="text-primary hover:text-primary/90 underline underline-offset-4"
            >
              browse all workflows
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
