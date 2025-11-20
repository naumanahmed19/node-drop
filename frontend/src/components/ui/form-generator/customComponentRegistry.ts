import {
  ColumnSelector,
  RangeSelector,
  SheetSelector,
  SpreadsheetSelector,
  TriggerAutocomplete,
  TriggerOnAutocomplete,
  UrlGenerator,
  WidgetEmbedGenerator,
  WorkflowAutocomplete,
} from "@/components/workflow/node-config/custom-fields";
import { CodeEditor } from "./custom-fields/CodeEditor";
import { SchedulePreview } from "@/components/workflow/node-config/custom-fields/SchedulePreview";

/**
 * Registry of custom field components
 * Maps component names to their implementations
 */
export const customFieldComponents: Record<string, any> = {
  SpreadsheetSelector,
  SheetSelector,
  RangeSelector,
  ColumnSelector,
  TriggerOnAutocomplete,
  WorkflowAutocomplete,
  TriggerAutocomplete,
  UrlGenerator,
  WebhookUrlGenerator: UrlGenerator, // Backward compatibility alias
  WidgetEmbedGenerator,
  CodeEditor,
  SchedulePreview,
};

/**
 * Get custom component by name
 */
export function getCustomComponent(componentName: string): any | null {
  return customFieldComponents[componentName] || null;
}

/**
 * Register a new custom component
 */
export function registerCustomComponent(name: string, component: any): void {
  customFieldComponents[name] = component;
}
