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
      <div className={className}>
        <Breadcrumb>
        <BreadcrumbList>
          {/* Team Selector - Change workflow ownership */}
          <BreadcrumbItem>
            <TeamSelectorBreadcrumb
              currentTeamId={teamId}
              workflowName={title}
              onTeamChange={onTeamChange}
            />
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <FolderOpen className="w-4 h-4" />
                <span>{category || 'Uncategorized'}</span>
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
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            {isEditingTitle ? (
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                className="h-6 px-1 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring bg-transparent min-w-[200px]"
                placeholder="Workflow title"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <BreadcrumbPage
                onClick={handleTitleClick}
                className="cursor-pointer hover:text-foreground transition-colors"
                title="Click to edit title"
              >
                {title || 'Untitled Workflow'}
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>

          {/* Environment Selector as Breadcrumb Item */}
          {showEnvironmentSelector && workflowId && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <EnvironmentSelector
                  workflowId={workflowId}
                  onEnvironmentChange={onEnvironmentChange}
                  onCreateEnvironment={onCreateEnvironment}
                />
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      </div>
    </>
  )
}
