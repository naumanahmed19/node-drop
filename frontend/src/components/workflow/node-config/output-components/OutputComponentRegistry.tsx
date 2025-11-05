import { ComponentType } from 'react'
import { ImagePreviewOutput } from './ImagePreviewOutput'
import { DataPreviewOutput } from './DataPreviewOutput'

/**
 * Output Component Registry
 * 
 * This registry maps output component identifiers to their React components.
 * Nodes can specify an `outputComponent` field in their definition to use a custom
 * output renderer instead of the default JSON display.
 * 
 * Usage in node definition:
 * ```typescript
 * export const MyNode: NodeDefinition = {
 *   // ...other fields
 *   outputComponent: "MyCustomOutput",
 * }
 * ```
 * 
 * Then create the component in this folder and register it here:
 * ```typescript
 * import { MyCustomOutput } from './MyCustomOutput'
 * 
 * export const outputComponentRegistry: OutputComponentRegistry = {
 *   MyCustomOutput: MyCustomOutput,
 * }
 * ```
 */

export interface OutputComponentProps {
  data: any // The output data from node execution
  nodeType?: string // Optional node type for context
  executionStatus?: string // Optional execution status
}

export type OutputComponentRegistry = Record<
  string,
  ComponentType<OutputComponentProps>
>

/**
 * Registry of all available output components
 * Add new custom output components here
 */
export const outputComponentRegistry: OutputComponentRegistry = {
  ImagePreviewOutput: ImagePreviewOutput,
  DataPreviewOutput: DataPreviewOutput,
}

/**
 * Get an output component by its identifier
 * Returns undefined if the component is not registered
 */
export function getOutputComponent(
  componentName: string
): ComponentType<OutputComponentProps> | undefined {
  return outputComponentRegistry[componentName]
}

/**
 * Check if an output component is registered
 */
export function hasOutputComponent(componentName: string): boolean {
  return componentName in outputComponentRegistry
}
