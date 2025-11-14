import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

import { FormFieldConfig, FormFieldOption } from '@/components/ui/form-generator/types'
import { useExecutionControls } from '@/hooks/workflow'
import { useWorkflowStore } from '@/stores'
import { Node, NodeProps } from '@xyflow/react'
import { ClipboardList, Send } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { BaseNodeWrapper } from './BaseNodeWrapper'



interface FormGeneratorNodeData extends Record<string, unknown> {
  label: string
  nodeType: string
  parameters: Record<string, any>
  disabled: boolean
  locked?: boolean
  status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'
  executionResult?: any
  lastExecutionData?: any
  inputs?: string[]
  outputs?: string[]
  executionCapability?: 'trigger' | 'action' | 'transform' | 'condition'
}

type FormGeneratorNodeType = Node<FormGeneratorNodeData>

export const FormGeneratorNode = memo(function FormGeneratorNode({ 
  data, 
  selected, 
  id 
}: NodeProps<FormGeneratorNodeType>) {
  const { executionState, updateNode } = useWorkflowStore()
  const { executeWorkflow } = useExecutionControls()
  
  const isReadOnly = false // Form should always be interactive
  const isExecuting = executionState.status === 'running'
  
  // Memoize parameters
  const parameters = useMemo(() => data.parameters || {}, [data.parameters])
  
  // Track expanded state
  const [isExpanded, setIsExpanded] = useState(parameters.isExpanded ?? false)
  
  // Get form configuration from parameters
  const formTitle = useMemo(() => parameters.formTitle || 'Custom Form', [parameters.formTitle])
  const formDescription = useMemo(() => parameters.formDescription || '', [parameters.formDescription])
  const submitButtonText = useMemo(() => parameters.submitButtonText || 'Submit', [parameters.submitButtonText])
  
  // Parse form fields from RepeatingField format and convert to FormFieldConfig
  const formFieldConfigs = useMemo<FormFieldConfig[]>(() => {
    // Handle RepeatingField structure: array of {id, values: {...}}
    const rawFields = parameters.formFields || []
    if (!Array.isArray(rawFields)) return []
    
    return rawFields.map((field: any, index: number) => {
      // Extract values from RepeatingField structure
      const fieldData = field.values || field
      
      // Generate fieldName from fieldLabel if missing
      const fieldName = fieldData.fieldName || 
        fieldData.fieldLabel?.toLowerCase().replace(/\s+/g, '_') || 
        `field_${index}`
      
      // Map field type to FormFieldConfig type
      const getFieldType = (type: string): FormFieldConfig['type'] => {
        switch (type) {
          case 'text': return 'string'
          case 'email': return 'email'
          case 'number': return 'number'
          case 'textarea': return 'textarea'
          case 'select': return 'options'
          case 'radio': return 'options'
          case 'checkbox': return 'boolean'
          case 'date': return 'dateTime'
          case 'file': return 'string'
          default: return 'string'
        }
      }
      
      // Parse options for select/radio
      const parseOptions = (optionsStr: string) => {
        if (!optionsStr) return []
        return optionsStr.split(/[\n,]/)
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0)
          .map(opt => ({ name: opt, value: opt }))
      }
      
      return {
        name: fieldName,
        displayName: fieldData.fieldLabel || fieldName,
        type: getFieldType(fieldData.fieldType),
        required: fieldData.required || false,
        default: fieldData.defaultValue || '',
        description: fieldData.helpText || '',
        placeholder: fieldData.placeholder || '',
        options: (fieldData.fieldType === 'select' || fieldData.fieldType === 'radio') 
          ? parseOptions(fieldData.options || '')
          : undefined,
        rows: fieldData.rows,
        validation: fieldData.fieldType === 'number' ? {
          min: fieldData.min,
          max: fieldData.max,
        } : undefined,
      } as FormFieldConfig
    })
  }, [parameters.formFields])
  
  // Form state - track values for all fields
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Handle expand/collapse toggle
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    updateNode(id, {
      parameters: {
        ...parameters,
        isExpanded: newExpanded
      }
    })
  }, [isExpanded, id, parameters, updateNode])
  
  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }, [errors])
  
  // Validate form
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    
    formFieldConfigs.forEach(field => {
      if (field.required) {
        const value = formValues[field.name]
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field.name] = `${field.displayName} is required`
        }
      }
      
      // Email validation
      if (field.type === 'email' && formValues[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formValues[field.name])) {
          newErrors[field.name] = 'Please enter a valid email address'
        }
      }
      
      // Number validation
      if (field.type === 'number' && formValues[field.name]) {
        const value = Number(formValues[field.name])
        if (field.validation?.min !== undefined && value < field.validation.min) {
          newErrors[field.name] = `Value must be at least ${field.validation.min}`
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          newErrors[field.name] = `Value must be at most ${field.validation.max}`
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formFieldConfigs, formValues])
  
  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (isSubmitting || isExecuting) return
    
    // Validate form
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Update node with form data before execution
      updateNode(id, {
        parameters: {
          ...parameters,
          lastSubmission: formValues,
          submittedFormData: formValues, // Store form data for execution
          submittedAt: new Date().toISOString()
        },
        disabled: false
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Execute workflow - the form data is already in node parameters
      await executeWorkflow(id)
      
      // Keep form values after submission - don't clear them
      
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({
        _form: `Failed to submit form: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, isExecuting, validateForm, id, parameters, formValues, updateNode, executeWorkflow, formTitle, formFieldConfigs])
  
  // Parse options string into array
  const parseOptions = useCallback((optionsStr: string) => {
    if (!optionsStr) return []
    // Split by newline or comma
    return optionsStr.split(/[\n,]/).map(opt => opt.trim()).filter(opt => opt.length > 0)
  }, [])
  
  // Render a single form field
  const renderField = useCallback((field: FormFieldConfig) => {
    const value = formValues[field.name] || ''
    const error = errors[field.name]
    
    switch (field.type) {
      case 'string':
      case 'email':
      case 'number':
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs font-medium">
              {field.displayName}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type === 'string' ? 'text' : field.type}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isSubmitting || isExecuting}
              className={`h-9 text-sm ${error ? 'border-red-500' : ''}`}
              min={field.type === 'number' ? field.validation?.min : undefined}
              max={field.type === 'number' ? field.validation?.max : undefined}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )
      
      case 'textarea':
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs font-medium">
              {field.displayName}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isSubmitting || isExecuting}
              rows={field.rows || 3}
              className={`text-sm resize-none ${error ? 'border-red-500' : ''}`}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )
      
      case 'options':
        const selectOptions = (field.options || []).filter((opt): opt is FormFieldOption => 'value' in opt)
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs font-medium">
              {field.displayName}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleFieldChange(field.name, val)}
              disabled={isSubmitting || isExecuting}
            >
              <SelectTrigger className={`h-9 text-sm ${error ? 'border-red-500' : ''}`}>
                <SelectValue placeholder={field.placeholder || 'Select an option...'} />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )
      
      case 'boolean':
        return (
          <div key={field.name} className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.name}
                checked={value === true}
                onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
                disabled={isSubmitting || isExecuting}
              />
              <Label 
                htmlFor={field.name} 
                className="text-xs font-medium cursor-pointer"
              >
                {field.displayName}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground ml-6">{field.description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500 ml-6">{error}</p>
            )}
          </div>
        )
      

      
      case 'dateTime':
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs font-medium">
              {field.displayName}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={isSubmitting || isExecuting}
              className={`h-9 text-sm ${error ? 'border-red-500' : ''}`}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )
      

      
      default:
        return null
    }
  }, [formValues, errors, isSubmitting, isExecuting, handleFieldChange, parseOptions])
  
  // Header info
  const headerInfo = useMemo(() => 
    formFieldConfigs.length > 0 
      ? `${formFieldConfigs.length} field${formFieldConfigs.length !== 1 ? 's' : ''}`
      : 'No fields configured',
    [formFieldConfigs.length]
  )
  
  // Collapsed content - just show field count
  const collapsedContent = useMemo(() => (
    <div className="text-xs text-muted-foreground text-center py-1">
      {formFieldConfigs.length === 0 ? (
        <p>Configure form fields in properties</p>
      ) : (
        <p>Click to expand and view form</p>
      )}
    </div>
  ), [formFieldConfigs.length])
  
  // Expanded content - render the full form
  const expandedContent = useMemo(() => (
    <>
      {/* Form Area */}
      <div className="max-h-[400px] overflow-y-auto p-4">
        {formFieldConfigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm text-center">No form fields configured</p>
            <p className="text-xs text-center mt-1">
              Open properties to add form fields
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form Title and Description */}
            {formTitle && (
              <div className="mb-4">
                <h3 className="text-base font-semibold">{formTitle}</h3>
                {formDescription && (
                  <p className="text-xs text-muted-foreground mt-1">{formDescription}</p>
                )}
              </div>
            )}
            
            {/* Form Fields */}
            <div className="space-y-4">
              {formFieldConfigs.map(field => renderField(field))}
            </div>
            
            {/* Form-level error */}
            {errors._form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600">{errors._form}</p>
              </div>
            )}
            
            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || isExecuting}
                className="w-full h-9 text-sm"
                onClick={handleSubmit}
              >
                {isSubmitting || isExecuting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-2" />
                    {submitButtonText}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  ), [formFieldConfigs, formTitle, formDescription, submitButtonText, isSubmitting, isExecuting, errors, handleSubmit, renderField])
  
  return (
    <BaseNodeWrapper
      id={id}
      selected={selected}
      data={data}
      isReadOnly={isReadOnly}
      isExpanded={isExpanded}
      onToggleExpand={handleToggleExpand}
      Icon={ClipboardList}
      iconColor="bg-green-500"
      collapsedWidth="200px"
      expandedWidth="380px"
      headerInfo={headerInfo}
      collapsedContent={collapsedContent}
      expandedContent={expandedContent}
      showInputHandle={false}
      showOutputHandle={true}
      outputHandleColor="!bg-green-500"
    />
  )
})
