import { useEffect, useState, useMemo } from 'react'
import { useWorkflowStore } from '@/stores'
import { MiniExpressionEditor } from '@/components/ui/expression-editor'
import type { VariableCategory } from '@/components/ui/expression-editor'
import { defaultVariableCategories } from '@/components/ui/expression-editor/default-categories'
import { buildMockDataFromWorkflow } from '@/utils/workflowDataUtils'
import { variableService } from '@/services/variable.service'
import type { Variable } from '@/types/variable'

interface WorkflowExpressionFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  error?: string
  nodeId?: string
  customVariableCategories?: VariableCategory[]
}

/**
 * WorkflowExpressionField - A wrapper around MiniExpressionEditor that handles workflow-specific logic
 * Automatically builds mock data and variable categories from connected workflow nodes
 */
export function WorkflowExpressionField({
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  nodeId,
  customVariableCategories,
}: WorkflowExpressionFieldProps) {
  const [variables, setVariables] = useState<Variable[]>([])
  const [mockData, setMockData] = useState<Record<string, unknown>>({
    $json: {},
    $workflow: { id: 'workflow-id', name: 'Workflow Name', active: true },
    $execution: { id: 'execution-id', mode: 'manual' },
    $vars: {},
  })

  // Call hooks at top level
  const workflowStore = useWorkflowStore()
  const workflow = workflowStore.workflow
  const executionId = workflowStore.executionState?.executionId

  // Fetch variables and build mock data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedVariables = await variableService.getVariables()
        setVariables(fetchedVariables)
        
        // Convert variables to object
        const varsObject: Record<string, string> = {}
        fetchedVariables.forEach((variable) => {
          varsObject[variable.key] = variable.value
        })
        
        // Build mock data with workflow data
        const data = await buildMockDataFromWorkflow(
          nodeId,
          workflow || undefined,
          executionId,
          (sourceNodeId) => workflowStore.getNodeExecutionResult(sourceNodeId),
          varsObject
        )
        setMockData(data)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [nodeId, workflow, executionId, workflowStore])

  // Memoize variable items to avoid recalculation
  const variableItems = useMemo(() => {
    if (variables.length === 0) return []
    return variables.map((variable) => ({
      label: `$vars.${variable.key}`,
      type: 'property' as const,
      description: variable.description || `Value: ${variable.value.substring(0, 50)}${variable.value.length > 50 ? '...' : ''}`,
      insertText: `$vars.${variable.key}`,
    }))
  }, [variables])

  // Memoize connected node categories - using $node["Node Name"].json format (user-friendly)
  // Note: Backend supports both node ID and node name, but names are more readable
  const connectedNodeCategories = useMemo(() => {
    const categories: VariableCategory[] = []
    
    if (!nodeId || !workflow) return categories

    try {
      const inputConnections = workflow.connections.filter(
        (conn) => conn.targetNodeId === nodeId
      )

      inputConnections.forEach((connection) => {
        const sourceNodeId = connection.sourceNodeId
        const sourceNode = workflow.nodes.find(n => n.id === sourceNodeId)
        if (!sourceNode) return

        const nodeName = sourceNode.name
        const categoryName = `${nodeName}` // Display name for UI
        // Use node name for user-friendly reference (backend supports both ID and name)
        const nodeBasePath = `$node["${nodeName}"].json`

        const sourceNodeResult = workflowStore.getNodeExecutionResult(sourceNodeId)

        if (!sourceNodeResult?.data) {
          categories.push({
            name: categoryName,
            icon: 'input',
            items: [
              {
                label: nodeBasePath,
                type: 'variable' as const,
                description: 'Node not executed yet - run the workflow to see available fields',
                insertText: nodeBasePath,
              },
            ],
          })
          return
        }

        let sourceData: any[] = []
        if (sourceNodeResult.data.main && Array.isArray(sourceNodeResult.data.main)) {
          sourceData = sourceNodeResult.data.main
        }

        if (sourceData.length === 0) {
          categories.push({
            name: categoryName,
            icon: 'input',
            items: [
              {
                label: nodeBasePath,
                type: 'variable' as const,
                description: 'No data available - check node execution',
                insertText: nodeBasePath,
              },
            ],
          })
          return
        }

        let firstItem = sourceData[0]?.json || sourceData[0]
        if (!firstItem || typeof firstItem !== 'object') {
          categories.push({
            name: categoryName,
            icon: 'input',
            items: [
              {
                label: nodeBasePath,
                type: 'variable' as const,
                description: 'Data structure not available',
                insertText: nodeBasePath,
              },
            ],
          })
          return
        }

        // Handle array data - use [0] to access first item
        let isArrayData = false
        if (Array.isArray(firstItem) && firstItem.length > 0) {
          isArrayData = true
          firstItem = firstItem[0]
          if (!firstItem || typeof firstItem !== 'object') {
            categories.push({
              name: categoryName,
              icon: 'input',
              items: [
                {
                  label: `${nodeBasePath}[0]`,
                  type: 'variable' as const,
                  description: 'Array data available',
                  insertText: `${nodeBasePath}[0]`,
                },
              ],
            })
            return
          }
        }

        // Build the base path for properties
        const basePath = isArrayData ? `${nodeBasePath}[0]` : nodeBasePath

        const items = Object.entries(firstItem).map(([key, val]) => {
          let valuePreview = ''

          if (val === null) {
            valuePreview = 'null'
          } else if (Array.isArray(val)) {
            valuePreview = `array[${val.length}]`
          } else if (typeof val === 'object') {
            const objKeys = Object.keys(val).slice(0, 3).join(', ')
            valuePreview = `{ ${objKeys}${Object.keys(val).length > 3 ? ', ...' : ''} }`
          } else if (typeof val === 'string') {
            valuePreview = `"${val.substring(0, 40)}${val.length > 40 ? '...' : ''}"`
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            valuePreview = String(val)
          } else {
            valuePreview = String(val).substring(0, 40)
          }

          const fullPath = `${basePath}.${key}`

          return {
            label: key,
            type: 'property' as const,
            description: valuePreview,
            insertText: fullPath,
          }
        })

        if (items.length > 0) {
          categories.push({
            name: categoryName,
            icon: 'input',
            items,
          })
        }
      })
    } catch (error) {
      console.error('Error building variable categories:', error)
    }

    return categories
  }, [nodeId, workflow, workflowStore])

  // Build variable categories with memoization
  const variableCategories = useMemo(() => {
    const categories: VariableCategory[] = []

    // Add workflow info category
    categories.push({
      name: 'Workflow Info',
      icon: 'workflow',
      items: [
        {
          label: '$workflow.id',
          type: 'property',
          description: 'Workflow ID',
          insertText: '$workflow.id',
        },
        {
          label: '$workflow.name',
          type: 'property',
          description: 'Workflow name',
          insertText: '$workflow.name',
        },
        {
          label: '$workflow.active',
          type: 'property',
          description: 'Is active',
          insertText: '$workflow.active',
        },
        {
          label: '$execution.id',
          type: 'property',
          description: 'Execution ID',
          insertText: '$execution.id',
        },
        {
          label: '$execution.mode',
          type: 'property',
          description: 'Execution mode',
          insertText: '$execution.mode',
        },
      ],
    })

    // Add variables category
    if (variableItems.length > 0) {
      categories.push({
        name: 'Variables',
        icon: 'variable',
        items: variableItems,
      })
    }

    // Add connected node categories
    categories.push(...connectedNodeCategories)

    // Add custom categories if provided
    if (customVariableCategories && customVariableCategories.length > 0) {
      categories.push(...customVariableCategories)
    }

    // Add default categories
    categories.push(...defaultVariableCategories)

    return categories
  }, [variableItems, connectedNodeCategories, customVariableCategories])

  return (
    <MiniExpressionEditor
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      error={error}
      mockData={mockData}
      variableCategories={variableCategories}
    />
  )
}
