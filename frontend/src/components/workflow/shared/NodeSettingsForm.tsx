import { memo, useMemo } from 'react'
import { FormGenerator } from '@/components/ui/form-generator/FormGenerator'
import { FormFieldConfig } from '@/components/ui/form-generator/types'
import { DEFAULT_NODE_SETTINGS } from '@/constants/nodeSettings'
import { NodeType } from '@/types'

interface NodeSettingsFormProps {
  nodeType: NodeType
  values: Record<string, any>
  onChange: (fieldName: string, value: any) => void
  disabled?: boolean
}

/**
 * Reusable form for node execution settings
 * Used by both the sidebar QuickSettingsPanel and the dialog SettingsTab
 */
export const NodeSettingsForm = memo(function NodeSettingsForm({
  nodeType,
  values,
  onChange,
  disabled = false,
}: NodeSettingsFormProps) {
  // Get all available settings (default + custom from node type)
  const allSettings = useMemo(
    () => ({
      ...DEFAULT_NODE_SETTINGS,
      ...(nodeType.settings || {}),
    }),
    [nodeType.settings]
  )

  // Convert settings to FormFieldConfig format
  const formFields = useMemo<FormFieldConfig[]>(() => {
    return Object.entries(allSettings)
      .filter(([_, setting]) => !setting.hidden)
      .map(([settingName, setting]) => {
        let fieldType: FormFieldConfig['type'] = 'string'

        if (setting.type === 'boolean') {
          fieldType = 'switch'
        } else if (setting.type === 'number') {
          fieldType = 'number'
        } else if (setting.type === 'options') {
          fieldType = 'options'
        } else if (setting.type === 'json') {
          fieldType = 'json'
        } else if (settingName === 'notes') {
          fieldType = 'textarea'
        }

        return {
          name: settingName,
          displayName: setting.displayName,
          type: fieldType,
          description: setting.description,
          default: setting.default,
          placeholder: setting.placeholder,
          disabled: setting.disabled,
          required: false,
          options: setting.options,
          displayOptions: setting.displayOptions,
          rows: settingName === 'notes' ? 4 : undefined,
        } as FormFieldConfig
      })
  }, [allSettings])

  // Handle field changes with special logic for dependent fields
  const handleChange = (fieldName: string, value: any) => {
    onChange(fieldName, value)

    // If continueOnFail is being disabled, also disable alwaysOutputData
    if (fieldName === 'continueOnFail' && value === false) {
      onChange('alwaysOutputData', false)
    }
  }

  return (
    <FormGenerator
      fields={formFields}
      values={values}
      onChange={handleChange}
      disabled={disabled}
      showRequiredIndicator={false}
    />
  )
})
