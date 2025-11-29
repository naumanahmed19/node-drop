import { UnifiedCredentialSelector } from '@/components/credential/UnifiedCredentialSelector'
import { AutoComplete, AutoCompleteOption } from '@/components/ui/autocomplete'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { CollectionField } from './CollectionField'
import { ConditionRow } from './ConditionRow'
import { getCustomComponent } from './customComponentRegistry'
import { DynamicAutocomplete } from './DynamicAutocomplete'
import { ExpressionInput } from './ExpressionInput'
import { KeyValueRow } from './KeyValueRow'
import { RepeatingField } from './RepeatingField'
import { SimpleRepeater } from './SimpleRepeater'
import { FormFieldOption, FormFieldRendererProps } from './types'
import { WorkflowExpressionField } from './WorkflowExpressionField'

export function FieldRenderer({
  field,
  value,
  error,
  onChange,
  onBlur,
  disabled,
  allValues,
  allFields,
  onFieldChange,
  nodeId,
  nodeType,
}: FormFieldRendererProps) {
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (newValue: any) => {
    onChange(newValue)
  }

  const handleBlur = () => {
    if (onBlur) {
      onBlur(value)
    }
  }

  // Handle SimpleRepeater component
  if (field.component === 'SimpleRepeater') {
    const operations = field.componentProps?.operations || field.options?.filter((opt): opt is FormFieldOption => 'value' in opt).map(opt => ({
      name: opt.name,
      value: opt.value
    }))
    
    return (
      <SimpleRepeater
        value={Array.isArray(value) ? value : []}
        onChange={handleChange}
        placeholder={field.componentProps?.placeholder}
        operations={operations}
      />
    )
  }

  // Custom field component - support both inline and registry-based components
  if (field.type === 'custom') {
    // First check for inline custom component
    if (field.customComponent) {
      // Extract credentials from allValues for inline components too
      const credentials = allValues?.__credentials || {}
      const credentialId = Object.values(credentials)[0] as string | undefined
      
      // Extract dependsOn fields (same logic as registry-based components)
      const dependsOn = field.componentProps?.dependsOn
      const dependsOnValues: Record<string, any> = {}
      
      if (dependsOn) {
        if (Array.isArray(dependsOn)) {
          // dependsOn is an array: ["spreadsheetId", "sheetName"]
          dependsOn.forEach((key) => {
            dependsOnValues[key] = allValues?.[key]
          })
        } else if (typeof dependsOn === 'string') {
          // dependsOn is a string: "spreadsheetId"
          dependsOnValues[dependsOn] = allValues?.[dependsOn]
        }
      }
      
      return field.customComponent({
        value,
        onChange: handleChange,
        field,
        error,
        disabled,
        allValues,
        allFields,
        onFieldUpdate: onFieldChange,
        credentialId, // Pass credential ID to inline custom components
        ...dependsOnValues, // Pass dependent field values
      })
    }
    
    // Then check for registry-based component
    if (field.component) {
      const CustomComponent = getCustomComponent(field.component)
      
      if (CustomComponent) {
        // Extract credentials from allValues
        const credentials = allValues?.__credentials || {}
        
        // Get the first credential ID (most nodes have only one credential type)
        const credentialId = Object.values(credentials)[0] as string | undefined
        
        // Extract dependsOn fields
        const dependsOn = field.componentProps?.dependsOn
        const dependsOnValues: Record<string, any> = {}
        
        if (dependsOn) {
          if (Array.isArray(dependsOn)) {
            // dependsOn is an array: ["spreadsheetId", "sheetName"]
            dependsOn.forEach((key) => {
              dependsOnValues[key] = allValues?.[key]
            })
          } else if (typeof dependsOn === 'string') {
            // dependsOn is a string: "spreadsheetId"
            dependsOnValues[dependsOn] = allValues?.[dependsOn]
          }
        }
        
        // Filter out dependsOn from componentProps to avoid passing it as a prop
        const { dependsOn: _, ...componentPropsWithoutDependsOn } = field.componentProps || {}
        
        // Merge field.options with componentProps if options exist at field level
        const finalProps = {
          ...componentPropsWithoutDependsOn,
          // If options exist at field level and not in componentProps, add them
          ...(field.options && !componentPropsWithoutDependsOn.options ? { options: field.options } : {}),
        };
        
        return (
          <CustomComponent
            value={value}
            onChange={handleChange}
            disabled={disabled}
            error={error}
            credentialId={credentialId} // Pass credential ID to custom components
            {...finalProps}
            {...dependsOnValues} // Pass dependent field values
          />
        )
      }
    }
    
    // Fallback for unknown custom component
    return (
      <div className="text-sm text-amber-600">
        Custom component "{field.component || 'unknown'}" not found
      </div>
    )
  }

  // Collection type without multipleValues - use CollectionField (single object with optional nested fields)
  if (field.type === 'collection' && !field.typeOptions?.multipleValues) {
    const nestedFields = field.options as any[] || []
    const placeholder = field.placeholder || 'Add Option'
    
    return (
      <CollectionField
        displayName={field.displayName}
        fields={nestedFields}
        value={value || {}}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        allValues={allValues}
        allFields={allFields}
        onFieldChange={onFieldChange}
        nodeId={nodeId}
        nodeType={nodeType}
      />
    )
  }

  // Collection type with multipleValues - use RepeatingField
  if (field.type === 'collection' && field.typeOptions?.multipleValues) {
    // Get nested fields from componentProps
    const nestedFields = field.componentProps?.fields || []
    const buttonText = field.typeOptions?.multipleValueButtonText || 'Add Item'
    const titleField = field.componentProps?.titleField // Get titleField from componentProps
    
    // Normalize value to ensure it has the correct structure
    // Handle backward compatibility: convert old format to new format
    const normalizedValue = Array.isArray(value) 
      ? value.map((item, index) => {
          // If item already has id and values, use it as-is
          if (item && typeof item === 'object' && 'id' in item && 'values' in item) {
            return item
          }
          // Otherwise, wrap it in the expected structure
          return {
            id: item?.id || `item_${Date.now()}_${index}`,
            values: item || {}
          }
        })
      : []
    
    return (
      <RepeatingField
        displayName={field.displayName}
        fields={nestedFields}
        value={normalizedValue}
        onChange={handleChange}
        addButtonText={buttonText}
        titleField={titleField}
        disabled={disabled}
        minItems={field.validation?.min}
        maxItems={field.validation?.max}
        compact={field.componentProps?.compact}
        nodeId={nodeId}
        nodeType={nodeType}
      />
    )
  }

  // FixedCollection type - similar to collection but with predefined structure
  if (field.type === 'fixedCollection' && field.typeOptions?.multipleValues) {
    // Get the first option which contains the field definitions
    const fixedCollectionOptions = field.options as any[]
    if (!fixedCollectionOptions || fixedCollectionOptions.length === 0) {
      return <div className="text-sm text-amber-600">No options defined for fixedCollection</div>
    }
    
    const firstOption = fixedCollectionOptions[0]
    const nestedFields = firstOption.values || []
    const buttonText = field.typeOptions?.multipleValueButtonText || `Add ${firstOption.displayName || 'Item'}`
    const titleField = field.componentProps?.titleField
    
    // Normalize value - fixedCollection stores items under the option name
    const optionName = firstOption.name
    const items = value?.[optionName] || []
    
    const normalizedValue = Array.isArray(items)
      ? items.map((item: any, index: number) => {
          if (item && typeof item === 'object' && 'id' in item && 'values' in item) {
            return item
          }
          return {
            id: item?.id || `item_${Date.now()}_${index}`,
            values: item || {}
          }
        })
      : []
    
    return (
      <RepeatingField
        displayName={field.displayName}
        fields={nestedFields}
        value={normalizedValue}
        onChange={(newValue) => {
          // Wrap the value back in the option name structure
          handleChange({ [optionName]: newValue })
        }}
        addButtonText={buttonText}
        titleField={titleField}
        disabled={disabled}
        minItems={field.validation?.min}
        maxItems={field.validation?.max}
        compact={field.componentProps?.compact}
        nodeId={nodeId}
        nodeType={nodeType}
      />
    )
  }

  switch (field.type) {
    case 'hidden':
      // Render a hidden input field - value is still submitted but not visible
      return (
        <input
          type="hidden"
          name={field.name}
          value={value || ''}
        />
      )

    case 'credential':
      return (
        <UnifiedCredentialSelector
          allowedTypes={field.allowedTypes || []}
          value={value}
          onChange={handleChange}
          placeholder={field.placeholder}
          required={field.required}
          error={error}
          disabled={disabled || field.disabled}
          nodeType={nodeType}
        />
      )

    case 'string':
      // If readonly, show with copy button (same as text type)
      if (field.readonly) {
        const [copied, setCopied] = useState(false)
        
        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(value || '')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch (error) {
            console.error('Failed to copy:', error)
          }
        }
        
        return (
          <div className="relative">
            <Input
              type="text"
              value={value || ''}
              readOnly
              placeholder={field.placeholder}
              className={`pr-20 ${error ? 'border-destructive' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )
      }
      
      return (
        <ExpressionInput
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled}
          error={!!error}
          nodeId={nodeId}
        />
      )

    case 'text':
      // If readonly, show with copy button
      if (field.readonly) {
        const [copied, setCopied] = useState(false)
        
        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(value || '')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch (error) {
            console.error('Failed to copy:', error)
          }
        }
        
        return (
          <div className="relative">
            <Input
              type="text"
              value={value || ''}
              readOnly
              placeholder={field.placeholder}
              className={`pr-20 ${error ? 'border-destructive' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )
      }
      
      return (
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled}
          className={error ? 'border-destructive' : ''}
        />
      )

    case 'password':
      return (
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            disabled={disabled || field.disabled || field.readonly}
            className={`pr-10 ${error ? 'border-destructive' : ''}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      )

    case 'email':
      return (
        <Input
          type="email"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled || field.readonly}
          className={error ? 'border-destructive' : ''}
        />
      )

    case 'url':
      return (
        <Input
          type="url"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled || field.readonly}
          className={error ? 'border-destructive' : ''}
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => {
            const numValue = e.target.value === '' ? '' : parseFloat(e.target.value)
            handleChange(numValue)
          }}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled || field.readonly}
          step={field.step}
          min={field.validation?.min}
          max={field.validation?.max}
          className={error ? 'border-destructive' : ''}
        />
      )

    case 'textarea':
      return (
        <ExpressionInput
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled || field.readonly}
          error={!!error}
          nodeId={nodeId}
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={value || false}
            onCheckedChange={handleChange}
            disabled={disabled || field.disabled}
            id={field.name}
          />
          <label
            htmlFor={field.name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {field.displayName}
          </label>
        </div>
      )

    case 'switch':
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={value || false}
            onCheckedChange={handleChange}
            disabled={disabled || field.disabled}
            id={field.name}
          />
          <label
            htmlFor={field.name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {field.displayName}
          </label>
        </div>
      )

    case 'options':
      return (
        <Select
          value={value || ''}
          onValueChange={handleChange}
          disabled={disabled || field.disabled}
        >
          <SelectTrigger className={error ? 'border-destructive' : ''}>
            <SelectValue placeholder={field.placeholder || `Select ${field.displayName}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.filter((option): option is FormFieldOption => 'value' in option).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div>{option.name}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'autocomplete': {
      // Check if this field has dynamic loading
      const loadOptionsMethod = field.typeOptions?.loadOptionsMethod;

      if (loadOptionsMethod && nodeType) {
        // Get credentials from form values
        const credentials: Record<string, any> = {};
        allFields.forEach((f) => {
          if (f.type === 'credential' && allValues[f.name]) {
            credentials[f.name] = allValues[f.name];
          }
        });

        console.log('FieldRenderer - DynamicAutocomplete setup:', {
          nodeType,
          loadOptionsMethod,
          hasCredentials: Object.keys(credentials).length > 0,
          credentials,
          allValues,
          credentialFields: allFields.filter(f => f.type === 'credential'),
        });

        return (
          <DynamicAutocomplete
            nodeType={nodeType}
            loadOptionsMethod={loadOptionsMethod}
            loadOptionsDependsOn={field.typeOptions?.loadOptionsDependsOn}
            value={String(value || '')}
            onChange={handleChange}
            placeholder={field.placeholder}
            searchPlaceholder={`Search ${field.displayName.toLowerCase()}...`}
            disabled={disabled || field.disabled}
            error={error}
            required={field.required}
            displayName={field.displayName}
            parameters={allValues}
            credentials={credentials}
          />
        );
      }

      // Fall back to static options
      const autocompleteOptions: AutoCompleteOption[] = (field.options || [])
        .filter((option): option is FormFieldOption => 'value' in option)
        .map((option) => ({
          id: String(option.value),
          label: option.name,
          value: String(option.value),
          metadata: {
            subtitle: option.description,
          },
        }));

      console.log('FieldRenderer autocomplete:', {
        fieldName: field.name,
        fieldDisplayName: field.displayName,
        value,
        optionsCount: autocompleteOptions.length,
        options: autocompleteOptions,
      });

      return (
        <AutoComplete
          value={String(value || '')}
          onChange={(selectedValue) => handleChange(selectedValue)}
          options={autocompleteOptions}
          placeholder={field.placeholder || `Select ${field.displayName}`}
          searchPlaceholder={`Search ${field.displayName.toLowerCase()}...`}
          emptyMessage={`No ${field.displayName.toLowerCase()} available`}
          noOptionsMessage="No matching results"
          disabled={disabled || field.disabled}
          error={error}
          clearable={!field.required}
          refreshable={false}
          searchable={true}
          renderOption={(option) => (
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{option.label}</p>
              {option.metadata?.subtitle && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {option.metadata.subtitle}
                </p>
              )}
            </div>
          )}
        />
      );
    }

    case 'multiOptions':
      return (
        <div className="space-y-2">
          {field.options?.filter((option): option is FormFieldOption => 'value' in option).map((option) => {
            const isChecked = Array.isArray(value) ? value.includes(option.value) : false
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const currentValues = Array.isArray(value) ? value : []
                    const newValues = checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v) => v !== option.value)
                    handleChange(newValues)
                  }}
                  disabled={disabled || field.disabled}
                  id={`${field.name}-${option.value}`}
                />
                <label
                  htmlFor={`${field.name}-${option.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <div>{option.name}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </label>
              </div>
            )
          })}
        </div>
      )

    case 'json':
      return (
        <Textarea
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              handleChange(parsed)
            } catch {
              // Keep as string if not valid JSON
              handleChange(e.target.value)
            }
          }}
          onBlur={handleBlur}
          placeholder={field.placeholder || 'Enter JSON...'}
          disabled={disabled || field.disabled || field.readonly}
          rows={field.rows || 6}
          className={`font-mono text-sm ${error ? 'border-destructive' : ''}`}
        />
      )

    case 'dateTime':
      return (
        <div className="relative">
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled || field.disabled || field.readonly}
            className={error ? 'border-destructive' : ''}
          />
          <CalendarDays className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      )

    case 'conditionRow':
      return (
        <ConditionRow
          value={value || { key: '', expression: '', value: '' }}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled || field.disabled}
          error={error}
          nodeId={nodeId}
          expressionOptions={field.options?.filter((opt): opt is FormFieldOption => 'value' in opt)}
          keyPlaceholder={field.componentProps?.keyPlaceholder}
          valuePlaceholder={field.componentProps?.valuePlaceholder}
          expressionPlaceholder={field.componentProps?.expressionPlaceholder}
        />
      )

    case 'keyValueRow':
      return (
        <KeyValueRow
          value={value || { key: '', value: '' }}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled || field.disabled}
          error={error}
          nodeId={nodeId}
          keyPlaceholder={field.componentProps?.keyPlaceholder}
          valuePlaceholder={field.componentProps?.valuePlaceholder}
        />
      )

    case 'columnsMap': {
      // Check if this field has dynamic loading
      const loadOptionsMethod = field.typeOptions?.loadOptionsMethod;

      if (loadOptionsMethod && nodeType) {
        // Get credentials from form values
        const credentials: Record<string, any> = {};
        allFields.forEach((f) => {
          if (f.type === 'credential' && allValues[f.name]) {
            credentials[f.name] = allValues[f.name];
          }
        });

        return (
          <DynamicAutocomplete
            nodeType={nodeType}
            loadOptionsMethod={loadOptionsMethod}
            loadOptionsDependsOn={field.typeOptions?.loadOptionsDependsOn}
            value={value || {}}
            onChange={handleChange}
            placeholder={field.placeholder}
            searchPlaceholder={`Search columns...`}
            disabled={disabled || field.disabled}
            error={error}
            required={field.required}
            displayName={field.displayName}
            parameters={allValues}
            credentials={credentials}
            renderAsColumnsMap={true}
            nodeId={nodeId}
            onColumnsMapChange={(columnsData) => {
              // columnsData will be an object with column names as keys and values
              handleChange(columnsData);
            }}
          />
        );
      }

      // Fallback if no dynamic loading
      return (
        <div className="text-sm text-amber-600">
          columnsMap requires loadOptionsMethod to be configured
        </div>
      );
    }

    case 'button':
      const handleButtonClick = async () => {
        const action = field.typeOptions?.action;
        
        // Handle special actions
        if (action === 'clearMemory') {
          const sessionId = allValues?.sessionId || 'default';
          
          if (!confirm(`Are you sure you want to clear all messages for session "${sessionId}"?`)) {
            return;
          }
          
          try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/memory/clear', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ sessionId }),
            });
            
            const data = await response.json();
            
            if (data.success) {
              alert(`✓ Memory cleared for session: ${sessionId}`);
            } else {
              alert(`✗ Failed to clear memory: ${data.error}`);
            }
          } catch (error: any) {
            alert(`✗ Error clearing memory: ${error.message}`);
          }
        } else if (field.onClick) {
          // Call custom onClick handler if provided
          field.onClick({ value, allValues, field });
        }
      };
      
      return (
        <Button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled || field.disabled}
          variant={field.typeOptions?.variant || 'default'}
          size={field.typeOptions?.size || 'default'}
          className={field.typeOptions?.className}
        >
          {field.typeOptions?.buttonText || field.displayName || 'Click'}
        </Button>
      )

    case 'expression':
      return (
        <WorkflowExpressionField
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          error={error}
          nodeId={nodeId}
          customVariableCategories={field.componentProps?.variableCategories}
        />
      )

    default:
      return (
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled || field.readonly}
          className={error ? 'border-destructive' : ''}
        />
      )
  }
}
