import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AutoCompleteOption<T = any> {
  id: string;
  label: string;
  value: T;
  metadata?: Record<string, any>;
}

export interface AutoCompleteProps<T = any> {
  // Value and onChange
  value: string;
  onChange: (value: string, option?: AutoCompleteOption<T>) => void;
  
  // Data fetching
  options?: AutoCompleteOption<T>[];
  onFetch?: () => Promise<AutoCompleteOption<T>[]>;
  onSearch?: (query: string) => Promise<AutoCompleteOption<T>[]>;
  
  // Preload behavior
  preloadOnMount?: boolean;
  preloadOnFocus?: boolean;
  
  // UI customization
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  errorMessage?: string;
  noOptionsMessage?: string;
  icon?: React.ReactNode;
  renderOption?: (option: AutoCompleteOption<T>) => React.ReactNode;
  renderSelected?: (option: AutoCompleteOption<T>) => React.ReactNode;
  
  // State
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  
  // Behavior
  clearable?: boolean;
  refreshable?: boolean;
  searchable?: boolean;
  maxHeight?: number;
  
  // Styling
  className?: string;
  triggerClassName?: string;
  
  // Filtering
  filterFn?: (option: AutoCompleteOption<T>, searchTerm: string) => boolean;
}

export function AutoComplete<T = any>({
  value,
  onChange,
  options: propOptions = [],
  onFetch,
  onSearch,
  preloadOnMount = false,
  preloadOnFocus = false,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options available",
  errorMessage,
  noOptionsMessage = "No results found",
  icon,
  renderOption,
  renderSelected,
  disabled = false,
  loading: propLoading = false,
  error,
  clearable = true,
  refreshable = true,
  searchable = true,
  maxHeight = 300,
  className,
  triggerClassName,
  filterFn = defaultFilterFn,
}: AutoCompleteProps<T>) {
  console.log('AutoComplete: Render', { 
    value, 
    preloadOnMount, 
    hasOnFetch: !!onFetch, 
    disabled,
    optionsCount: propOptions?.length || 0,
    placeholder,
  });
  
  const [options, setOptions] = useState<AutoCompleteOption<T>[]>(propOptions);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOption, setSelectedOption] = useState<AutoCompleteOption<T> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Track if initial load has happened
  const hasLoadedRef = useRef(false);

  // Log when component mounts/unmounts
  useEffect(() => {
    console.log('AutoComplete: Mounted');
    return () => {
      console.log('AutoComplete: Unmounted');
    };
  }, []);

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!onFetch) return;

    setLoading(true);
    setApiError(null);
    
    try {
      const result = await onFetch();
      setOptions(result);
      
      // Find and set selected option
      if (value) {
        const selected = result.find((opt) => opt.id === value);
        if (selected) {
          setSelectedOption(selected);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load options";
      setApiError(errorMsg);
      console.error("Failed to fetch options:", err);
    } finally {
      setLoading(false);
    }
  }, [onFetch, value]);

  // Search function
  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    
    if (!onSearch) {
      return;
    }

    if (!query) {
      // Re-fetch original data if search is cleared
      if (onFetch) {
        setLoading(true);
        setApiError(null);
        try {
          const result = await onFetch();
          setOptions(result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to load options";
          setApiError(errorMsg);
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    setLoading(true);
    setApiError(null);
    
    try {
      const result = await onSearch(query);
      setOptions(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Search failed";
      setApiError(errorMsg);
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync selectedOption with value prop changes
  useEffect(() => {
    if (value && options.length > 0) {
      const selected = options.find((opt) => opt.id === value);
      if (selected) {
        setSelectedOption(selected);
      }
    } else if (!value) {
      setSelectedOption(null);
    }
  }, [value, options]);

  // Sync options state with propOptions when they change
  useEffect(() => {
    if (propOptions && propOptions.length > 0) {
      console.log('AutoComplete: Syncing propOptions', { propOptionsLength: propOptions.length });
      setOptions(propOptions);
    }
  }, [propOptions]);

  // Preload data when preloadOnMount changes to true
  useEffect(() => {
    console.log('AutoComplete: preloadOnMount effect', { preloadOnMount, hasOnFetch: !!onFetch, optionsLength: options.length, hasLoaded: hasLoadedRef.current });
    
    if (preloadOnMount && onFetch) {
      // Only fetch if we haven't loaded yet or if options are empty
      if (!hasLoadedRef.current || options.length === 0) {
        console.log('AutoComplete: Triggering fetchData');
        hasLoadedRef.current = true;
        
        // Wrap in try-catch to handle any unhandled promise rejections
        fetchData().catch((err) => {
          console.error('AutoComplete: fetchData failed in useEffect', err);
        });
      }
    }
    // Note: We don't reset options when preloadOnMount is false
    // Static options should remain available even without preload
    // Only react to preloadOnMount changes, not onFetch changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadOnMount]);

  // Preload on focus
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (open && preloadOnFocus && onFetch && options.length === 0 && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchData().catch((err) => {
        console.error('AutoComplete: fetchData failed on focus', err);
      });
    }
  };

  // Handle selection
  const handleSelect = (option: AutoCompleteOption<T>) => {
    setSelectedOption(option);
    onChange(option.id, option);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOption(null);
    onChange("", undefined);
    setSearchTerm("");
  };

  // Filter options
  const filteredOptions = searchTerm && !onSearch
    ? options.filter((opt) => filterFn(opt, searchTerm))
    : options;

  const isLoading = loading || propLoading;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isOpen}
                disabled={disabled || isLoading}
                className={cn(
                  "w-full justify-between h-9 font-normal",
                  !selectedOption && "text-muted-foreground",
                  error && "border-red-500",
                  triggerClassName
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  {selectedOption ? (
                    <>
                      {icon && <span className="flex-shrink-0">{icon}</span>}
                      <span className="truncate text-sm">
                        {renderSelected ? (
                          renderSelected(selectedOption)
                        ) : (
                          selectedOption.label
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="truncate text-sm">{placeholder}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {clearable && selectedOption && !disabled && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear(e);
                      }}
                      className="flex items-center justify-center h-4 w-4 rounded-sm hover:bg-muted cursor-pointer transition-colors"
                      title="Clear selection"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </div>
                  )}
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  )}
                </div>
              </Button>
            </PopoverTrigger>
          </div>

          {refreshable && onFetch && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                fetchData();
              }}
              disabled={isLoading}
              title="Refresh options"
              className="h-9 w-9 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        <PopoverContent 
          className="p-0 w-full" 
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          align="start"
        >
          <Command>
            {searchable && (
              <CommandInput 
                placeholder={searchPlaceholder}
                value={searchTerm}
                onValueChange={handleSearch}
                disabled={isLoading}
              />
            )}
            <CommandList style={{ maxHeight: `${maxHeight}px` }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiError || errorMessage ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-2 text-red-600">
                    <svg
                      className="h-5 w-5 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Error</p>
                      <p className="text-sm mt-1 text-red-500">
                        {errorMessage || apiError}
                      </p>
                    </div>
                  </div>
                  {refreshable && onFetch && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchData}
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchTerm ? noOptionsMessage : emptyMessage}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredOptions.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.id}
                        onSelect={() => handleSelect(option)}
                        disabled={disabled}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedOption?.id === option.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {renderOption ? (
                          <>{renderOption(option)}</>
                        ) : (
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{option.label}</p>
                              {option.metadata?.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {String(option.metadata.subtitle)}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Default filter function
function defaultFilterFn<T>(option: AutoCompleteOption<T>, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase();
  return (
    option.label.toLowerCase().includes(term) ||
    option.id.toLowerCase().includes(term) ||
    (option.metadata?.subtitle && 
      String(option.metadata.subtitle).toLowerCase().includes(term))
  );
}
