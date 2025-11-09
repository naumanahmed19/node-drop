import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Workflow } from '@/types/workflow'
import { Save, Tag, X, Database, AlertTriangle } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { CategorySelect } from './CategorySelect'

interface WorkflowSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  workflow: Workflow
  onSave: (updates: Partial<Workflow>) => void
}

export function WorkflowSettingsModal({ 
  isOpen, 
  onClose, 
  workflow, 
  onSave 
}: WorkflowSettingsModalProps) {
  const [name, setName] = useState(workflow.name)
  const [description, setDescription] = useState(workflow.description || '')
  const [category, setCategory] = useState(workflow.category || '')
  const [tags, setTags] = useState(workflow.tags || [])
  const [newTag, setNewTag] = useState('')
  const [saveExecutionToDatabase, setSaveExecutionToDatabase] = useState(
    workflow.settings?.saveExecutionToDatabase !== false // Default to true
  )

  // Reset form when workflow changes
  useEffect(() => {
    setName(workflow.name)
    setDescription(workflow.description || '')
    setCategory(workflow.category || '')
    setTags(workflow.tags || [])
    setSaveExecutionToDatabase(workflow.settings?.saveExecutionToDatabase !== false)
  }, [workflow])

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = () => {
    const updates = {
      name: name.trim(),
      description: description.trim(),
      category: category || undefined,
      tags,
      settings: {
        ...(workflow.settings || {}), // Ensure settings is an object
        saveExecutionToDatabase
      }
    }
    console.log('Updating workflow settings:', updates)
    onSave(updates) // Just update the store, don't save to backend
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Settings</DialogTitle>
            <DialogDescription>
              Manage your workflow's basic information and configuration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="workflowName">
              Workflow Name *
            </Label>
            <Input
              id="workflowName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workflow name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="workflowDescription">
              Description
            </Label>
            <Textarea
              id="workflowDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this workflow does"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <CategorySelect
              value={category}
              onValueChange={setCategory}
              placeholder="Select a category"
              allowCreate={true}
              showDeleteOption={true}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
            
            {/* Tag Input */}
            <div className="flex space-x-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddTag}
                disabled={!newTag.trim() || tags.includes(newTag.trim())}
                size="sm"
              >
                Add
              </Button>
            </div>

            {/* Existing Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Execution Settings */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <Label htmlFor="saveExecutionToDatabase" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Database className="w-4 h-4 flex-shrink-0" />
                  <span>Save Execution History</span>
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Store execution data in database. Disable for high-traffic APIs to improve performance.
                </p>
              </div>
              <Switch
                id="saveExecutionToDatabase"
                checked={saveExecutionToDatabase}
                onCheckedChange={setSaveExecutionToDatabase}
                className="flex-shrink-0"
              />
            </div>

            {!saveExecutionToDatabase && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-amber-800 dark:text-amber-200">
                  <p className="font-medium">No execution history will be saved</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            Apply
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
