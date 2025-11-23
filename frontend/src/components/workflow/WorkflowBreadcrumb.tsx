import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useGlobalToast } from '@/hooks/useToast'
import { workflowService } from '@/services/workflow'
import { useCategoriesStore } from '@/stores/categories'
import type { EnvironmentType } from '@/types/environment'
import { ChevronDown, FolderOpen, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { EnvironmentSelector } from '../environment/EnvironmentSelector'
import { CreateCategoryModal } from './CreateCategoryModal'
import { TeamSelectorBreadcrumb } from '../team/TeamSelectorBreadcrumb'
import { useTeam } from '@/contexts/TeamContext'

interface WorkflowBreadcrumbProps {
  category?: string
  title: string
  onCategoryChange: (category: string) => void
  onTitleChange: (title: string) => void
  className?: string
  // Team props
  teamId?: string | null
  onTeamChange?: (teamId: string | null) => void
  // Environment props
  workflowId?: string
  showEnvironmentSelector?: boolean
  onEnvironmentChange?: (environment: EnvironmentType) => void
  onCreateEnvironment?: (environment: EnvironmentType) => void
}

export function WorkflowBreadcrumb({
  category,
  title,
  onCategoryChange,
  onTitleChange,
  className,
  teamId,
  onTeamChange,
  workflowId,
  showEnvironmentSelector = false,
  onEnvironmentChange,
  onCreateEnvironment,
}: WorkflowBreadcrumbProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState(title)
  const { categories: availableCategories, isLoading: isLoadingCategories, loadCategories, addCategory, removeCategory } = useCategoriesStore()
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)
  const { showSuccess, showError } = useGlobalToast()
  const { teams } = useTeam()
  const hasTeams = teams.length > 0 || teamId // Show if there are teams OR if workflow is already assigned to a team

  // Load available categories on mount
  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Update tempTitle when title prop changes
  useEffect(() => {
    setTempTitle(title)
  }, [title])

  const handleTitleClick = () => {
    setIsEditingTitle(true)
    setTempTitle(title)
  }

  const handleTitleSubmit = () => {
    onTitleChange(tempTitle.trim() || 'Untitled Workflow')
    setIsEditingTitle(false)
    // Don't auto-save title, let the main save handle it
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit()
    } else if (e.key === 'Escape') {
      setTempTitle(title)
      setIsEditingTitle(false)
    }
  }

  const handleCategorySelect = (selectedCategory: string) => {
    onCategoryChange(selectedCategory)
    // Don't auto-save category, let the main save handle it
  }

  const handleCategoryCreated = async (categoryName: string) => {
    // Add to store and select the newly created category
    addCategory(categoryName)
    onCategoryChange(categoryName)
  }

  const handleDeleteCategory = async (categoryName: string) => {
    try {
      setIsDeletingCategory(true)
      await workflowService.deleteCategory(categoryName)
      
      // Remove from store
      removeCategory(categoryName)
      
      // If the deleted category was selected, clear selection
      if (category === categoryName) {
        onCategoryChange('')
      }

      // Show success toast
      showSuccess('Category deleted successfully', {
        message: `"${categoryName}" category has been removed.`
      })
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      
      // Show error toast
      const errorMessage = error.response?.data?.error?.message || 
        'Failed to delete category. It may be in use by some workflows.'
      
      showError('Failed to delete category', {
        message: errorMessage,
        duration: 8000
      })
    } finally {
      setIsDeletingCategory(false)
    }
  }

  return (
    <>
      <CreateCategoryModal
        isOpen={showCreateCategoryModal}
        onClose={() => setShowCreateCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
      />
      <div className={`${className} overflow-hidden`}>
        <Breadcrumb>
        <BreadcrumbList className="flex-nowrap overflow-hidden">
          {/* Team Selector - Only show if teams exist, hidden on small screens, shown on md+ */}
          {hasTeams && (
            <>
              <BreadcrumbItem className="hidden md:inline-flex">
                <TeamSelectorBreadcrumb
                  currentTeamId={teamId}
                  workflowName={title}
                  onTeamChange={onTeamChange}
                />
              </BreadcrumbItem>

              <BreadcrumbSeparator className="hidden md:block" />
            </>
          )}

          {/* Category - Hidden on small screens, shown on lg+ */}
          <BreadcrumbItem className="hidden lg:inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-[36px] px-2 -mx-2">
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{category || 'Uncategorized'}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {isLoadingCategories ? (
                  <DropdownMenuItem disabled>Loading categories...</DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem 
                      onClick={() => setShowCreateCategoryModal(true)}
                      className="text-blue-600 font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add new category
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleCategorySelect('')}>
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Uncategorized
                    </DropdownMenuItem>
                    {availableCategories.map((cat) => (
                      <DropdownMenuItem
                        key={cat}
                        className={`group ${category === cat ? 'bg-accent' : ''}`}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div 
                          className="flex items-center flex-1 cursor-pointer"
                          onClick={() => handleCategorySelect(cat)}
                        >
                          <FolderOpen className="w-4 h-4 mr-2" />
                          {cat}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCategory(cat)
                          }}
                          disabled={isDeletingCategory}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive hover:text-destructive-foreground rounded transition-all ml-2"
                          title={`Delete ${cat} category`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>

          <BreadcrumbSeparator className="hidden lg:block" />

          {/* Workflow Title - Always visible but truncated on small screens */}
          <BreadcrumbItem className="min-w-0 flex-shrink">
            {isEditingTitle ? (
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                className="h-6 px-1 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring bg-transparent w-full min-w-[120px] max-w-[200px]"
                placeholder="Workflow title"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <BreadcrumbPage
                onClick={handleTitleClick}
                className="cursor-pointer hover:text-foreground transition-colors truncate max-w-[150px] sm:max-w-[200px] md:max-w-none block"
                title={`Click to edit: ${title || 'Untitled Workflow'}`}
              >
                {title || 'Untitled Workflow'}
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>

          {/* Environment Selector - Hidden on xs, shown on sm+ */}
          {showEnvironmentSelector && workflowId && (
            <>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem className="hidden sm:inline-flex">
                <EnvironmentSelector
                  workflowId={workflowId}
                  onEnvironmentChange={onEnvironmentChange}
                  onCreateEnvironment={onCreateEnvironment}
                />
              </BreadcrumbItem>
            </>
          )}

          {/* Mobile Menu - Shows all hidden items on small screens */}
          <BreadcrumbSeparator className="md:hidden" />
          <BreadcrumbItem className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-[36px] px-2 -mx-2">
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Workflow Settings
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Team Selector in Mobile Menu - Only show if teams exist */}
                {hasTeams && (
                  <>
                    <div className="px-2 py-1.5">
                      <div className="text-xs text-muted-foreground mb-1">Owner</div>
                      <TeamSelectorBreadcrumb
                        currentTeamId={teamId}
                        workflowName={title}
                        onTeamChange={onTeamChange}
                      />
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Category in Mobile Menu (hidden on lg+) */}
                <div className="px-2 py-1.5 lg:hidden">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 text-sm hover:text-foreground transition-colors cursor-pointer w-full">
                      <FolderOpen className="w-4 h-4" />
                      <span className="flex-1 text-left truncate">{category || 'Uncategorized'}</span>
                      <ChevronDown className="w-3 h-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                      {isLoadingCategories ? (
                        <DropdownMenuItem disabled>Loading categories...</DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem 
                            onClick={() => setShowCreateCategoryModal(true)}
                            className="text-blue-600 font-medium"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add new category
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCategorySelect('')}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Uncategorized
                          </DropdownMenuItem>
                          {availableCategories.map((cat) => (
                            <DropdownMenuItem
                              key={cat}
                              className={`group ${category === cat ? 'bg-accent' : ''}`}
                              onSelect={(e) => e.preventDefault()}
                            >
                              <div 
                                className="flex items-center flex-1 cursor-pointer"
                                onClick={() => handleCategorySelect(cat)}
                              >
                                <FolderOpen className="w-4 h-4 mr-2" />
                                {cat}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCategory(cat)
                                }}
                                disabled={isDeletingCategory}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive hover:text-destructive-foreground rounded transition-all ml-2"
                                title={`Delete ${cat} category`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Environment Selector in Mobile Menu (only on xs) */}
                {showEnvironmentSelector && workflowId && (
                  <>
                    <DropdownMenuSeparator className="sm:hidden" />
                    <div className="px-2 py-1.5 sm:hidden">
                      <div className="text-xs text-muted-foreground mb-1">Environment</div>
                      <EnvironmentSelector
                        workflowId={workflowId}
                        onEnvironmentChange={onEnvironmentChange}
                        onCreateEnvironment={onCreateEnvironment}
                      />
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      </div>
    </>
  )
}
