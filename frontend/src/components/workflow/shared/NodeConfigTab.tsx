import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createField, FormGenerator, getCustomComponent } from '@/components/ui/form-generator'
import { useCredentialStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { NodeValidator, ValidationError } from '@/utils/nodeValidation'

interface NodeConfigTabProps {
  node: WorkflowNode
  nodeType: NodeType
  /** Called when node parameters or credentials change */
  onNodeUpdate: (updates: { parameters?: Record<string, any>; credentials?: string[] }) => void
  disabled?: boolean
  showValidationSummary?: boolean
  onValidationChange?: (errors: ValidationError[]) => void
}

/**
 * Shared component for node configuration form with validation
 * Used by QuickSettingsPanel and NodeConfigDialog's ConfigTab
 */
export const NodeConfigTab = memo(function NodeConfigTab({
  node,
  nodeType,
  onNodeUpdate,
  disabled = false,
  showValidationSummary = true,
  onValidationChange,
}: NodeConfigTabProps) {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const { credentials, fetchCredentials, fetchCredentialTypes } = useCredentialStore()

  const nodeParameters = node.parameters || {}
  const nodeCredentials = node.credentials || []

  // Fetch credentials on mount
  useEffect(() => {
    fetchCredentials()
    fetchCredentialTypes()
  }, [fetchCredentials, fetchCredentialTypes])

  // Validation effect
  useEffect(() => {
    const validation = NodeValidator.validateNode(
      { ...node, parameters: nodeParameters, credentials: nodeCredentials },
      nodeType.properties
    )
    setValidationErrors(validation.errors)
    onValidationChange?.(validation.errors)
  }, [node, nodeType, nodeParameters, nodeCredentials, onValidationChange])

  // Convert node properties to form fields
  const formFields = useMemo(() => {
    return nodeType.properties?.map(property => {
      const fieldConfig = createField({
        name: property.name,
        displayName: property.displayName,
        type: property.type as any,
        required: property.required,
        default: property.default,
        description: property.description,
        tooltip: property.tooltip,
        placeholder: property.placeholder,
        options: property.options,
        displayOptions: property.displayOptions,
        typeOptions: property.typeOptions,
        component: property.component,
        componentProps: property.componentProps,
        allowedTypes: property.allowedTypes,
      })

      if (property.type === 'custom' && property.component) {
        const customComponent = getCustomComponent(property.component)
        if (customComponent) {
          fieldConfig.customComponent = customComponent
        }
      }

      return fieldConfig
    }) || []
  }, [nodeType.properties])

  // Get validation errors in format for FormGenerator
  const formErrors = useMemo(() => {
    return validationErrors.reduce((acc, error) => {
      acc[error.field] = error.message
      return acc
    }, {} as Record<string, string>)
  }, [validationErrors])

  // Prepare form values with credential resolution
  const formValues = useMemo(() => {
    const values = { ...nodeParameters }
    
    // Add credential field values
    formFields
      .filter(f => f.type === 'credential')
      .forEach(f => {
        if (nodeParameters[f.name]) {
          values[f.name] = nodeParameters[f.name]
        } else {
          const allowedTypes = f.allowedTypes || []
          for (const type of allowedTypes) {
            const credId = nodeCredentials.find(credId => {
              const cred = credentials.find(c => c.id === credId)
              return cred && cred.type === type
            })
            if (credId) {
              values[f.name] = credId
              break
            }
          }
        }
      })
    
    return values
  }, [nodeParameters, nodeCredentials, credentials, formFields])

  // Handle field changes with credential logic
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    if (disabled) return

    const field = nodeType.properties?.find(p => p.name === fieldName)

    if (field?.type === 'credential') {
      // Handle credential field - update both parameters and credentials array
      const newParameters = { ...nodeParameters, [fieldName]: value }
      const allowedTypes = field.allowedTypes || []
      
      // Filter out old credentials of the same type
      let newCredentials = [...nodeCredentials].filter(credId => {
        const cred = credentials.find(c => c.id === credId)
        return !cred || !allowedTypes.includes(cred.type)
      })
      
      // Add new credential if selected
      if (value) {
        newCredentials.push(value)
      }
      
      onNodeUpdate({ parameters: newParameters, credentials: newCredentials })
    } else {
      // Regular field - just update parameters
      onNodeUpdate({ parameters: { ...nodeParameters, [fieldName]: value } })
    }
  }, [disabled, nodeType.properties, nodeParameters, nodeCredentials, credentials, onNodeUpdate])

  if (formFields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        No configuration parameters available
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <FormGenerator
        fields={formFields}
        values={formValues}
        errors={formErrors}
        onChange={handleFieldChange}
        disabled={disabled}
        showRequiredIndicator={true}
        nodeId={node.id}
        nodeType={nodeType.identifier}
      />

      {showValidationSummary && (
        <>
          {/* Validation Summary */}
          {validationErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">
                    {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ul className="text-sm text-red-600 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error.message}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Success Indicator */}
          {validationErrors.length === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    Configuration is valid
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
})
