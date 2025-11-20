import { NodeService } from '../../services/NodeService';
import { PrismaClient } from '@prisma/client';
import { NodeProperty, NodeDefinition } from '../../types/node.types';

// Mock Prisma Client
const mockPrisma = {} as unknown as PrismaClient;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('NodeService - Property Validation', () => {
  let nodeService: NodeService;

  beforeEach(() => {
    nodeService = new NodeService(mockPrisma);
  });

  describe('validateNodeProperty', () => {
    it('should validate string property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test String',
        name: 'testString',
        type: 'string',
        required: true,
        default: 'default value',
        description: 'A test string property'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate number property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test Number',
        name: 'testNumber',
        type: 'number',
        required: false,
        default: 42,
        description: 'A test number property'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate boolean property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test Boolean',
        name: 'testBoolean',
        type: 'boolean',
        required: false,
        default: true,
        description: 'A test boolean property'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate options property with valid options', () => {
      const property: NodeProperty = {
        displayName: 'Test Options',
        name: 'testOptions',
        type: 'options',
        required: true,
        default: 'option1',
        description: 'A test options property',
        options: [
          { name: 'Option 1', value: 'option1' },
          { name: 'Option 2', value: 'option2' },
          { name: 'Option 3', value: 'option3' }
        ]
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate multiOptions property with valid options', () => {
      const property: NodeProperty = {
        displayName: 'Test Multi Options',
        name: 'testMultiOptions',
        type: 'multiOptions',
        required: false,
        default: ['option1', 'option2'],
        description: 'A test multi-options property',
        options: [
          { name: 'Option 1', value: 'option1' },
          { name: 'Option 2', value: 'option2' },
          { name: 'Option 3', value: 'option3' }
        ]
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate json property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test JSON',
        name: 'testJson',
        type: 'json',
        required: false,
        default: '{}',
        description: 'A test JSON property'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate dateTime property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test DateTime',
        name: 'testDateTime',
        type: 'dateTime',
        required: false,
        default: '2023-01-01T00:00:00Z',
        description: 'A test datetime property'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should validate collection property correctly', () => {
      const property: NodeProperty = {
        displayName: 'Test Collection',
        name: 'testCollection',
        type: 'collection',
        required: false,
        default: [],
        description: 'A test collection property',
        typeOptions: {
          multipleValues: true,
          multipleValueButtonText: 'Add Item'
        }
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });

    it('should reject property with missing displayName', () => {
      const property = {
        name: 'testProperty',
        type: 'string',
        required: true,
        default: 'test'
      } as NodeProperty;

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('displayName'))).toBe(true);
    });

    it('should reject property with missing name', () => {
      const property = {
        displayName: 'Test Property',
        type: 'string',
        required: true,
        default: 'test'
      } as NodeProperty;

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('name'))).toBe(true);
    });

    it('should reject property with invalid type', () => {
      const property: NodeProperty = {
        displayName: 'Test Property',
        name: 'testProperty',
        type: 'invalid-type' as any,
        required: true,
        default: 'test'
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('type'))).toBe(true);
    });

    it('should reject options property without options array', () => {
      const property: NodeProperty = {
        displayName: 'Test Options',
        name: 'testOptions',
        type: 'options',
        required: true,
        default: 'option1'
        // Missing options array
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('options'))).toBe(true);
    });

    it('should reject multiOptions property without options array', () => {
      const property: NodeProperty = {
        displayName: 'Test Multi Options',
        name: 'testMultiOptions',
        type: 'multiOptions',
        required: false,
        default: ['option1']
        // Missing options array
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('options'))).toBe(true);
    });

    it('should validate property with displayOptions', () => {
      const property: NodeProperty = {
        displayName: 'Conditional Property',
        name: 'conditionalProp',
        type: 'string',
        required: false,
        default: 'conditional',
        description: 'A property with display conditions',
        displayOptions: {
          show: {
            method: ['POST', 'PUT']
          },
          hide: {
            disabled: [true]
          }
        }
      };

      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [property],
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
    });
  });

  describe('Complex Property Validation Scenarios', () => {
    it('should validate node with multiple property types', () => {
      const properties: NodeProperty[] = [
        {
          displayName: 'Method',
          name: 'method',
          type: 'options',
          required: true,
          default: 'GET',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' }
          ]
        },
        {
          displayName: 'URL',
          name: 'url',
          type: 'string',
          required: true,
          default: ''
        },
        {
          displayName: 'Timeout',
          name: 'timeout',
          type: 'number',
          required: false,
          default: 5000
        },
        {
          displayName: 'Follow Redirects',
          name: 'followRedirects',
          type: 'boolean',
          required: false,
          default: true
        },
        {
          displayName: 'Headers',
          name: 'headers',
          type: 'json',
          required: false,
          default: '{}'
        },
        {
          displayName: 'Body',
          name: 'body',
          type: 'string',
          required: false,
          default: '',
          displayOptions: {
            show: {
              method: ['POST', 'PUT', 'PATCH']
            }
          }
        }
      ];

      const nodeDefinition: NodeDefinition = {
        type: 'complex-node',
        displayName: 'Complex Node',
        name: 'complexNode',
        group: ['test'],
        version: 1,
        description: 'A node with complex properties',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties,
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide detailed error information for multiple invalid properties', () => {
      const properties: NodeProperty[] = [
        {
          displayName: '',  // Invalid: empty displayName
          name: 'prop1',
          type: 'string',
          required: true,
          default: 'test'
        },
        {
          displayName: 'Property 2',
          name: '',  // Invalid: empty name
          type: 'number',
          required: false,
          default: 42
        },
        {
          displayName: 'Property 3',
          name: 'prop3',
          type: 'invalid' as any,  // Invalid: invalid type
          required: true,
          default: 'test'
        },
        {
          displayName: 'Property 4',
          name: 'prop4',
          type: 'options',
          required: true,
          default: 'option1'
          // Invalid: missing options for options type
        }
      ];

      const nodeDefinition: NodeDefinition = {
        type: 'invalid-node',
        displayName: 'Invalid Node',
        name: 'invalidNode',
        group: ['test'],
        version: 1,
        description: 'A node with invalid properties',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties,
        execute: async () => [{ main: [] }]
      };

      const result = nodeService.validateNodeDefinition(nodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that errors contain property indices
      expect(result.errors.some(e => e.property.includes('properties[0]'))).toBe(true);
      expect(result.errors.some(e => e.property.includes('properties[1]'))).toBe(true);
      expect(result.errors.some(e => e.property.includes('properties[2]'))).toBe(true);
      expect(result.errors.some(e => e.property.includes('properties[3]'))).toBe(true);
    });
  });
});
