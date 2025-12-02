import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarContext } from '@/contexts'
import { workflowService } from '@/services'
import { Workflow as WorkflowType } from '@/types'
import { ArrowRight, Clock, FileText, Loader2, Settings, Star, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function WorkflowLandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
      action: () => navigate('/workflows/new', { state: { from: location.pathname } })
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
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => navigate('/workflows/new', { state: { from: location.pathname } })}
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Your First Workflow
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <a
              href="https://github.com/node-drop/nodedrop"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 border border-border rounded-lg hover:bg-accent transition-colors group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-sm font-medium">Star on GitHub</span>
              <Star className="w-4 h-4 group-hover:fill-current transition-all" />
            </a>
          </div>
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
