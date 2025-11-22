import { NodeService } from '../../services/NodeService';
import { PrismaClient } from '@prisma/client';
import {
  NodeDefinition,
  NodeValidationResult,
  NodeRegistrationResult,
  NodeExecutionResult,
  BuiltInNodeTypes
} from '../../types/node.types';

// Mock Prisma Client
const mockPrisma = {
  nodeType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('NodeService', () => {
  let nodeService: NodeService;

  beforeEach(() => {
    nodeService = new NodeService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('validateNodeDefinition', () => {
    it('should validate a correct node definition', () => {
      const validNodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'A test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Test Property',
            name: 'testProp',
            type: 'string',
            required: true,
            default: 'test'
          }
        ],
        execute: async function() {
          return [{ main: [] }];
        }
      };

      const result = nodeService.validateNodeDefinition(validNodeDefinition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject node definition with missing required fields', () => {
      const invalidNodeDefinition = {
        displayName: 'Test Node',
        // Missing type, name, group, version, description, inputs, outputs, properties, execute
      } as NodeDefinition;

      const result = nodeService.validateNodeDefinition(invalidNodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.property === 'type')).toBe(true);
      expect(result.errors.some(e => e.property === 'name')).toBe(true);
      expect(result.errors.some(e => e.property === 'group')).toBe(true);
    });

    it('should reject node definition with invalid property types', () => {
      const invalidNodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'A test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Invalid Property',
            name: 'invalidProp',
            type: 'invalid-type' as any,
            required: true,
            default: 'test'
          }
        ],
        execute: async function() {
          return [{ main: [] }];
        }
      };

      const result = nodeService.validateNodeDefinition(invalidNodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('type'))).toBe(true);
    });

    it('should reject options type property without options array', () => {
      const invalidNodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'A test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Options Property',
            name: 'optionsProp',
            type: 'options',
            required: true,
            default: 'option1'
            // Missing options array
          }
        ],
        execute: async function() {
          return [{ main: [] }];
        }
      };

      const result = nodeService.validateNodeDefinition(invalidNodeDefinition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property.includes('options'))).toBe(true);
    });
  });

  describe('registerNode', () => {
    it('should register a new node successfully', async () => {
      const nodeDefinition: NodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'A test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function() {
          return [{ main: [] }];
        }
      };

      (mockPrisma.nodeType.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.nodeType.create as jest.Mock).mockResolvedValue({});

      const result = await nodeService.registerNode(nodeDefinition);

      expect(result.success).toBe(true);
      expect(result.nodeType).toBe('test-node');
      expect(mockPrisma.nodeType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'test-node',
          displayName: 'Test Node',
          name: 'testNode'
        })
      });
    });

    it('should update existing node when registering with same type', async () => {
      const nodeDefinition: NodeDefinition = {
        type: 'existing-node',
        displayName: 'Updated Node',
        name: 'updatedNode',
        group: ['test'],
        version: 2,
        description: 'An updated node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function() {
          return [{ main: [] }];
        }
      };

      (mockPrisma.nodeType.findUnique as jest.Mock).mockResolvedValue({
        type: 'existing-node',
        version: 1
      });
      (mockPrisma.nodeType.update as jest.Mock).mockResolvedValue({});

      const result = await nodeService.registerNode(nodeDefinition);

      expect(result.success).toBe(true);
      expect(mockPrisma.nodeType.update).toHaveBeenCalledWith({
        where: { type: 'existing-node' },
        data: expect.objectContaining({
          displayName: 'Updated Node',
          version: 2
        })
      });
    });

    it('should fail to register invalid node definition', async () => {
      const invalidNodeDefinition = {
        displayName: 'Invalid Node',
        // Missing required fields
      } as NodeDefinition;

      const result = await nodeService.registerNode(invalidNodeDefinition);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('getNodeTypes', () => {
    it('should return all active node types', async () => {
      const mockNodeTypes = [
        {
          type: 'http-request',
          displayName: 'HTTP Request',
          description: 'Make HTTP requests',
          group: ['transform'],
          version: 1,
          icon: 'fa:globe',
          color: '#2196F3'
        },
        {
          type: 'json',
          displayName: 'JSON',
          description: 'Compose JSON',
          group: ['transform'],
          version: 1,
          icon: 'fa:code',
          color: '#FF9800'
        }
      ];

      (mockPrisma.nodeType.findMany as jest.Mock).mockResolvedValue(mockNodeTypes);

      const result = await nodeService.getNodeTypes();

      expect(result).toEqual(mockNodeTypes);
      expect(mockPrisma.nodeType.findMany).toHaveBeenCalledWith({
        where: { active: true },
        select: {
          type: true,
          displayName: true,
          description: true,
          group: true,
          version: true,
          icon: true,
          color: true
        },
        orderBy: { displayName: 'asc' }
      });
    });
  });

  describe('getNodeSchema', () => {
    it('should return node schema for existing node type', async () => {
      const mockNode = {
        type: 'http-request',
        displayName: 'HTTP Request',
        name: 'httpRequest',
        group: ['transform'],
        version: 1,
        description: 'Make HTTP requests',
        defaults: { method: 'GET' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [{ name: 'GET', value: 'GET' }]
          }
        ],
        icon: 'fa:globe',
        color: '#2196F3'
      };

      (mockPrisma.nodeType.findUnique as jest.Mock).mockResolvedValue(mockNode);

      const result = await nodeService.getNodeSchema('http-request');

      expect(result).toEqual({
        type: 'http-request',
        displayName: 'HTTP Request',
        name: 'httpRequest',
        group: ['transform'],
        version: 1,
        description: 'Make HTTP requests',
        defaults: { method: 'GET' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [{ name: 'GET', value: 'GET' }]
          }
        ],
        icon: 'fa:globe',
        color: '#2196F3'
      });
    });

    it('should return null for non-existent node type', async () => {
      (mockPrisma.nodeType.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await nodeService.getNodeSchema('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('executeNode', () => {
    beforeEach(() => {
      // Register a test node for execution tests
      const testNodeDefinition: NodeDefinition = {
        type: 'test-execution-node',
        displayName: 'Test Execution Node',
        name: 'testExecutionNode',
        group: ['test'],
        version: 1,
        description: 'A test node for execution',
        defaults: { testParam: 'default' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Test Parameter',
            name: 'testParam',
            type: 'string',
            default: 'default'
          }
        ],
        execute: async function(inputData) {
          const testParam = this.getNodeParameter('testParam');
          const items = inputData.main?.[0] || [];
          
          return [{
            main: items.map(item => ({
              json: { ...item, testParam }
            }))
          }];
        }
      };

      // Manually add to registry for testing
      (nodeService as any).nodeRegistry.set('test-execution-node', testNodeDefinition);
    });

    it('should execute node successfully with valid parameters', async () => {
      const parameters = { testParam: 'test-value' };
      const inputData = { main: [[{ id: 1 }]] };

      const result = await nodeService.executeNode(
        'test-execution-node',
        parameters,
        inputData
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data![0].main).toEqual([
        { json: { id: 1, testParam: 'test-value' } }
      ]);
    });

    it('should fail execution for non-existent node type', async () => {
      const result = await nodeService.executeNode(
        'non-existent-node',
        {},
        { main: [[]] }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('Node type not found');
    });

    it('should handle execution errors gracefully', async () => {
      const errorNodeDefinition: NodeDefinition = {
        type: 'error-node',
        displayName: 'Error Node',
        name: 'errorNode',
        group: ['test'],
        version: 1,
        description: 'A node that throws errors',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function() {
          throw new Error('Test execution error');
        }
      };

      (nodeService as any).nodeRegistry.set('error-node', errorNodeDefinition);

      const result = await nodeService.executeNode(
        'error-node',
        {},
        { main: [[]] }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Test execution error');
    });
  });

  describe('unregisterNode', () => {
    it('should unregister node successfully', async () => {
      (mockPrisma.nodeType.update as jest.Mock).mockResolvedValue({});

      await nodeService.unregisterNode('test-node');

      expect(mockPrisma.nodeType.update).toHaveBeenCalledWith({
        where: { type: 'test-node' },
        data: { active: false }
      });
    });

    it('should handle unregister errors', async () => {
      (mockPrisma.nodeType.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(nodeService.unregisterNode('test-node')).rejects.toThrow('Failed to unregister node');
    });
  });

  describe('Built-in Nodes', () => {
    describe('HTTP Request Node', () => {
      it('should be registered as built-in node', async () => {
        // The HTTP Request node should be registered during initialization
        const httpRequestNode = (nodeService as any).nodeRegistry.get(BuiltInNodeTypes.HTTP_REQUEST);
        expect(httpRequestNode).toBeDefined();
        expect(httpRequestNode.type).toBe(BuiltInNodeTypes.HTTP_REQUEST);
        expect(httpRequestNode.displayName).toBe('HTTP Request');
      });
    });

    describe('JSON Node', () => {
      it('should be registered as built-in node', async () => {
        const jsonNode = (nodeService as any).nodeRegistry.get(BuiltInNodeTypes.JSON);
        expect(jsonNode).toBeDefined();
        expect(jsonNode.type).toBe(BuiltInNodeTypes.JSON);
        expect(jsonNode.displayName).toBe('JSON');
      });

      it('should execute JSON node correctly', async () => {
        const parameters = { jsonData: '{"test": "value"}' };
        const inputData = { main: [[]] };

        const result = await nodeService.executeNode(
          BuiltInNodeTypes.JSON,
          parameters,
          inputData
        );

        expect(result.success).toBe(true);
        expect(result.data![0].main).toEqual([
          { json: { test: 'value' } }
        ]);
      });

      it('should handle invalid JSON in JSON node', async () => {
        const parameters = { jsonData: 'invalid json' };
        const inputData = { main: [[]] };

        const result = await nodeService.executeNode(
          BuiltInNodeTypes.JSON,
          parameters,
          inputData
        );

        expect(result.success).toBe(false);
        expect(result.error!.message).toContain('Invalid JSON data');
      });
    });

    describe('Set Node', () => {
      it('should be registered as built-in node', async () => {
        const setNode = (nodeService as any).nodeRegistry.get(BuiltInNodeTypes.SET);
        expect(setNode).toBeDefined();
        expect(setNode.type).toBe(BuiltInNodeTypes.SET);
        expect(setNode.displayName).toBe('Set');
      });

      it('should execute Set node correctly', async () => {
        const parameters = {
          values: [
            { name: 'newField', value: 'newValue' },
            { name: 'anotherField', value: 123 }
          ]
        };
        const inputData = { main: [[{ existingField: 'existing' }]] };

        const result = await nodeService.executeNode(
          BuiltInNodeTypes.SET,
          parameters,
          inputData
        );

        expect(result.success).toBe(true);
        expect(result.data![0].main).toEqual([
          {
            json: {
              existingField: 'existing',
              newField: 'newValue',
              anotherField: 123
            }
          }
        ]);
      });
    });
  });
});
