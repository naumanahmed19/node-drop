import { Button } from '@/components/ui/button'
import { FormGenerator } from '@/components/ui/form-generator/FormGenerator'
import { FormFieldConfig, FormGeneratorRef } from '@/components/ui/form-generator/types'
import { useExecutionControls } from '@/hooks/workflow'
import { useWorkflowStore } from '@/stores'
import { Node, NodeProps } from '@xyflow/react'
import { ClipboardList, Send } from 'lucide-react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
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
  const { updateNode, executionManager } = useWorkflowStore()
  const { executeWorkflow } = useExecutionControls()

  const isReadOnly = false
  // Check if THIS specific node is executing in the current execution context
  // This prevents cross-trigger contamination where one trigger's execution affects another
  const isExecuting = executionManager.isNodeExecutingInCurrent(id)

  // Memoize parameters
  const parameters = useMemo(() => data.parameters || {}, [data.parameters])

  // Track expanded state
  const [isExpanded, setIsExpanded] = useState(parameters.isExpanded ?? false)

  // Get form configuration from parameters
  const formTitle = useMemo(() => parameters.formTitle || 'Custom Form', [parameters.formTitle])
  const formDescription = useMemo(() => parameters.formDescription || '', [parameters.formDescription])
  const submitButtonText = useMemo(() => parameters.submitButtonText || 'Submit', [parameters.submitButtonText])

  // Parse form fields - now using same structure as FormFieldConfig
  const formFieldConfigs = useMemo<FormFieldConfig[]>(() => {
    const rawFields = parameters.formFields || []
    if (!Array.isArray(rawFields)) return []

    return rawFields.map((field: any, index: number) => {
      const fieldData = field.values || field

      // Generate name from displayName if missing
      const fieldName = fieldData.name ||
        fieldData.displayName?.toLowerCase().replace(/\s+/g, '_') ||
        `field_${index}`

      // Parse options string for select/dropdown fields
      const parseOptions = (optionsStr: string) => {
        if (!optionsStr) return []
        return optionsStr.split(/[\n,]/)
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0)
          .map(opt => ({ name: opt, value: opt }))
      }

      // Build field config - mostly direct mapping now
      const config: FormFieldConfig = {
        name: fieldName,
        displayName: fieldData.displayName || fieldName,
        type: fieldData.type || 'string',
        required: fieldData.required || false,
        default: fieldData.default || '',
        description: fieldData.description || '',
        placeholder: fieldData.placeholder || '',
        rows: fieldData.rows,
        validation: fieldData.validation,
      }

      // Parse options string if it's a string, otherwise use as-is
      if (fieldData.type === 'options' && fieldData.options) {
        config.options = typeof fieldData.options === 'string'
          ? parseOptions(fieldData.options)
          : fieldData.options
      }

      return config
    })
  }, [parameters.formFields])

  // Form state
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form generator ref for validation
  const formGeneratorRef = useRef<FormGeneratorRef>(null)

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

  // Handle field value changes from FormGenerator
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isSubmitting || isExecuting) return

    // Validate form before submission
    const validationErrors = formGeneratorRef.current?.validate()
    if (validationErrors && Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return // Don't submit if there are validation errors
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Update node with form data before execution
      updateNode(id, {
        parameters: {
          ...parameters,
          lastSubmission: formValues,
          submittedFormData: formValues,
          submittedAt: new Date().toISOString()
        },
        disabled: false
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Execute workflow
      await executeWorkflow(id)

    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({
        _form: `Failed to submit form: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, isExecuting, id, parameters, formValues, updateNode, executeWorkflow])

  // Collapsed content
  // const collapsedContent = useMemo(() => (
  //   <>
  //     {formFieldConfigs.length === 0 ? (
  //       <div className="text-xs text-muted-foreground text-center "><p>Configure form fields in properties</p></div>
  //     ) : null}
  //   </>
  // ), [formFieldConfigs.length])

  // Expanded content
  const expandedContent = useMemo(() => (
    <>
      {formFieldConfigs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm text-center">No form fields configured</p>
          <p className="text-xs text-center mt-1">
            Open properties to add form fields
          </p>
        </div>
      ) : (
        <>
          {/* Scrollable Form Area */}
          <div className="max-h-[300px] overflow-y-auto px-4 pt-4">
            {/* Use FormGenerator component */}
            <FormGenerator
              ref={formGeneratorRef}
              fields={formFieldConfigs}
              values={formValues}
              errors={errors}
              onChange={handleFieldChange}
              disabled={isSubmitting || isExecuting}
              disableAutoValidation={true}
              showRequiredIndicator={true}
            />

          </div>

          {/* Fixed Submit Button Footer */}
          <div className="border-t">
            <div className="p-3 pt-2">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isExecuting || formFieldConfigs.length === 0}
                className="w-full h-9 text-sm"
              >
                {isSubmitting || isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {submitButtonText}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  ), [formFieldConfigs, formTitle, formDescription, submitButtonText, formValues, errors, handleFieldChange, isSubmitting, isExecuting, handleSubmit])

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
  
      expandedContent={expandedContent}
      showInputHandle={false}
      showOutputHandle={true}
      outputHandleColor="!bg-green-500"
    />
  )
})
