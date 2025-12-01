import { memo, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createField, FormGenerator } from '@/components/ui/form-generator'
import { FormFieldConfig } from '@/components/ui/form-generator/types'
import { useWorkflowStore, useCredentialStore } from '@/stores'
import { NodeSetting, NodeType, WorkflowNode } from '@/types'
import { useState } from 'react'

interface QuickSettingsPanelProps {
  node: WorkflowNode | null
  nodeType: NodeType | null
  readOnly?: boolean
}

// Default settings available for all nodes
const DEFAULT_SETTINGS: Record<string, NodeSetting> = {
  continueOnFail: {
    displayName: 'Continue On Fail',
    name: 'continueOnFail',
    type: 'boolean',
    default: false,
    description: 'If enabled, the node will continue execution even if an error occurs.',
  },
  alwaysOutputData: {
    displayName: 'Always Output Data',
    name: 'alwaysOutputData',
    type: 'boolean',
    default: false,
    description: 'If enabled, the node will always output data, including error responses.',
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
    description: 'If enabled, the node will automatically retry execution if it fails.',
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
    description: 'Maximum time in milliseconds the node is allowed to run before timing out.',
  },
}

export const QuickSettingsPanel = memo(function QuickSettingsPanel({
  node,
  nodeType,
  readOnly = false,
}: QuickSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState('config')
  const { updateNode } = useWorkflowStore()
  const { credentials } = useCredentialStore()

  const nodeSettings = node?.settings || {}
  const nodeParameters = node?.parameters || {}
  const nodeCredentials = node?.credentials || []

  // Get all available settings
  const allSettings: Record<string, NodeSetting> = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...(nodeType?.settings || {}),
    }),
    [nodeType?.settings]
  )

  // Convert settings to FormFieldConfig format
  const settingsFields = useMemo<FormFieldConfig[]>(() => {
    return Object.entries(allSettings)
      .filter(([_, setting]) => !setting.hidden)
      .map(([settingName, setting]) => {
        let fieldType: FormFieldConfig['type'] = 'string'
        if (setting.type === 'boolean') fieldType = 'switch'
        else if (setting.type === 'number') fieldType = 'number'
        else if (setting.type === 'options') fieldType = 'options'
        else if (setting.type === 'json') fieldType = 'json'

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
      nodeType?.properties?.map((property) => {
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
  }, [nodeType?.properties])

  // Handle settings changes
  const handleSettingsChange = (fieldName: string, value: any) => {
    if (readOnly || !node) return
    const newSettings = { ...nodeSettings, [fieldName]: value }
    if (fieldName === 'continueOnFail' && value === false) {
      newSettings.alwaysOutputData = false
    }
    updateNode(node.id, { settings: newSettings })
  }

  // Handle config parameter changes
  const handleConfigChange = (fieldName: string, value: any) => {
    if (readOnly || !node) return

    const field = nodeType?.properties?.find((p) => p.name === fieldName)

    if (field?.type === 'credential') {
      const newParameters = { ...nodeParameters, [fieldName]: value }
      const allowedTypes = field.allowedTypes || []
      let newCredentials = [...nodeCredentials]
      newCredentials = newCredentials.filter((credId) => {
        const cred = credentials.find((c) => c.id === credId)
        return !cred || !allowedTypes.includes(cred.type)
      })
      if (value) newCredentials.push(value)
      updateNode(node.id, { parameters: newParameters, credentials: newCredentials })
    } else {
      updateNode(node.id, { parameters: { ...nodeParameters, [fieldName]: value } })
    }
  }

  // Prepare config values
  const configValues = useMemo(() => {
    const values = { ...nodeParameters }
    configFields
      .filter((f) => f.type === 'credential')
      .forEach((f) => {
        if (nodeParameters[f.name]) {
          values[f.name] = nodeParameters[f.name]
        } else {
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

  // No node selected state
  if (!node || !nodeType) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Select a node to view its settings</p>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b">
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="config" className="text-xs h-6 px-2">
            Config
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs h-6 px-2">
            Settings
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="config" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto p-3">
          {configFields.length > 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Configure node parameters</p>
              <FormGenerator
                fields={configFields}
                values={configValues}
                onChange={handleConfigChange}
                disabled={readOnly}
                showRequiredIndicator={true}
                nodeId={node.id}
                nodeType={nodeType.identifier}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">
              No configuration parameters available
            </p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="settings" className="flex-1 min-h-0 mt-0 relative">
        <div className="absolute inset-0 overflow-auto p-3">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Configure execution settings</p>
            <FormGenerator
              fields={settingsFields}
              values={nodeSettings}
              onChange={handleSettingsChange}
              disabled={readOnly}
              showRequiredIndicator={false}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
})
