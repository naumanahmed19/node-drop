import { useState } from 'react'
import { Book, ChevronDown, ChevronRight, Info, Code, Settings, Key } from 'lucide-react'
import { NodeType, NodeProperty } from '@/types'

interface NodeDocumentationProps {
  nodeType: NodeType
}

export function NodeDocumentation({ nodeType }: NodeDocumentationProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    properties: false,
    credentials: false,
    examples: false
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const renderPropertyType = (property: NodeProperty) => {
    let typeDisplay: string = property.type
    
    if (property.type === 'options' && property.options) {
      const optionValues = property.options.map(opt => opt.value).join(' | ')
      typeDisplay = `options: ${optionValues}`
    } else if (property.type === 'multiOptions' && property.options) {
      const optionValues = property.options.map(opt => opt.value).join(' | ')
      typeDisplay = `multiOptions: ${optionValues}[]`
    }

    return (
      <code className="text-xs bg-muted px-2 py-1 rounded text-primary">
        {typeDisplay}
      </code>
    )
  }

  const renderSection = (
    key: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode
  ) => {
    const isExpanded = expandedSections[key]
    
    return (
      <div className="border rounded-md">
        <button
          onClick={() => toggleSection(key)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors"
        >
          <div className="flex items-center space-x-2">
            {icon}
            <span className="font-medium">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t">
            {content}
          </div>
        )}
      </div>
    )
  }

  const overviewContent = (
    <div className="space-y-3 pt-3">
      <p>{nodeType.description}</p>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">Version:</span>
          <span className="ml-2">{nodeType.version}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Group:</span>
          <span className="ml-2">{nodeType.group.join(', ')}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Inputs:</span>
          <span className="ml-2">{nodeType.inputs.join(', ')}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Outputs:</span>
          <span className="ml-2">{nodeType.outputs.join(', ')}</span>
        </div>
      </div>
    </div>
  )

  const propertiesContent = (
    <div className="space-y-4 pt-3">
      {nodeType.properties.length === 0 ? (
        <p className="text-muted-foreground italic">This node has no configurable properties.</p>
      ) : (
        nodeType.properties.map((property) => (
          <div key={property.name} className="border rounded-md p-3 bg-muted/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium flex items-center space-x-2">
                  <span>{property.displayName}</span>
                  {property.required && (
                    <span className="text-red-500 text-xs">*</span>
                  )}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">{property.description}</p>
              </div>
              {renderPropertyType(property)}
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">Parameter name:</span>
                <code className="ml-1 bg-muted px-1 rounded">{property.name}</code>
              </div>
              
              {property.default !== undefined && (
                <div>
                  <span className="font-medium">Default value:</span>
                  <code className="ml-1 bg-muted px-1 rounded">
                    {JSON.stringify(property.default)}
                  </code>
                </div>
              )}
              
              {property.options && property.options.length > 0 && (
                <div>
                  <span className="font-medium">Available options:</span>
                  <div className="mt-1 space-y-1">
                    {property.options.map((option) => (
                      <div key={option.value} className="ml-2">
                        <code className="bg-muted px-1 rounded text-xs">
                          {option.value}
                        </code>
                        <span className="ml-2">{option.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )

  const credentialsContent = (
    <div className="space-y-3 pt-3">
      {!nodeType.credentials || nodeType.credentials.length === 0 ? (
        <p className="text-muted-foreground italic">This node does not require credentials.</p>
      ) : (
        nodeType.credentials.map((credential) => (
          <div key={credential.name} className="border rounded-md p-3 bg-muted/20">
            <h4 className="font-medium">{credential.displayName}</h4>
            <p className="text-sm text-muted-foreground mt-1">{credential.description}</p>
            <div className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">Type:</span>
              <code className="ml-1 bg-muted px-1 rounded">{credential.name}</code>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const examplesContent = (
    <div className="space-y-4 pt-3">
      <div className="border rounded-md p-3 bg-muted/20">
        <h4 className="font-medium mb-2">Basic Configuration</h4>
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{JSON.stringify({
  type: nodeType.type,
  name: nodeType.displayName,
  parameters: nodeType.defaults
}, null, 2)}
        </pre>
      </div>
      
      {nodeType.properties.length > 0 && (
        <div className="border rounded-md p-3 bg-muted/20">
          <h4 className="font-medium mb-2">Example Parameters</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{JSON.stringify(
  nodeType.properties.reduce((acc, prop) => {
    if (prop.default !== undefined) {
      acc[prop.name] = prop.default
    } else if (prop.type === 'string') {
      acc[prop.name] = `example_${prop.name}`
    } else if (prop.type === 'number') {
      acc[prop.name] = 123
    } else if (prop.type === 'boolean') {
      acc[prop.name] = true
    } else if (prop.type === 'options' && prop.options?.[0]) {
      acc[prop.name] = prop.options[0].value
    }
    return acc
  }, {} as Record<string, any>),
  null,
  2
)}
          </pre>
        </div>
      )}

      <div className="border rounded-md p-3 bg-muted/20">
        <h4 className="font-medium mb-2">Sample Input Data</h4>
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{JSON.stringify({
  main: [
    [
      {
        json: {
          id: 1,
          name: "Sample Item",
          value: "test-value",
          timestamp: new Date().toISOString()
        }
      }
    ]
  ]
}, null, 2)}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          This is the expected input format for testing this node.
        </p>
      </div>

      {nodeType.group.includes('trigger') && (
        <div className="border rounded-md p-3 bg-muted/20">
          <h4 className="font-medium mb-2">Trigger Usage</h4>
          <p className="text-xs text-muted-foreground mb-2">
            This node can be used as a workflow trigger. It will start the workflow when the specified conditions are met.
          </p>
          <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded text-xs text-blue-700 dark:text-blue-400">
            <strong>Note:</strong> Trigger nodes should be placed at the beginning of your workflow.
          </div>
        </div>
      )}

      <div className="border rounded-md p-3 bg-muted/20">
        <h4 className="font-medium mb-2">Common Use Cases</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          {nodeType.group.includes('http') && (
            <li>• Making API calls to external services</li>
          )}
          {nodeType.group.includes('data') && (
            <li>• Processing and transforming data</li>
          )}
          {nodeType.group.includes('trigger') && (
            <li>• Starting workflows based on events</li>
          )}
          {nodeType.group.includes('notification') && (
            <li>• Sending alerts and notifications</li>
          )}
          <li>• Integrating with {nodeType.displayName} services</li>
          <li>• Automating repetitive tasks</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 mb-4">
        <Book className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Node Documentation</h3>
      </div>

      <div className="space-y-2">
        {renderSection('overview', 'Overview', <Info className="w-4 h-4 text-blue-500" />, overviewContent)}
        {renderSection('properties', 'Properties', <Settings className="w-4 h-4 text-green-500" />, propertiesContent)}
        {renderSection('credentials', 'Credentials', <Key className="w-4 h-4 text-purple-500" />, credentialsContent)}
        {renderSection('examples', 'Examples', <Code className="w-4 h-4 text-orange-500" />, examplesContent)}
      </div>
    </div>
  )
}
