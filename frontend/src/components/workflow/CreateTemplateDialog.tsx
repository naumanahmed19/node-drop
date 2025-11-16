import { useState, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FormGenerator, FormGeneratorRef, FormFieldConfig } from '@/components/ui/form-generator'
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
import { detectVariablesInNodes, detectCredentialsInNodes } from '@/utils/templateVariables'
import { Variable, Key } from 'lucide-react'

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
  const formRef = useRef<FormGeneratorRef>(null)
  
  const [formValues, setFormValues] = useState({
    name: '',
    displayName: '',
    description: '',
    icon: '📦',
    color: '#6366f1',
  })
  
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

  // Detect variables in the selected nodes
  const detectedVariables = useMemo(() => {
    return Array.from(detectVariablesInNodes(nodes))
  }, [nodes])

  // Detect credentials in the selected nodes
  const nodesWithCredentials = useMemo(() => {
    return Array.from(detectCredentialsInNodes(nodes))
  }, [nodes])

  // Define form fields (basic fields only, complex ones handled separately)
  const formFields: FormFieldConfig[] = useMemo(() => [
    {
      name: 'name',
      displayName: 'Template Name',
      type: 'string',
      required: true,
      placeholder: 'e.g., AI Content Generator',
      description: 'This will be converted to a type identifier (e.g., ai-content-generator)',
    },
    {
      name: 'displayName',
      displayName: 'Display Name',
      type: 'string',
      required: true,
      placeholder: 'e.g., AI Content Generator',
    },
    {
      name: 'description',
      displayName: 'Description',
      type: 'textarea',
      placeholder: 'Describe what this template does...',
      rows: 3,
    },
  ], [])

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

  const handleFormChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    // Validate using FormGenerator
    if (formRef.current) {
      const errors = formRef.current.validate()
      if (Object.keys(errors).length > 0) {
        return
      }
    }

    // Generate type name from name (lowercase, no spaces)
    const typeName = formValues.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    setIsSubmitting(true)
    setError(null)

    try {
      await onCreateTemplate({
        name: typeName,
        displayName: formValues.displayName.trim(),
        description: formValues.description.trim(),
        icon: formValues.icon,
        color: formValues.color,
        group: selectedGroups.length > 0 ? selectedGroups : ['Templates'],
      })

      // Reset form
      setFormValues({
        name: '',
        displayName: '',
        description: '',
        icon: '📦',
        color: '#6366f1',
      })
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

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Basic Form Fields */}
          <FormGenerator
            ref={formRef}
            fields={formFields}
            values={formValues}
            onChange={handleFormChange}
            disabled={isSubmitting}
            validateOnBlur={true}
          />

          {/* Groups Selector - Custom Component */}
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

          {/* Icon and Color - Custom Components */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                placeholder="📦"
                value={formValues.icon}
                onChange={(e) => handleFormChange('icon', e.target.value)}
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
                  value={formValues.color}
                  onChange={(e) => handleFormChange('color', e.target.value)}
                  disabled={isSubmitting}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formValues.color}
                  onChange={(e) => handleFormChange('color', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="#6366f1"
                />
              </div>
            </div>
          </div>

          {/* Variables Table */}
          {detectedVariables.length > 0 && (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Template Variables</Label>
              </div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Variable</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedVariables.map((variable, index) => (
                      <tr key={variable} className={index !== detectedVariables.length - 1 ? 'border-b' : ''}>
                        <td className="px-3 py-2 font-mono text-xs">{`{{${variable}}}`}</td>
                        <td className="px-3 py-2 text-muted-foreground">text</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                These variables will be configurable when using this template.
              </p>
            </div>
          )}

          {/* Credentials Warning */}
          {nodesWithCredentials.length > 0 && (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <Label className="text-sm font-medium">Credentials Required</Label>
              </div>
              <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 dark:border-amber-900 bg-amber-100/50 dark:bg-amber-900/20">
                      <th className="px-3 py-2 text-left font-medium">Node</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodesWithCredentials.map((nodeName, index) => (
                      <tr key={nodeName} className={index !== nodesWithCredentials.length - 1 ? 'border-b border-amber-200 dark:border-amber-900' : ''}>
                        <td className="px-3 py-2">{nodeName}</td>
                        <td className="px-3 py-2 text-amber-700 dark:text-amber-400 text-xs">Requires credentials</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Users will need to configure credentials for these nodes when using this template.
              </p>
            </div>
          )}

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
