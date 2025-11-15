import { useState, useMemo } from 'react'
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
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from '@/components/ui/shadcn-io/tags'
import { WorkflowNode, WorkflowConnection } from '@/types'
import { useNodeTypes } from '@/stores/nodeTypes'

interface CreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  onCreateTemplate: (data: {
    name: string
    displayName: string
    description: string
    icon?: string
    color?: string
    group?: string[]
  }) => Promise<void>
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  nodes,
  connections,
  onCreateTemplate,
}: CreateTemplateDialogProps) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📦')
  const [color, setColor] = useState('#6366f1')
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['Templates'])
  const [newGroup, setNewGroup] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get all available groups from existing node types
  const { activeNodeTypes } = useNodeTypes()
  
  const availableGroups = useMemo(() => {
    const groups = new Set<string>()
    activeNodeTypes.forEach(nodeType => {
      nodeType.group.forEach(g => groups.add(g))
    })
    return Array.from(groups).sort()
  }, [activeNodeTypes])

  // Combine available groups with selected custom groups
  const allGroups = useMemo(() => {
    const combined = new Set([...availableGroups, ...selectedGroups])
    return Array.from(combined).sort()
  }, [availableGroups, selectedGroups])

  const handleRemoveGroup = (group: string) => {
    setSelectedGroups(selectedGroups.filter(g => g !== group))
  }

  const handleSelectGroup = (group: string) => {
    if (selectedGroups.includes(group)) {
      handleRemoveGroup(group)
      return
    }
    setSelectedGroups([...selectedGroups, group])
  }

  const handleCreateGroup = () => {
    const trimmed = newGroup.trim()
    if (trimmed && !selectedGroups.includes(trimmed)) {
      setSelectedGroups([...selectedGroups, trimmed])
      setNewGroup('')
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }

    // Generate type name from name (lowercase, no spaces)
    const typeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    setIsSubmitting(true)
    setError(null)

    try {
      await onCreateTemplate({
        name: typeName,
        displayName: displayName.trim(),
        description: description.trim(),
        icon,
        color,
        group: selectedGroups.length > 0 ? selectedGroups : ['Templates'],
      })

      // Reset form
      setName('')
      setDisplayName('')
      setDescription('')
      setIcon('📦')
      setColor('#6366f1')
      setSelectedGroups(['Templates'])
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Template from Selection</DialogTitle>
          <DialogDescription>
            Create a reusable template from {nodes.length} selected node{nodes.length !== 1 ? 's' : ''} and {connections.length} connection{connections.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              placeholder="e.g., AI Content Generator"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              This will be converted to a type identifier (e.g., ai-content-generator)
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              placeholder="e.g., AI Content Generator"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this template does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Groups</Label>
            <Tags>
              <TagsTrigger disabled={isSubmitting}>
                {selectedGroups.map((group) => (
                  <TagsValue
                    key={group}
                    onRemove={() => handleRemoveGroup(group)}
                  >
                    {group}
                  </TagsValue>
                ))}
              </TagsTrigger>
              <TagsContent>
                <TagsInput 
                  onValueChange={setNewGroup} 
                  placeholder="Search or type to add..." 
                />
                <TagsList>
                  <TagsEmpty>
                    {newGroup.trim() && (
                      <button
                        className="mx-auto flex cursor-pointer items-center gap-2 text-sm"
                        onClick={handleCreateGroup}
                        type="button"
                      >
                        <span className="text-muted-foreground">+</span>
                        Create new group: <span className="font-medium">{newGroup}</span>
                      </button>
                    )}
                    {!newGroup.trim() && (
                      <span className="text-sm text-muted-foreground">Type to add a custom group</span>
                    )}
                  </TagsEmpty>
                  <TagsGroup>
                    {allGroups.map((group) => (
                      <TagsItem
                        key={group}
                        value={group}
                        onSelect={handleSelectGroup}
                      >
                        {group}
                        {selectedGroups.includes(group) && (
                          <span className="ml-auto text-muted-foreground">✓</span>
                        )}
                      </TagsItem>
                    ))}
                  </TagsGroup>
                </TagsList>
              </TagsContent>
            </Tags>
            <p className="text-xs text-muted-foreground">
              Select existing groups or type to add custom ones. Templates will appear in all selected groups.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                placeholder="📦"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                disabled={isSubmitting}
                maxLength={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isSubmitting}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="#6366f1"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
