import { NodeSetting } from '@/types'

/**
 * Default settings available for all nodes
 * These are execution-related settings that apply to any node type
 */
export const DEFAULT_NODE_SETTINGS: Record<string, NodeSetting> = {
  continueOnFail: {
    displayName: 'Continue On Fail',
    name: 'continueOnFail',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will continue execution even if an error occurs. The error information will be returned as output data instead of stopping the workflow.',
  },
  alwaysOutputData: {
    displayName: 'Always Output Data',
    name: 'alwaysOutputData',
    type: 'boolean',
    default: false,
    description:
      'If enabled, the node will always output data, including error responses. Useful when you want to process error responses in your workflow.',
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
    description:
      'If enabled, the node will automatically retry execution if it fails.',
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
    description:
      'Maximum time in milliseconds the node is allowed to run before timing out. Set to 0 for no timeout.',
  },
  notes: {
    displayName: 'Notes',
    name: 'notes',
    type: 'string',
    default: '',
    description:
      'Add notes or comments about this node. Notes are for documentation purposes only and do not affect execution.',
    placeholder: 'Add notes about this node...',
  },
}
