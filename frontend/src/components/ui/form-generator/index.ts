export * from "./CustomComponentRegistry.tsx";
export { ConditionRow } from "./ConditionRow";
export { FieldRenderer } from "./FieldRenderer";
export { FieldValidator } from "./FieldValidator";
export { FieldVisibilityManager } from "./FieldVisibilityManager";
export { FormGenerator } from "./FormGenerator";
export { KeyValueRow } from "./KeyValueRow";
export { PropertyField } from "./PropertyField";
export { RepeatingField } from "./RepeatingField";
export * from "./types";

// Utility function to create field configurations
export function createField(
  config: Partial<import("./types").FormFieldConfig> & {
    name: string;
    displayName: string;
    type: import("./types").FormFieldConfig["type"];
  }
): import("./types").FormFieldConfig {
  return {
    required: false,
    disabled: false,
    readonly: false,
    ...config,
  };
}

// Utility function to create option fields easily
export function createOptions(
  options: Array<{ name: string; value: any; description?: string }>
) {
  return options;
}

// Utility function to create display options
export function createDisplayOptions(options: {
  show?: Record<string, any[]>;
  hide?: Record<string, any[]>;
}) {
  return options;
}

// Utility function to create validation rules
export function createValidation(
  validation: import("./types").FormFieldConfig["validation"]
) {
  return validation;
}
