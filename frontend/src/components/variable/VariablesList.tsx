import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VariableForm } from '@/components/variable/VariableForm'
import { useSidebarContext } from '@/contexts'
import { variableService } from '@/services'
import { Variable } from '@/types'
import {
    Calendar,
    Copy,
    Edit,
    FileText,
    Globe,
    MoreHorizontal,
    RefreshCw,
    Trash2,
    Variable as VariableIcon,
    Workflow,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface VariablesListProps {
  currentWorkflowId?: string
}

export function VariablesList({ currentWorkflowId }: VariablesListProps) {
  const {
    setHeaderSlot,
    setDetailSidebar
  } = useSidebarContext()
  
  const [variables, setVariables] = useState<Variable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'local'>('all')
  
  // CRUD handlers
  const handleCreateVariable = () => {
    console.log('Create variable clicked')
    setDetailSidebar({
      isOpen: true,
      title: 'Create Variable',
      content: (
        <VariableForm
          onSuccess={handleVariableSuccess}
          onCancel={handleCloseDetailSidebar}
          workflowId={currentWorkflowId}
        />
      )
    })
  }
  
  const handleCloseDetailSidebar = () => {
    setDetailSidebar(null)
  }

  const handleEditVariable = (variable: Variable) => {
    console.log('Edit variable clicked:', variable)
    setDetailSidebar({
      isOpen: true,
      title: `Edit ${variable.key}`,
      content: (
        <VariableForm
          variable={variable}
          onSuccess={handleVariableSuccess}
          onCancel={handleCloseDetailSidebar}
          workflowId={currentWorkflowId}
        />
      )
    })
  }

  const handleDeleteVariable = async (variable: Variable) => {
    try {
      await variableService.deleteVariable(variable.id)
      // Refresh the variables list
      const updatedVariables = variables.filter(v => v.id !== variable.id)
      setVariables(updatedVariables)
      toast.success('Variable deleted successfully')
    } catch (error) {
      console.error('Failed to delete variable:', error)
      toast.error('Failed to delete variable')
    }
  }

  const handleDuplicateVariable = (variable: Variable) => {
    const duplicateVariable = {
      ...variable,
      key: `${variable.key}_copy`,
      id: '', // Clear ID for new variable
    }
    
    setDetailSidebar({
      isOpen: true,
      title: `Duplicate ${variable.key}`,
      content: (
        <VariableForm
          variable={duplicateVariable}
          onSuccess={handleVariableSuccess}
          onCancel={handleCloseDetailSidebar}
        />
      )
    })
    toast.info(`Creating duplicate of variable: ${variable.key}`)
  }

  const handleVariableSuccess = async () => {
    try {
      // Refresh variables list
      const updatedVariables = await variableService.getVariables(localSearchTerm)
      setVariables(updatedVariables)
      handleCloseDetailSidebar()
      toast.success('Variable operation successful')
    } catch (error) {
      console.error('Failed to refresh variables:', error)
      // Still close sidebar on success
      handleCloseDetailSidebar()
    }
  }

  const fetchVariables = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      
      const fetchedVariables = await variableService.getVariables(localSearchTerm)
      setVariables(fetchedVariables)
    } catch (err) {
      console.error('Failed to fetch variables:', err)
      setError('Failed to load variables')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchVariables(true)
  }

  useEffect(() => {
    fetchVariables()
  }, [localSearchTerm])

  // Filter variables based on search term
  const filteredVariables = React.useMemo(() => {
    let filtered = variables
    
    // Filter by scope
    if (scopeFilter !== 'all') {
      filtered = filtered.filter(variable => 
        variable.scope.toLowerCase() === scopeFilter
      )
    }
    
    // Filter by search term
    if (localSearchTerm) {
      filtered = filtered.filter(variable =>
        variable.key.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
        (variable.description && variable.description.toLowerCase().includes(localSearchTerm.toLowerCase()))
      )
    }
    
    return filtered
  }, [variables, localSearchTerm, scopeFilter])

  // Set header slot for variables
  useEffect(() => {
    setHeaderSlot(
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {filteredVariables.length} variable{filteredVariables.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              onClick={handleCreateVariable}
              className="h-7"
            >
              <VariableIcon className="h-3 w-3 mr-1" />
              New Variable
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={scopeFilter} onValueChange={(value: 'all' | 'global' | 'local') => setScopeFilter(value)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="global">Global Only</SelectItem>
              <SelectItem value="local">Local Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search variables..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              className="w-full pl-3 pr-3 py-1.5 text-sm border rounded-md bg-background h-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    )
    
    // Clean up header slot when component unmounts
    return () => {
      setHeaderSlot(null)
    }
  }, [filteredVariables.length, localSearchTerm, scopeFilter, isRefreshing])

  const handleVariableAction = (action: string, variableId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const variable = variables.find(v => v.id === variableId)
    if (!variable) return

    switch (action) {
      case 'edit':
        handleEditVariable(variable)
        break
      case 'duplicate':
        handleDuplicateVariable(variable)
        break
      case 'delete':
        handleDeleteVariable(variable)
        break
      default:
        console.log(`Unknown action: ${action}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const truncateValue = (value: string, maxLength: number = 50) => {
    if (value.length <= maxLength) return value
    return value.substring(0, maxLength) + '...'
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
          <VariableIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
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

  if (filteredVariables.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <VariableIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">
            {localSearchTerm ? 'No variables match your search' : 'No variables found'}
          </p>
          {!localSearchTerm && (
            <div className="space-y-2 mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCreateVariable}
              >
                Create Your First Variable
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-0">
        {filteredVariables.map((variable) => (
          <div
            key={variable.id}
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-b last:border-b-0 group cursor-pointer"
            onClick={() => {
              console.log('Variable clicked:', variable.key)
              handleEditVariable(variable)
            }}
          >
            <div className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <VariableIcon className="h-4 w-4 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">
                        {variable.scope === 'GLOBAL' ? '$vars.' : '$local.'}{variable.key}
                      </h4>
                      <Badge 
                        variant={variable.scope === 'GLOBAL' ? 'default' : 'secondary'} 
                        className="text-xs px-1.5 py-0.5 h-5"
                      >
                        {variable.scope === 'GLOBAL' ? (
                          <>
                            <Globe className="h-3 w-3 mr-1" />
                            Global
                          </>
                        ) : (
                          <>
                            <Workflow className="h-3 w-3 mr-1" />
                            Local
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {truncateValue(variable.value)}
                    </p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => handleVariableAction('edit', variable.id, e)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleVariableAction('duplicate', variable.id, e)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => handleVariableAction('delete', variable.id, e)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {variable.description && (
                <div className="mb-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span className="truncate">{variable.description}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Updated {formatDate(variable.updatedAt)}</span>
                </div>
                
                <Badge variant="outline" className="text-xs h-4">
                  {variable.scope === 'GLOBAL' ? '$vars.' : '$local.'}{variable.key}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
