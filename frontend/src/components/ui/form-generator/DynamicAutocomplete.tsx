import { AutoComplete, AutoCompleteOption } from '@/components/ui/autocomplete';
import { apiClient } from '@/services/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExpressionInput } from './ExpressionInput';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Code2, List, Clock } from 'lucide-react';

interface DynamicAutocompleteProps {
  nodeType: string;
  loadOptionsMethod: string;
  loadOptionsDependsOn?: string[];
  value: string | Record<string, any>;
  onChange: (value: string | Record<string, any>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  displayName?: string;
  // Current form values for context
  parameters?: Record<string, any>;
  credentials?: Record<string, any>;
  // ColumnsMap mode
  renderAsColumnsMap?: boolean;
  onColumnsMapChange?: (columnsData: Record<string, any>) => void;
  // Node ID for expression autocomplete
  nodeId?: string;
}

export function DynamicAutocomplete({
  nodeType,
  loadOptionsMethod,
  loadOptionsDependsOn,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled,
  error,
  required,
  displayName = 'option',
  parameters = {},
  credentials = {},
  renderAsColumnsMap = false,
  onColumnsMapChange,
  nodeId,
}: DynamicAutocompleteProps) {
  const [options, setOptions] = useState<AutoCompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [columnsMapData, setColumnsMapData] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [jsonValue, setJsonValue] = useState<string>('');
  
  // Use ref to track if we've loaded options
  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const previousDependencyKeyRef = useRef<string>('');
  const hasInitializedColumnsMapRef = useRef(false);
  
  // Memoize the credentials key to prevent unnecessary re-renders
  const credentialsKey = useMemo(() => {
    return JSON.stringify(credentials);
  }, [JSON.stringify(credentials)]);

  // Memoize the dependency values to detect changes
  const dependencyValues = useMemo(() => {
    if (!loadOptionsDependsOn || !Array.isArray(loadOptionsDependsOn)) {
      return {};
    }
    const values: Record<string, any> = {};
    loadOptionsDependsOn.forEach(dep => {
      values[dep] = parameters[dep];
    });
    return values;
  }, [loadOptionsDependsOn, parameters]);

  const dependencyKey = useMemo(() => {
    return JSON.stringify(dependencyValues);
  }, [dependencyValues]);

  const loadOptions = async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.log('DynamicAutocomplete: Already loading, skipping');
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setLoadError(null);

    console.log('DynamicAutocomplete: Loading options', {
      nodeType,
      loadOptionsMethod,
      hasCredentials: Object.keys(credentials).length > 0,
    });

    try {
      console.log('DynamicAutocomplete: Making API request', {
        url: `/nodes/${nodeType}/load-options`,
        payload: {
          method: loadOptionsMethod,
          parameters,
          credentials,
        },
      });

      const response = await apiClient.post<any>(`/nodes/${nodeType}/load-options`, {
        method: loadOptionsMethod,
        parameters,
        credentials,
      });

      console.log('DynamicAutocomplete: API response', response.data);

      // Check if response has the expected structure
      let dataArray: any[] = [];
      
      if (response.data.success && Array.isArray(response.data.data)) {
        // Wrapped response: { success: true, data: [...] }
        dataArray = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Direct array response: [...]
        dataArray = response.data;
      } else {
        throw new Error(response.data.error?.message || 'Failed to load options');
      }

      const formattedOptions: AutoCompleteOption[] = dataArray.map((option: any) => ({
        id: String(option.value),
        label: option.name,
        value: String(option.value),
        metadata: {
          subtitle: option.description,
        },
      }));

      console.log('DynamicAutocomplete: Loaded options', {
        count: formattedOptions.length,
      });

      setOptions(formattedOptions);
      hasLoadedRef.current = true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to load options';
      setLoadError(errorMessage);
      console.error('Failed to load dynamic options:', {
        error: err,
        response: err.response?.data,
        message: errorMessage,
      });
      
      // Show error as an option
      setOptions([
        {
          id: 'error',
          label: `Error: ${errorMessage}`,
          value: '',
          metadata: {
            subtitle: 'Check your credentials and try again',
          },
        },
      ]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Reset when credentials change
  useEffect(() => {
    console.log('DynamicAutocomplete: Credentials changed, resetting');
    hasLoadedRef.current = false;
    loadingRef.current = false;
    setOptions([]);
    setLoadError(null);
  }, [credentialsKey, nodeType, loadOptionsMethod]);

  // Reset when dependencies change
  useEffect(() => {
    const previousDependencyKey = previousDependencyKeyRef.current;
    
    // Only reset if dependency key actually changed (not on initial mount)
    if (previousDependencyKey && previousDependencyKey !== dependencyKey) {
      console.log('DynamicAutocomplete: Dependencies changed, resetting and clearing value');
      hasLoadedRef.current = false;
      loadingRef.current = false;
      setOptions([]);
      setLoadError(null);
      
      // Clear the selected value when dependencies change
      if (loadOptionsDependsOn) {
        console.log('DynamicAutocomplete: Clearing value due to dependency change');
        
        if (renderAsColumnsMap) {
          // For columnsMap, clear the data and reset initialization flag
          setColumnsMapData({});
          setJsonValue('{}');
          hasInitializedColumnsMapRef.current = false;
          onChange({});
        } else {
          onChange('');
        }
      }
    }
    
    // Update the ref with current dependency key
    previousDependencyKeyRef.current = dependencyKey;
  }, [dependencyKey, loadOptionsDependsOn, onChange, renderAsColumnsMap]);

  // Load options once when component mounts or dependencies change
  useEffect(() => {
    if (!hasLoadedRef.current && !loadingRef.current) {
      console.log('DynamicAutocomplete: Triggering load due to dependency change');
      loadOptions();
    }
  }, [credentialsKey, dependencyKey]); // Depend on both credentials and dependencies

  // Initialize columnsMapData from value prop
  useEffect(() => {
    console.log('DynamicAutocomplete: Init effect running', {
      renderAsColumnsMap,
      hasInitialized: hasInitializedColumnsMapRef.current,
      value,
      valueType: typeof value,
    });
    
    if (renderAsColumnsMap) {
      // Reset initialization flag when switching to columnsMap mode
      if (!hasInitializedColumnsMapRef.current) {
        let initialData = {};
        
        if (typeof value === 'object' && value !== null) {
          initialData = value;
          console.log('DynamicAutocomplete: Initializing columnsMap from object value:', initialData);
        } else if (typeof value === 'string' && value) {
          // Handle both JSON strings and "[object Object]" strings
          if (value === '[object Object]') {
            console.log('DynamicAutocomplete: Received [object Object] string, initializing as empty');
            initialData = {};
          } else {
            try {
              initialData = JSON.parse(value);
              console.log('DynamicAutocomplete: Initializing columnsMap from JSON string:', initialData);
            } catch (e) {
              console.log('Failed to parse columnsMap value:', e, 'value:', value);
              initialData = {};
            }
          }
        } else {
          console.log('DynamicAutocomplete: No initial value for columnsMap, value:', value);
        }
        
        setColumnsMapData(initialData);
        setJsonValue(JSON.stringify(initialData, null, 2));
        hasInitializedColumnsMapRef.current = true;
        
        console.log('DynamicAutocomplete: Initialized columnsMapData:', initialData);
      }
    } else {
      // Reset initialization flag when not in columnsMap mode
      hasInitializedColumnsMapRef.current = false;
    }
  }, [renderAsColumnsMap, value]);

  // Handle column value change
  const handleColumnValueChange = (columnName: string, columnValue: any) => {
    const newData = {
      ...columnsMapData,
      [columnName]: columnValue,
    };
    setColumnsMapData(newData);
    setJsonValue(JSON.stringify(newData, null, 2));
    
    if (onColumnsMapChange) {
      onColumnsMapChange(newData);
    }
    
    // Also call the main onChange
    onChange(newData);
  };

  // Handle JSON value change
  const handleJsonChange = (newJsonValue: string) => {
    setJsonValue(newJsonValue);
    
    try {
      const parsed = JSON.parse(newJsonValue);
      setColumnsMapData(parsed);
      
      if (onColumnsMapChange) {
        onColumnsMapChange(parsed);
      }
      
      onChange(parsed);
    } catch (e) {
      // Invalid JSON, don't update the data
      console.log('Invalid JSON, not updating data');
    }
  };

  // Check if a column is a timestamp type
  const isTimestampColumn = (dataType: string): boolean => {
    const timestampTypes = [
      'timestamp',
      'timestamptz',
      'timestamp with time zone',
      'timestamp without time zone',
      'datetime',
      'date',
      'time',
    ];
    return timestampTypes.some(type => dataType.toLowerCase().includes(type));
  };

  // Get timestamp presets
  const getTimestampPresets = () => [
    { label: 'Auto (NOW())', value: 'NOW()' },
    { label: 'Current Timestamp', value: 'CURRENT_TIMESTAMP' },
    { label: 'Current Date', value: 'CURRENT_DATE' },
    { label: 'Current Time', value: 'CURRENT_TIME' },
  ];

  // Render as columnsMap
  if (renderAsColumnsMap) {
    if (loading) {
      return (
        <div className="text-sm text-muted-foreground">
          Loading columns...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="text-sm text-destructive">
          Error loading columns: {loadError}
        </div>
      );
    }

    if (options.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No columns available. Please select a table first.
        </div>
      );
    }

    return (
      <div className="space-y-3 border rounded-md">
        {/* Tab Header */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
          <div className="text-sm font-medium text-muted-foreground">
            Column Mapping
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={viewMode === 'visual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('visual')}
              className="h-7 px-2"
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Visual
            </Button>
            <Button
              type="button"
              variant={viewMode === 'json' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('json')}
              className="h-7 px-2"
            >
              <Code2 className="h-3.5 w-3.5 mr-1" />
              JSON
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {viewMode === 'visual' ? (
            <div className="space-y-3">
              {options.map((option) => {
                const dataType = option.metadata?.subtitle || '';
                const isTimestamp = isTimestampColumn(dataType);
                
                return (
                  <div key={option.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        {option.label}
                        {option.metadata?.subtitle && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({option.metadata.subtitle})
                          </span>
                        )}
                      </label>
                      {isTimestamp && (
                        <div className="flex gap-1 flex-wrap">
                          {getTimestampPresets().map((preset) => (
                            <Button
                              key={preset.value}
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleColumnValueChange(option.value, preset.value)}
                              className="h-6 px-2 text-xs hover:bg-primary/10"
                              title={`Insert ${preset.label}`}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {preset.label.replace('Auto (', '').replace(')', '')}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <ExpressionInput
                      value={columnsMapData[option.value] || ''}
                      onChange={(newValue) => handleColumnValueChange(option.value, newValue)}
                      placeholder={
                        isTimestamp 
                          ? 'Enter timestamp or use preset buttons above...'
                          : placeholder || `Enter value for ${option.label}...`
                      }
                      disabled={disabled}
                      error={false}
                      nodeId={nodeId}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Edit the column mapping as JSON. Use column names as keys.
              </div>
              <Textarea
                value={jsonValue}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{\n  "column1": "value1",\n  "column2": "value2"\n}'
                disabled={disabled}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default autocomplete rendering
  return (
    <div>
      <AutoComplete
        value={String(value || '')}
        onChange={onChange as (value: string) => void}
        options={options}
        placeholder={loading ? 'Loading options...' : placeholder || `Select ${displayName}`}
        searchPlaceholder={searchPlaceholder || `Search ${displayName.toLowerCase()}...`}
        emptyMessage={
          loadError
            ? `Error: ${loadError}`
            : loading
            ? 'Loading...'
            : `No ${displayName.toLowerCase()} available`
        }
        noOptionsMessage={loading ? 'Loading...' : 'No matching results'}
        disabled={disabled || loading}
        error={error}
        clearable={!required}
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
      {loadError && (
        <p className="text-xs text-destructive mt-1">
          {loadError}
        </p>
      )}
    </div>
  );
}
