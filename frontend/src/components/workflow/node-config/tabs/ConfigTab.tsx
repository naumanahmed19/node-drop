import { Card, CardContent } from '@/components/ui/card'
import { createField, FormGenerator, getCustomComponent } from '@/components/ui/form-generator'
import { useCredentialStore, useNodeConfigDialogStore } from '@/stores'
import { NodeType, WorkflowNode } from '@/types'
import { NodeValidator } from '@/utils/nodeValidation'
import {
    AlertCircle,
    CheckCircle
} from 'lucide-react'
import { useEffect } from 'react'

interface ConfigTabProps {
  node: WorkflowNode
  nodeType: NodeType
  readOnly?: boolean
}

export function ConfigTab({ node, nodeType, readOnly = false }: ConfigTabProps) {
  const { fetchCredentials, fetchCredentialTypes } = useCredentialStore()
  const {
    parameters,
    nodeName,
    credentials,
    validationErrors,
    hasUnsavedChanges,
    updateParameters,
    updateCredentials,
    setValidationErrors
  } = useNodeConfigDialogStore()

  useEffect(() => {
    fetchCredentials()
    fetchCredentialTypes()
  }, [fetchCredentials, fetchCredentialTypes])

  useEffect(() => {
    const validation = NodeValidator.validateNode(
      { ...node, name: nodeName, parameters, credentials: Object.values(credentials) },
      nodeType.properties
    )
    setValidationErrors(validation.errors)
  }, [node.id, nodeName, parameters, credentials, nodeType.properties, setValidationErrors])

  // Convert all node properties to FormFieldConfig for use with FormGenerator
  const formFields = nodeType.properties?.map(property => {
    const fieldConfig = createField({
      name: property.name,
      displayName: property.displayName,
      type: property.type as any,
      required: property.required,
      default: property.default,
      description: property.description,
      tooltip: property.tooltip, // Add tooltip support
      placeholder: property.placeholder,
      options: property.options,
      displayOptions: property.displayOptions,
      typeOptions: property.typeOptions, // For collection with multipleValues
      component: property.component, // For custom components
      componentProps: property.componentProps, // For nested fields in collection
      allowedTypes: property.allowedTypes, // For credential type
    })

    // If this is a custom component, set the customComponent function
    if (property.type === 'custom' && property.component) {
      const customComponent = getCustomComponent(property.component)
      if (customComponent) {
        fieldConfig.customComponent = customComponent
      }
    }

    return fieldConfig
  }) || []

  // Get validation errors in the format expected by FormGenerator
  const formErrors = validationErrors.reduce((acc, error) => {
    acc[error.field] = error.message
    return acc
  }, {} as Record<string, string>)

  // Handle parameter changes, filtering out internal keys like __credentials
  const handleParameterChange = (fieldName: string, value: any) => {
    // Don't save internal keys like __credentials
    if (fieldName === '__credentials') {
      return
    }
    
    // Check if this field is a credential type
    const field = nodeType.properties?.find(p => p.name === fieldName)
    
    if (field?.type === 'credential') {
      // Store the credential ID in parameters (new approach)
      updateParameters(fieldName, value)
      
      // Also update the credentials object for backward compatibility
      // Clear all existing credentials for this field's allowed types first
      const allowedTypes = field.allowedTypes || []
      allowedTypes.forEach(type => {
        updateCredentials(type, undefined)
      })
      
      // If a credential is selected, find its type and set it
      if (value) {
        const selectedCred = useCredentialStore.getState().credentials.find(c => c.id === value)
        if (selectedCred) {
          updateCredentials(selectedCred.type, value)
        }
      }
      return
    }
    
    updateParameters(fieldName, value)
  }

  return (
    <div className="h-[calc(100dvh-222px)] overflow-y-auto p-4 pb-8 bg-muted/30">
      <div className="space-y-6 max-w-lg mb-8">
        {/* Unified Form - includes all properties (including credential fields) */}
        {formFields.length > 0 && (
          <FormGenerator
            fields={formFields}
            values={{
              ...parameters,
              // Add credential field values - check parameters first, then credentials object
              ...Object.fromEntries(
                formFields
                  .filter(f => f.type === 'credential')
                  .map(f => {
                    // If already in parameters, use that
                    if (parameters[f.name]) {
                      return [f.name, parameters[f.name]]
                    }
                    // Otherwise, find credential from credentials object by matching allowed types
                    const allowedTypes = f.allowedTypes || []
                    for (const type of allowedTypes) {
                      if (credentials[type]) {
                        return [f.name, credentials[type]]
                      }
                    }
                    return [f.name, '']
                  })
              ),
              // Include credentials so custom components can access them
              __credentials: credentials,
            }}
            errors={formErrors}
            onChange={handleParameterChange}
            showRequiredIndicator={true}
            fieldClassName="space-y-2"
            nodeId={node.id}
            nodeType={node.type}
            disabled={readOnly}
          />
        )}

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
        {validationErrors.length === 0 && hasUnsavedChanges && (
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
      </div>
    </div>
  )
}
