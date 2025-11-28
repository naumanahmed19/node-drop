import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createField, FormGenerator } from '@/components/ui/form-generator'
import { FormFieldConfig } from '@/components/ui/form-generator/types'
import { useWorkflowStore, useCredentialStore } from '@/stores'
import { NodeSetting, NodeType } from '@/types'
import { Settings, Sliders } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import './toolbar-buttons.css'

interface ConfigToolbarButtonProps {
  nodeId: string
  nodeType: NodeType
  disabled?: boolean
}

// Default settings available for all nodes
const DEFAULT_SETTINGS: Record<string, NodeSetting> = {
  continueOnFail: {
    displayName: 'Continue On Fail',
    name: 'continueOnFail',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will continue execution even if an error occurs.',
  },
  alwaysOutputData: {
    displayName: 'Always Output Data',
    name: 'alwaysOutputData',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will always output data, including error responses.',
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
      'Maximum time in milliseconds the node is allowed to run before timing out.',
  },
}

export const ConfigToolbarButton = memo(function ConfigToolbarButton({
  nodeId,
  nodeType,
  disabled = false,
}: ConfigToolbarButtonProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const { workflow, updateNode } = useWorkflowStore()
  const { credentials } = useCredentialStore()

  // Get current node
  const node = workflow?.nodes.find((n) => n.id === nodeId)
  const nodeSettings = node?.settings || {}
  const nodeParameters = node?.parameters || {}
  const nodeCredentials = node?.credentials || []

  // Get all available settings (default + custom from node type)
  const allSettings: Record<string, NodeSetting> = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...(nodeType.settings || {}),
    }),
    [nodeType.settings]
  )

  // Convert settings to FormFieldConfig format
  const settingsFields = useMemo<FormFieldConfig[]>(() => {
    return Object.entries(allSettings)
      .filter(([_, setting]) => !setting.hidden)
      .map(([settingName, setting]) => {
        // Map setting type to form field type
        let fieldType: FormFieldConfig['type'] = 'string'

        if (setting.type === 'boolean') {
          fieldType = 'switch'
        } else if (setting.type === 'number') {
          fieldType = 'number'
        } else if (setting.type === 'options') {
          fieldType = 'options'
        } else if (setting.type === 'json') {
          fieldType = 'json'
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
        } as FormFieldConfig
      })
  }, [allSettings])

  // Convert node properties to FormFieldConfig format
  const configFields = useMemo<FormFieldConfig[]>(() => {
    return (
      nodeType.properties?.map((property) => {
        return createField({
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
          allowedTypes: property.allowedTypes,
        })
      }) || []
    )
  }, [nodeType.properties])

  // Handle settings field value changes
  const handleSettingsChange = (fieldName: string, value: any) => {
    if (disabled) return

    const newSettings = {
      ...nodeSettings,
      [fieldName]: value,
    }

    // If continueOnFail is being disabled, also disable alwaysOutputData
    if (fieldName === 'continueOnFail' && value === false) {
      newSettings.alwaysOutputData = false
    }

    updateNode(nodeId, { settings: newSettings })
  }

  // Handle config parameter changes
  const handleConfigChange = (fieldName: string, value: any) => {
    if (disabled) return

    // Check if this field is a credential type
    const field = nodeType.properties?.find((p) => p.name === fieldName)

    if (field?.type === 'credential') {
      // Store the credential ID in parameters
      const newParameters = {
        ...nodeParameters,
        [fieldName]: value,
      }

      // Also update the credentials array for backward compatibility
      const allowedTypes = field.allowedTypes || []
      let newCredentials = [...nodeCredentials]

      // Remove old credentials of this type
      newCredentials = newCredentials.filter((credId) => {
        const cred = credentials.find((c) => c.id === credId)
        return !cred || !allowedTypes.includes(cred.type)
      })

      // Add new credential if selected
      if (value) {
        newCredentials.push(value)
      }

      updateNode(nodeId, {
        parameters: newParameters,
        credentials: newCredentials,
      })
    } else {
      // Regular parameter
      updateNode(nodeId, {
        parameters: {
          ...nodeParameters,
          [fieldName]: value,
        },
      })
    }
  }

  // Prepare credential values for config form
  const configValues = useMemo(() => {
    const values = { ...nodeParameters }

    // Add credential field values
    configFields
      .filter((f) => f.type === 'credential')
      .forEach((f) => {
        // If already in parameters, use that
        if (nodeParameters[f.name]) {
          values[f.name] = nodeParameters[f.name]
        } else {
          // Otherwise, find credential from credentials array by matching allowed types
          const allowedTypes = f.allowedTypes || []
          for (const type of allowedTypes) {
            const credId = nodeCredentials.find((credId) => {
              const cred = credentials.find((c) => c.id === credId)
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
  }, [nodeParameters, nodeCredentials, credentials, configFields])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="toolbar-button"
          disabled={disabled}
          title="Quick Configuration"
          aria-label="Quick Configuration"
          tabIndex={0}
          role="button"
        >
          <Sliders className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-h-[600px] overflow-hidden p-0"
        align="center"
        side="bottom"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pt-3 pb-2 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config" className="text-xs">
                <Sliders className="h-3 w-3 mr-1.5" />
                Config
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                <Settings className="h-3 w-3 mr-1.5" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            <TabsContent value="config" className="mt-0 p-4">
              {configFields.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Configure node parameters
                  </p>
                  <FormGenerator
                    fields={configFields}
                    values={configValues}
                    onChange={handleConfigChange}
                    disabled={disabled}
                    showRequiredIndicator={true}
                    nodeId={nodeId}
                    nodeType={nodeType.identifier}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No configuration parameters available
                </p>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-0 p-4">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Configure execution settings
                </p>
                <FormGenerator
                  fields={settingsFields}
                  values={nodeSettings}
                  onChange={handleSettingsChange}
                  disabled={disabled}
                  showRequiredIndicator={false}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
})

ConfigToolbarButton.displayName = 'ConfigToolbarButton'
