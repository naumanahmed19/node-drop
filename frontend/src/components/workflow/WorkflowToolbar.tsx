
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAddNodeDialogStore, useWorkflowStore, useWorkflowToolbarStore } from '@/stores'
import { useEnvironmentStore } from '@/stores/environment'
import { getEnvironmentLabel } from '@/types/environment'
import { validateImportFile } from '@/utils/errorHandling'
import {
  ChevronDown,
  Download,
  Loader2,
  MoreHorizontal,
  Package,
  RefreshCw,
  Save,
  Settings,
  Upload
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ManualDeploymentDialog } from '../environment/ManualDeploymentDialog'
import { UpdateEnvironmentDialog } from '../environment/UpdateEnvironmentDialog'
import { WorkflowBreadcrumb } from './WorkflowBreadcrumb'
import { WorkflowSettingsModal } from './WorkflowSettingsModal'

interface WorkflowToolbarProps {
  // Minimal props - mainly for workflow operations that need main workflow store
  onSave: () => void
}

export function WorkflowToolbar({
  // Minimal props - mainly for workflow operations that need main workflow store
  onSave,
}: WorkflowToolbarProps) {
  const { showConfirm, ConfirmDialog } = useConfirmDialog()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const { selectedEnvironment, summaries } = useEnvironmentStore()
  
  // Add Node Dialog store
  const { openDialog } = useAddNodeDialogStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows/Linux
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        openDialog()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDialog])
  
  // Get main workflow store for title synchronization, import/export, AND isDirty state
  const { 
    workflow,
    workflowTitle: mainWorkflowTitle,
    updateTitle: updateWorkflowTitle,
    isTitleDirty: mainTitleDirty,
    exportWorkflow: mainExportWorkflow,
    importWorkflow: mainImportWorkflow,
    isDirty, // Use isDirty from main workflow store
    setDirty,
    updateWorkflow
  } = useWorkflowStore()
  
  // Get toolbar state from the dedicated store (excluding isDirty which comes from main store)
  const {    
    // Import/Export state
    isExporting,
    isImporting,
    exportProgress,
    importProgress,
    exportWorkflow,
    importWorkflow,
    clearImportExportErrors,
    
    // UI state
    isSaving,
    setSaving,
  } = useWorkflowToolbarStore()
  
  // Get workflow activation state directly from workflow
  const isWorkflowActive = workflow?.active ?? false

  // Helper functions
  const handleImportClick = async () => {
    if (isImporting) return
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.workflow'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        // Validate file before proceeding
        const validationErrors = validateImportFile(file)
        if (validationErrors.length > 0) {
          const errorMessage = `Invalid file: ${validationErrors[0].message}`
          toast.error(errorMessage)
          // Clear error state after showing toast
          setTimeout(() => {
            clearImportExportErrors()
          }, 2000)
          return
        }

        // Show confirmation if there are unsaved changes
        if ((isDirty || mainTitleDirty)) {
          const confirmed = await showConfirm({
            title: 'Import Workflow',
            message: 'You have unsaved changes. Importing a workflow will overwrite your current work.',
            details: [
              'All unsaved changes will be lost',
              'This action cannot be undone'
            ],
            confirmText: 'Import Anyway',
            cancelText: 'Cancel',
            severity: 'warning'
          })

          if (!confirmed) return
        }

        await importWorkflow(file, mainImportWorkflow)
        // Show success toast
        toast.success('Workflow imported successfully')
        // Clear any error state after success
        setTimeout(() => {
          clearImportExportErrors()
        }, 100)
      } catch (error) {
        // Show error toast
        const errorMessage = error instanceof Error ? error.message : 'Import failed'
        toast.error(errorMessage)
        // Clear error state after showing toast
        setTimeout(() => {
          clearImportExportErrors()
        }, 2000)
      }
    }
    input.click()
  }

  const handleExportClick = async () => {
    if (isExporting) return
    
    // Clear any previous errors
    clearImportExportErrors()
    
    try {
      await exportWorkflow(mainExportWorkflow)
      // Show success toast
      toast.success('Workflow exported successfully')
      // Clear any error state after a short delay (in case of success)
      setTimeout(() => {
        clearImportExportErrors()
      }, 100)
    } catch (error) {
      // Show error toast
      const errorMessage = error instanceof Error ? error.message : 'Export failed'
      toast.error(errorMessage)
      // Clear the error state after a short delay so menu doesn't stay in error state
      setTimeout(() => {
        clearImportExportErrors()
      }, 2000)
    }
  }

  const handleTitleChange = (title: string) => {
    updateWorkflowTitle(title)
    setDirty(true) // Mark workflow as dirty when title changes
  }

  const handleSave = () => {
    setSaving(true)
    try {
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleWorkflowSettingsSave = async (updates: { name?: string; description?: string; category?: string; tags?: string[] }) => {
    if (workflow) {
      updateWorkflow(updates)
      setDirty(true)
      // The actual save will happen when the user clicks the main Save button
    }
  }

  return (
    <TooltipProvider>
      <ConfirmDialog />
      {workflow && (
        <WorkflowSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          workflow={workflow}
          onSave={handleWorkflowSettingsSave}
        />
      )}
      <header className="flex items-center px-3 py-1.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 shadow-sm min-h-[48px]">
        {/* Left section - Sidebar trigger, Home, Breadcrumb and Edit actions */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Sidebar Trigger - only show when sidebar is available */}
          <SidebarTrigger className="-ml-1 h-7 w-7" />

          {/* Workflow Breadcrumb with Environment Selector */}
          <div className="flex-shrink-0">
            <WorkflowBreadcrumb
              category={workflow?.category}
              title={mainWorkflowTitle}
              onCategoryChange={(category) => {
                if (workflow) {
                  updateWorkflow({ category })
                  setDirty(true)
                }
              }}
              onTitleChange={handleTitleChange}
              workflowId={workflow?.id}
              showEnvironmentSelector={!!workflow?.id}
              onEnvironmentChange={(env) => {
                console.log('Environment changed:', env)
                // You can add logic here to filter executions or load environment-specific data
              }}
              onCreateEnvironment={(env) => {
                console.log('Create environment:', env)
                // This will open a dialog to create the environment
              }}
            />
          </div>

          {/* Removed Undo/Redo buttons - now available in canvas controls */}

      </div>

      {/* Center section - Empty (Execute and Add Node moved to bottom controls) */}
      <div className="flex items-center justify-center space-x-2">
      </div>

      {/* Right section - All controls */}
      <div className="flex items-center space-x-2 flex-1 justify-end">
        {/* Workflow Activation Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                if (workflow) {
                  updateWorkflow({ active: !isWorkflowActive })
                  setDirty(true)
                }
              }}
              variant={isWorkflowActive ? "default" : "secondary"}
              size="sm"
              className={cn(
                "relative h-7 px-2.5 text-xs",
                isWorkflowActive 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-muted"
              )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mr-1.5",
                isWorkflowActive ? "bg-green-200" : "bg-muted-foreground"
              )} />
              {isWorkflowActive ? 'Active' : 'Inactive'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isWorkflowActive ? "Deactivate workflow (disable execution)" : "Activate workflow (enable execution)"}</p>
          </TooltipContent>
        </Tooltip>

   
        {/* Save Button with Dropdown */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSave}
                disabled={isSaving || (!isDirty && !mainTitleDirty) || selectedEnvironment !== null}
                variant={(isDirty || mainTitleDirty) && !isSaving ? "default" : "secondary"}
                size="sm"
                className="relative h-7 px-2.5 text-xs rounded-r-none border-r-0"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="ml-1.5">
                  {isSaving ? 'Saving...' : 'Save'}
                </span>
                {(isDirty || mainTitleDirty) && !isSaving && (
                  <Badge variant="destructive" className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 p-0" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {selectedEnvironment 
                  ? `Cannot save - viewing ${getEnvironmentLabel(selectedEnvironment)}. Use "Update ${getEnvironmentLabel(selectedEnvironment)}" instead.`
                  : `Save Workflow (Ctrl+S)${(isDirty || mainTitleDirty) ? ' - Unsaved changes' : ' - No changes'}`}
              </p>
            </TooltipContent>
          </Tooltip>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isSaving}
                variant={(isDirty || mainTitleDirty) && !isSaving ? "default" : "secondary"}
                size="sm"
                className="h-7 px-1.5 rounded-l-none border-l border-l-background/10"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem 
                onClick={handleSave}
                disabled={isSaving || (!isDirty && !mainTitleDirty) || selectedEnvironment !== null}
                className="text-xs"
              >
                <Save className="mr-2 h-3.5 w-3.5" />
                Save Workflow
                {selectedEnvironment && (
                  <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>
                )}
                {!selectedEnvironment && (
                  <kbd className="ml-auto text-[10px] text-muted-foreground">Ctrl+S</kbd>
                )}
              </DropdownMenuItem>
              
              {workflow?.id && selectedEnvironment && summaries.find(s => s.environment === selectedEnvironment) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowUpdateDialog(true)}
                    className="text-xs"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Update {getEnvironmentLabel(selectedEnvironment)}
                  </DropdownMenuItem>
                </>
              )}
              
              {/* Manual Deployment */}
              {workflow?.id && summaries.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeployDialog(true)}
                    className="text-xs"
                  >
                    <Package className="mr-2 h-3.5 w-3.5" />
                    Deploy
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Settings Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setShowSettingsModal(true)} className="text-xs">
              <Settings className="mr-2 h-3.5 w-3.5" />
              Workflow Settings
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleImportClick}
              disabled={isImporting || isExporting}
              className="text-xs"
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-2 h-3.5 w-3.5" />
              )}
              {isImporting 
                ? `Importing... ${importProgress > 0 ? `(${Math.round(importProgress)}%)` : ''}`
                : 'Import Workflow'
              }
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleExportClick}
              disabled={isExporting || isImporting}
              className="text-xs"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-2 h-3.5 w-3.5" />
              )}
              {isExporting 
                ? `Exporting... ${exportProgress > 0 ? `(${Math.round(exportProgress)}%)` : ''}`
                : 'Export Workflow'
              }
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </header>
      
      {/* Manual Deployment Dialog */}
      {workflow?.id && (
        <>
          <ManualDeploymentDialog
            workflowId={workflow.id}
            open={showDeployDialog}
            onOpenChange={setShowDeployDialog}
            onSuccess={() => {
              // Reload environment summaries after successful deployment
              const { loadSummaries } = useEnvironmentStore.getState()
              loadSummaries(workflow.id)
            }}
          />
          
          {selectedEnvironment && summaries.find(s => s.environment === selectedEnvironment) && (
            <UpdateEnvironmentDialog
              workflowId={workflow.id}
              environment={selectedEnvironment}
              currentVersion={summaries.find(s => s.environment === selectedEnvironment)!.version}
              isOpen={showUpdateDialog}
              onClose={() => setShowUpdateDialog(false)}
              onSuccess={() => {
                // Reload environment summaries after successful update
                const { loadSummaries } = useEnvironmentStore.getState()
                loadSummaries(workflow.id)
              }}
            />
          )}
        </>
      )}
      
      {/* Confirm Dialog */}
      <ConfirmDialog />
      
      {/* Workflow Settings Modal */}
      {workflow && (
        <WorkflowSettingsModal
          isOpen={showSettingsModal}
          workflow={workflow}
          onClose={() => setShowSettingsModal(false)}
          onSave={(updates) => {
            updateWorkflow(updates)
            // If name was updated, also update the title state
            if (updates.name && updates.name !== mainWorkflowTitle) {
              updateWorkflowTitle(updates.name)
            }
            setDirty(true)
            setShowSettingsModal(false)
          }}
        />
      )}
    </TooltipProvider>
  )
}