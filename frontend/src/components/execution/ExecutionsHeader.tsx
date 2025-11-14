import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle2, Circle, MoreVertical, Pause, RefreshCw, RotateCcw, Search, Trash2, XCircle } from 'lucide-react'

interface ExecutionsHeaderProps {
  executionCount: number
  searchTerm: string
  setSearchTerm: (term: string) => void
  statusFilter: string | null
  setStatusFilter: (status: string | null) => void
  activeTab: "workflow" | "all"
  setActiveTab: (tab: "workflow" | "all") => void
  currentWorkflowId: string | null
  workflowExecutionCount: number
  allExecutionCount: number
  onRefresh?: () => void
  isRefreshing?: boolean
  onDeleteAll?: () => void
}

export function ExecutionsHeader({
  executionCount,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  activeTab,
  setActiveTab,
  currentWorkflowId,
  workflowExecutionCount,
  allExecutionCount,
  onRefresh,
  isRefreshing = false,
  onDeleteAll
}: ExecutionsHeaderProps) {
  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter(null)
  }

  const hasActiveFilters = searchTerm || statusFilter

  return (
    <div className="space-y-3">
      {/* Tabs for Current Workflow vs All */}
      {currentWorkflowId && currentWorkflowId !== 'new' && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "workflow" | "all")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9 bg-muted/50">
            <TabsTrigger value="workflow" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="mr-1.5">Current Workflow</span>
              <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-background/80 dark:bg-background/50">
                {workflowExecutionCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="mr-1.5">All Executions</span>
              <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-background/80 dark:bg-background/50">
                {allExecutionCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Search and Filters */}
      <div className="space-y-2">
        {/* Search Input with refresh button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search executions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Circle className="h-3 w-3" />
                  <span>All Status</span>
                </div>
              </SelectItem>
              <SelectItem value="running">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                  <span>Running</span>
                </div>
              </SelectItem>
              <SelectItem value="success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400" />
                  <span>Success</span>
                </div>
              </SelectItem>
              <SelectItem value="error">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
                  <span>Error</span>
                </div>
              </SelectItem>
              <SelectItem value="cancelled">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-orange-500 dark:text-orange-400" />
                  <span>Cancelled</span>
                </div>
              </SelectItem>
              <SelectItem value="paused">
                <div className="flex items-center gap-2">
                  <Pause className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
                  <span>Paused</span>
                </div>
              </SelectItem>
              <SelectItem value="partial">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                  <span>Partial</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {currentWorkflowId && currentWorkflowId !== 'new' 
              ? (activeTab === "workflow" ? "Current Workflow" : "All Executions")
              : "All Executions"
            }
          </span>
          <Badge variant="secondary" className="text-xs h-5">
            {executionCount}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground">
              {searchTerm && `"${searchTerm}"`}
              {searchTerm && statusFilter && ' • '}
              {statusFilter && `${statusFilter} status`}
            </span>
          )}
          
          {/* Actions dropdown */}
          {executionCount > 0 && onDeleteAll && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onDeleteAll}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Executions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}
