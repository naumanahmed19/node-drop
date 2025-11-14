import { FormGenerator } from '@/components/ui/form-generator/FormGenerator'
import { FormFieldConfig } from '@/components/ui/form-generator/types'
import { useNodeConfigDialogStore } from '@/stores'
import { NodeSetting, NodeType, WorkflowNode } from '@/types'
import { useMemo } from 'react'

interface SettingsTabProps {
  node: WorkflowNode
  nodeType: NodeType
  readOnly?: boolean
}

// Default settings available for all nodes
const DEFAULT_SETTINGS: Record<string, NodeSetting> = {
  continueOnFail: {
    displayName: 'Continue On Fail',
    name: 'continueOnFail',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will continue execution even if an error occurs. The error information will be returned as output data instead of stopping the workflow.',
  },
  alwaysOutputData: {
    displayName: 'Always Output Data',
    name: 'alwaysOutputData',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will always output data, including error responses. Useful when you want to process error responses in your workflow.',
    displayOptions: {
      show: {
        continueOnFail: [true],
      },
    },
  },
  retryOnFail: {
    displayName: 'Retry On Fail',
    name: 'retryOnFail',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will automatically retry execution if it fails.',
  },
  maxRetries: {
    displayName: 'Max Retries',
    name: 'maxRetries',
    type: 'number',
    default: 3,
    description: 'Maximum number of retry attempts',
    displayOptions: {
      show: {
        retryOnFail: [true],
      },
    },
  },
  retryDelay: {
    displayName: 'Retry Delay (ms)',
    name: 'retryDelay',
    type: 'number',
    default: 1000,
    description: 'Delay between retry attempts in milliseconds',
    displayOptions: {
      show: {
        retryOnFail: [true],
      },
    },
  },
  timeout: {
    displayName: 'Timeout (ms)',
    name: 'timeout',
    type: 'number',
    default: 30000,
    description:
      'Maximum time in milliseconds the node is allowed to run before timing out. Set to 0 for no timeout.',
  },
  notes: {
    displayName: 'Notes',
    name: 'notes',
    type: 'string',
    default: '',
    description:
      'Add notes or comments about this node. Notes are for documentation purposes only and do not affect execution.',
    placeholder: 'Add notes about this node...',
  },
}

export function SettingsTab({ nodeType, readOnly = false }: SettingsTabProps) {
  const { nodeSettings, updateNodeSettings } = useNodeConfigDialogStore()

  // Get all available settings (default + custom from node type)
  const allSettings: Record<string, NodeSetting> = {
    ...DEFAULT_SETTINGS,
    ...(nodeType.settings || {}),
  }

  // Convert settings to FormFieldConfig format - memoized to prevent infinite re-renders
  const formFields = useMemo<FormFieldConfig[]>(() => {
    return Object.entries(allSettings)
      .filter(([_, setting]) => !setting.hidden)
      .map(([settingName, setting]) => {
        // Map setting type to form field type
        let fieldType: FormFieldConfig['type'] = 'string'
        
        if (setting.type === 'boolean') {
          fieldType = 'switch' // Use switch instead of boolean for better UI
        } else if (setting.type === 'number') {
          fieldType = 'number'
        } else if (setting.type === 'options') {
          fieldType = 'options'
        } else if (setting.type === 'json') {
          fieldType = 'json'
        } else if (settingName === 'notes') {
          fieldType = 'textarea' // Notes should be textarea
        } else {
          fieldType = 'string'
        }

        return {
          name: settingName,
          displayName: setting.displayName,
          type: fieldType,
          description: setting.description,
          default: setting.default,
          placeholder: setting.placeholder,
          disabled: setting.disabled,
          required: false, // Settings are always optional
          options: setting.options,
          displayOptions: setting.displayOptions,
          rows: settingName === 'notes' ? 4 : undefined,
        } as FormFieldConfig
      })
  }, [allSettings])

  // Handle field value changes
  const handleFieldChange = (fieldName: string, value: any) => {
    if (readOnly) return

    const newSettings = {
      ...nodeSettings,
      [fieldName]: value,
    }

    // If continueOnFail is being disabled, also disable alwaysOutputData
    // since alwaysOutputData only makes sense when continueOnFail is enabled
    if (fieldName === 'continueOnFail' && value === false) {
      newSettings.alwaysOutputData = false
    }

    updateNodeSettings(newSettings)
  }

  return (
   <div className="h-[calc(100dvh-222px)] overflow-y-auto p-4">
      <div className="p-6 space-y-6">
    

        {/* Settings Form using FormGenerator */}
        <FormGenerator
          fields={formFields}
          values={nodeSettings || {}}
          onChange={handleFieldChange}
          disabled={readOnly}
          showRequiredIndicator={false}
        />


      </div>
    </div>
  )
}
