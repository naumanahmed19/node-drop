import { WorkflowEditorWrapper } from '@/components'
import { BaseLayout } from '@/components/layout/BaseLayout'
import { WorkflowLandingPage } from '@/components/workflow/WorkflowLandingPage'
import { WorkflowToolbar } from '@/components/workflow/WorkflowToolbar'
import {
  useWorkflowOperations
} from '@/hooks/workflow'
import { workflowService } from '@/services'
import { useAuthStore, useWorkflowStore } from '@/stores'
import { NodeType, Workflow } from '@/types'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export function WorkflowEditorLayout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    workflow,
    setWorkflow,
    setLoading,
    isLoading
  } = useWorkflowStore()
  const { user } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([])
  const [isLoadingNodeTypes, setIsLoadingNodeTypes] = useState(true)

  // Workflow operations for toolbar
  const {
    saveWorkflow
  } = useWorkflowOperations()

  // Toolbar handlers
  const handleSave = async () => {
    await saveWorkflow()
  }

  // Load node types from backend - only once
  useEffect(() => {
    if (nodeTypes.length > 0) return // Already loaded

    const loadNodeTypes = async () => {
      try {
        setIsLoadingNodeTypes(true)
        const types = await workflowService.getNodeTypes()
        setNodeTypes(types)
      } catch (error) {
        console.error('Failed to load node types:', error)
        setError('Failed to load node types. Please refresh the page.')
      } finally {
        setIsLoadingNodeTypes(false)
      }
    }

    loadNodeTypes()
  }, [nodeTypes.length])

  // Load workflow when ID changes
  useEffect(() => {
    const loadWorkflow = async () => {
      if (!id) {
        // No workflow selected - show landing page
        setWorkflow(null)
        return
      }

      if (id === 'new') {
        // Create new workflow
        const newWorkflow: Workflow = {
          id: 'new',
          name: 'New Workflow',
          description: '',
          userId: user?.id || 'guest',
          nodes: [],
          connections: [],
          settings: {
            timezone: 'UTC',
            saveDataErrorExecution: 'all',
            saveDataSuccessExecution: 'all',
            saveManualExecutions: true,
            callerPolicy: 'workflowsFromSameOwner'
          },
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setWorkflow(newWorkflow)
        return
      }

      // Only load if it's a different workflow
      if (workflow && workflow.id === id) {
        return // Already loaded
      }

      try {
        setLoading(true)
        setError(null)
        const workflowData = await workflowService.getWorkflow(id)
        setWorkflow(workflowData)
      } catch (err) {
        console.error('Failed to load workflow:', err)
        setError('Failed to load workflow. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadWorkflow()
  }, [id, setWorkflow, setLoading, user?.id])

  if (isLoadingNodeTypes) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading node types...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Workflow</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/workflows')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    )
  }

  return (
    <BaseLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading workflow...</span>
          </div>
        </div>
      ) : !id ? (
        // Show landing page when no workflow is selected
        <WorkflowLandingPage />
      ) : !workflow ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Workflow Not Found</h2>
            <p className="text-gray-600 mb-4">The requested workflow could not be found.</p>
            <button
              onClick={() => navigate('/workflows')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Workflows
            </button>
          </div>
        </div>
      ) : (
        <>
          <WorkflowToolbar 
            onSave={handleSave}
          />
          <div className="flex flex-1 flex-col h-full overflow-hidden">
            <WorkflowEditorWrapper nodeTypes={nodeTypes} />
          </div>
        </>
      )}
    </BaseLayout>
  )
}
