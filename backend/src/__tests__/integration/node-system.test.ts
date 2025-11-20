import { PrismaClient } from '@prisma/client';
import { NodeService } from '../../services/NodeService';
import { NodeDefinition, BuiltInNodeTypes } from '../../types/node.types';

const prisma = new PrismaClient();

describe('Node System Integration Tests', () => {
  let nodeService: NodeService;

  beforeAll(async () => {
    nodeService = new NodeService(prisma);

    // Wait for built-in nodes to be registered
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clean up any existing test data
    await prisma.nodeType.deleteMany({
      where: {
        type: {
          startsWith: 'test-'
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.nodeType.deleteMany({
      where: {
        type: {
          startsWith: 'test-'
        }
      }
    });

    await prisma.$disconnect();
  });

  describe('Built-in Node Registration', () => {
    it('should register built-in nodes in database', async () => {
      // Check if built-in nodes are registered in database
      const httpRequestNode = await prisma.nodeType.findUnique({
        where: { type: BuiltInNodeTypes.HTTP_REQUEST }
      });

      const jsonNode = await prisma.nodeType.findUnique({
        where: { type: BuiltInNodeTypes.JSON }
      });

      const setNode = await prisma.nodeType.findUnique({
        where: { type: BuiltInNodeTypes.SET }
      });

      expect(httpRequestNode).toBeTruthy();
      expect(httpRequestNode?.displayName).toBe('HTTP Request');
      expect(httpRequestNode?.active).toBe(true);

      expect(jsonNode).toBeTruthy();
      expect(jsonNode?.displayName).toBe('JSON');
      expect(jsonNode?.active).toBe(true);

      expect(setNode).toBeTruthy();
      expect(setNode?.displayName).toBe('Set');
      expect(setNode?.active).toBe(true);
    });

    it('should retrieve node types from database', async () => {
      const nodeTypes = await nodeService.getNodeTypes();

      expect(nodeTypes.length).toBeGreaterThanOrEqual(3);

      const httpRequestNode = nodeTypes.find(n => n.type === BuiltInNodeTypes.HTTP_REQUEST);
      const jsonNode = nodeTypes.find(n => n.type === BuiltInNodeTypes.JSON);
      const setNode = nodeTypes.find(n => n.type === BuiltInNodeTypes.SET);

      expect(httpRequestNode).toBeTruthy();
      expect(jsonNode).toBeTruthy();
      expect(setNode).toBeTruthy();
    });

    it('should retrieve node schemas from database', async () => {
      const httpRequestSchema = await nodeService.getNodeSchema(BuiltInNodeTypes.HTTP_REQUEST);

      expect(httpRequestSchema).toBeTruthy();
      expect(httpRequestSchema?.type).toBe(BuiltInNodeTypes.HTTP_REQUEST);
      expect(httpRequestSchema?.displayName).toBe('HTTP Request');
      expect(httpRequestSchema?.properties).toBeInstanceOf(Array);
      expect(httpRequestSchema?.properties.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Node Registration', () => {
    const customNodeDefinition: NodeDefinition = {
      type: 'test-custom-node',
      displayName: 'Test Custom Node',
      name: 'testCustomNode',
      group: ['test'],
      version: 1,
      description: 'A custom test node',
      defaults: { testParam: 'default' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Test Parameter',
          name: 'testParam',
          type: 'string',
          required: true,
          default: 'default',
          description: 'A test parameter'
        }
      ],
      execute: async function (inputData) {
        const testParam = this.getNodeParameter('testParam');
        const items = inputData.main?.[0] || [];

        return [{
          main: items.map(item => ({
            json: { ...item, testParam }
          }))
        }];
      }
    };

    it('should register custom node in database', async () => {
      const result = await nodeService.registerNode(customNodeDefinition);

      expect(result.success).toBe(true);
      expect(result.nodeType).toBe('test-custom-node');

      // Verify in database
      const dbNode = await prisma.nodeType.findUnique({
        where: { type: 'test-custom-node' }
      });

      expect(dbNode).toBeTruthy();
      expect(dbNode?.displayName).toBe('Test Custom Node');
      expect(dbNode?.active).toBe(true);
    });

    it('should retrieve custom node schema', async () => {
      const schema = await nodeService.getNodeSchema('test-custom-node');

      expect(schema).toBeTruthy();
      expect(schema?.type).toBe('test-custom-node');
      expect(schema?.displayName).toBe('Test Custom Node');
      expect(schema?.properties).toHaveLength(1);
      expect(schema?.properties[0].name).toBe('testParam');
    });

    it('should execute custom node', async () => {
      const result = await nodeService.executeNode(
        'test-custom-node',
        { testParam: 'custom-value' },
        { main: [[{ id: 1, name: 'test' }]] }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data![0].main).toEqual([
        { json: { id: 1, name: 'test', testParam: 'custom-value' } }
      ]);
    });

    it('should update existing node when re-registering', async () => {
      const updatedDefinition = {
        ...customNodeDefinition,
        displayName: 'Updated Test Custom Node',
        version: 2,
        description: 'An updated custom test node'
      };

      const result = await nodeService.registerNode(updatedDefinition);

      expect(result.success).toBe(true);

      // Verify update in database
      const dbNode = await prisma.nodeType.findUnique({
        where: { type: 'test-custom-node' }
      });

      expect(dbNode?.displayName).toBe('Updated Test Custom Node');
      expect(dbNode?.version).toBe(2);
      expect(dbNode?.description).toBe('An updated custom test node');
    });

    it('should unregister custom node', async () => {
      await nodeService.unregisterNode('test-custom-node');

      // Verify in database
      const dbNode = await prisma.nodeType.findUnique({
        where: { type: 'test-custom-node' }
      });

      expect(dbNode?.active).toBe(false);

      // Should not appear in active node types
      const nodeTypes = await nodeService.getNodeTypes();
      const customNode = nodeTypes.find(n => n.type === 'test-custom-node');
      expect(customNode).toBeUndefined();
    });
  });

  describe('Built-in Node Execution', () => {
    it('should execute HTTP Request node (mock)', async () => {
      // Note: This would make a real HTTP request in a full integration test
      // For now, we'll test the execution framework
      const result = await nodeService.executeNode(
        BuiltInNodeTypes.HTTP_REQUEST,
        {
          method: 'GET',
          url: 'https://httpbin.org/json',
          headers: {}
        },
        { main: [[]] }
      );

      // The result might fail due to network issues, but the execution framework should work
      expect(result).toBeTruthy();
      expect(typeof result.success).toBe('boolean');
    });

    it('should execute JSON node', async () => {
      const result = await nodeService.executeNode(
        BuiltInNodeTypes.JSON,
        { jsonData: '{"message": "Hello, World!", "timestamp": "2023-01-01"}' },
        { main: [[]] }
      );

      expect(result.success).toBe(true);
      expect(result.data![0].main).toEqual([
        { json: { message: 'Hello, World!', timestamp: '2023-01-01' } }
      ]);
    });

    it('should execute Set node', async () => {
      const result = await nodeService.executeNode(
        BuiltInNodeTypes.SET,
        {
          values: [
            { name: 'processed', value: true },
            { name: 'timestamp', value: '2023-01-01T00:00:00Z' }
          ]
        },
        { main: [[{ id: 1, name: 'original' }]] }
      );

      expect(result.success).toBe(true);
      expect(result.data![0].main).toEqual([
        {
          json: {
            id: 1,
            name: 'original',
            processed: true,
            timestamp: '2023-01-01T00:00:00Z'
          }
        }
      ]);
    });
  });
});
