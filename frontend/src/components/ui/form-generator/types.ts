import { ReactNode } from "react";

export interface FormFieldOption {
  name: string;
  value: any;
  description?: string;
}

export interface FixedCollectionOption {
  name: string;
  displayName: string;
  values: FormFieldConfig[];
}

export interface FormFieldConfig {
  name: string;
  displayName: string;
  type:
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "options"
  | "multiOptions"
  | "json"
  | "dateTime"
  | "collection"
  | "fixedCollection"
  | "textarea"
  | "password"
  | "email"
  | "url"
  | "switch"
  | "autocomplete"
  | "credential"
  | "custom"
  | "conditionRow"
  | "keyValueRow"
  | "columnsMap"
  | "hidden";
  required?: boolean;
  default?: any;
  description?: string;
  tooltip?: string;
  placeholder?: string;
  options?: FormFieldOption[] | FixedCollectionOption[]; // Can be regular options or fixedCollection options
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
  typeOptions?: {
    multipleValues?: boolean;
    multipleValueButtonText?: string;
    loadOptionsMethod?: string; // Method name for dynamic options loading
    loadOptionsDependsOn?: string[]; // Fields that this field depends on for loading options
  };
  component?: string; // Component name for custom rendering
  componentProps?: {
    fields?: FormFieldConfig[]; // Nested fields for collection type
    titleField?: string; // Field name to use as title in repeating items
    compact?: boolean; // Compact mode for repeating fields
    [key: string]: any;
  };
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => string | null;
  };
  disabled?: boolean;
  readonly?: boolean;
  rows?: number; // for textarea
  step?: number; // for number inputs
  allowedTypes?: string[]; // for credential type - array of credential type names
  customComponent?: (props: CustomFieldProps) => ReactNode;
}

export interface CustomFieldProps {
  value: any;
  onChange: (value: any) => void;
  field: FormFieldConfig;
  error?: string;
  disabled?: boolean;
  allValues?: Record<string, any>;
  allFields?: FormFieldConfig[];
  onFieldUpdate?: (fieldName: string, value: any) => void; // Update other fields
  credentialId?: string; // Credential ID for custom components that need API access
}

export interface FormGeneratorProps {
  fields: FormFieldConfig[];
  values: Record<string, any>;
  errors?: Record<string, string>;
  onChange: (name: string, value: any) => void;
  onFieldBlur?: (name: string, value: any) => void;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  showRequiredIndicator?: boolean;
  requiredIndicator?: ReactNode;
  nodeId?: string; // Optional: node ID for dynamic field suggestions in ExpressionInput
  nodeType?: string; // Optional: node type for loadOptions API calls
  disableAutoValidation?: boolean; // Optional: disable all automatic validation (default: false)
  validateOnMount?: boolean; // Optional: whether to run validation on mount (default: false) - ignored if disableAutoValidation is true
  validateOnChange?: boolean; // Optional: whether to run validation on value change (default: false for credentials) - ignored if disableAutoValidation is true
  validateOnBlur?: boolean; // Optional: whether to validate fields on blur (default: true) - ignored if disableAutoValidation is true
}

export interface FormGeneratorRef {
  validate: () => Record<string, string>;
  isValid: () => boolean;
}

export interface FieldVisibilityOptions {
  show?: Record<string, any[]>;
  hide?: Record<string, any[]>;
}

export interface FormFieldRendererProps {
  field: FormFieldConfig;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  onBlur?: (value: any) => void;
  disabled?: boolean;
  allValues: Record<string, any>;
  allFields: FormFieldConfig[];
  onFieldChange?: (fieldName: string, value: any) => void; // For updating other fields
  nodeId?: string; // Optional: node ID for dynamic field suggestions in ExpressionInput
  nodeType?: string; // Optional: node type for loadOptions API calls
}

export interface RepeatingFieldItem {
  id: string;
  values: Record<string, any>;
}

export interface RepeatingFieldProps {
  displayName: string;
  fields: FormFieldConfig[];
  value: RepeatingFieldItem[];
  onChange: (value: RepeatingFieldItem[]) => void;
  minItems?: number;
  maxItems?: number;
  addButtonText?: string;
  allowReorder?: boolean;
  allowDuplicate?: boolean;
  allowDelete?: boolean;
  defaultItemValues?: Record<string, any>;
  itemHeaderRenderer?: (
    item: RepeatingFieldItem,
    index: number
  ) => React.ReactNode;
  errors?: Record<string, Record<string, string>>;
  disabled?: boolean;
  className?: string;
  showItemNumbers?: boolean;
  collapsedByDefault?: boolean;
  nodeId?: string; // Optional: node ID for dynamic field suggestions in ExpressionInput
  nodeType?: string; // Optional: node type for loadOptions API calls
}
