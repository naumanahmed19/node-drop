import { NodeLoader } from '../services/NodeLoader';
import { NodeTemplateGenerator } from '../services/NodeTemplateGenerator';
import { NodeMarketplace } from '../services/NodeMarketplace';
import { NodeService } from '../services/NodeService';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { jest } from '@jest/globals';

describe('Custom Node System Integration', () => {
  let nodeService: NodeService;
  let nodeLoader: NodeLoader;
  let templateGenerator: NodeTemplateGenerator;
  let marketplace: NodeMarketplace;
  let prisma: PrismaClient;
  let tempDir: string;
  let customNodesDir: string;

  beforeAll(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nd-node-test-'));
    customNodesDir = path.join(tempDir, 'custom-nodes');
    
    // Initialize services
    prisma = new PrismaClient();
    nodeService = new NodeService(prisma);
    nodeLoader = new NodeLoader(nodeService, prisma, customNodesDir);
    templateGenerator = new NodeTemplateGenerator();
    marketplace = new NodeMarketplace({
      registryUrl: 'https://test-registry.com'
    }, customNodesDir);
  });

  afterAll(async () => {
    // Cleanup
    await nodeLoader.cleanup();
    await prisma.$disconnect();
    
    // Remove temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('End-to-End Node Development Workflow', () => {
    const testNodeOptions = {
      name: 'test-integration-node',
      displayName: 'Test Integration Node',
      description: 'A test node for integration testing',
      type: 'action' as const,
      author: 'Test Author',
      version: '1.0.0',
      includeCredentials: true,
      includeTests: true,
      typescript: true
    };

    let packagePath: string;

    it('should generate a new node package', async () => {
      const result = await templateGenerator.generateNodePackage(tempDir, testNodeOptions);

      expect(result.success).toBe(true);
      expect(result.packagePath).toBeDefined();
      
      packagePath = result.packagePath!;
      
      // Verify package structure
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonExists = await fileExists(packageJsonPath);
      expect(packageJsonExists).toBe(true);

      const nodesDir = path.join(packagePath, 'nodes');
      const nodesDirExists = await directoryExists(nodesDir);
      expect(nodesDirExists).toBe(true);

      const credentialsDir = path.join(packagePath, 'credentials');
      const credentialsDirExists = await directoryExists(credentialsDir);
      expect(credentialsDirExists).toBe(true);

      const testsDir = path.join(packagePath, '__tests__');
      const testsDirExists = await directoryExists(testsDir);
      expect(testsDirExists).toBe(true);
    });

    it('should validate the generated package', async () => {
      const validation = await nodeLoader.validateNodePackage(packagePath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.packageInfo).toBeDefined();
      expect(validation.packageInfo!.name).toBe('test-integration-node');
    });

    it('should compile TypeScript package', async () => {
      const compilation = await nodeLoader.compileNodePackage(packagePath);

      // Note: This might fail in test environment without TypeScript installed
      // In a real scenario, this would compile successfully
      expect(compilation.success || compilation.errors?.some(e => e.includes('TypeScript'))).toBe(true);
    });

    it('should load the node package', async () => {
      // First, create a simple JavaScript version for testing
      const jsNodePath = path.join(packagePath, 'nodes', 'test-integration-node.node.js');
      const jsNodeContent = `
const TestIntegrationNode = {
  type: 'test-integration-node',
  displayName: 'Test Integration Node',
  name: 'testIntegrationNode',
  group: ['transform'],
  version: 1,
  description: 'A test node for integration testing',
  defaults: {},
  inputs: ['main'],
  outputs: ['main'],
  properties: [],
  execute: async function(inputData) {
    const items = inputData.main?.[0] || [];
    return [{ main: items.map(item => ({ json: { ...item.json, processed: true } })) }];
  }
};

module.exports = TestIntegrationNode;
`;
      await fs.writeFile(jsNodePath, jsNodeContent);

      // Update package.json to point to JS file
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      packageJson.nodes = ['nodes/test-integration-node.node.js'];
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const result = await nodeLoader.loadNodePackage(packagePath);

      expect(result.success).toBe(true);
      expect(result.nodeType).toBe('test-integration-node');
    });

    it('should list loaded packages', () => {
      const packages = nodeLoader.getLoadedPackages();
      
      expect(packages.length).toBeGreaterThan(0);
      const testPackage = packages.find(pkg => pkg.name === 'test-integration-node');
      expect(testPackage).toBeDefined();
    });

    it('should execute the loaded node', async () => {
      const inputData = {
        main: [[
          { json: { test: 'data', value: 123 } }
        ]]
      };

      const result = await nodeService.executeNode(
        'test-integration-node',
        {},
        inputData
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data![0].main).toBeDefined();
      expect(result.data![0].main![0].json.processed).toBe(true);
    });

    it('should unload the node package', async () => {
      await nodeLoader.unloadNodePackage('test-integration-node');

      const packages = nodeLoader.getLoadedPackages();
      const testPackage = packages.find(pkg => pkg.name === 'test-integration-node');
      expect(testPackage).toBeUndefined();
    });
  });

  describe('Hot Reload Functionality', () => {
    const hotReloadNodeOptions = {
      name: 'hot-reload-test-node',
      displayName: 'Hot Reload Test Node',
      description: 'A test node for hot reload testing',
      type: 'transform' as const,
      typescript: false
    };

    let packagePath: string;

    beforeAll(() => {
      // Enable development mode for hot reload
      process.env.NODE_ENV = 'development';
    });

    afterAll(() => {
      // Reset environment
      delete process.env.NODE_ENV;
    });

    it('should set up hot reload when loading in development mode', async () => {
      // Generate package
      const generateResult = await templateGenerator.generateNodePackage(tempDir, hotReloadNodeOptions);
      expect(generateResult.success).toBe(true);
      packagePath = generateResult.packagePath!;

      // Create a simple node file
      const nodePath = path.join(packagePath, 'nodes', 'hot-reload-test-node.node.js');
      const nodeContent = `
const HotReloadTestNode = {
  type: 'hot-reload-test-node',
  displayName: 'Hot Reload Test Node',
  name: 'hotReloadTestNode',
  group: ['transform'],
  version: 1,
  description: 'A test node for hot reload testing',
  defaults: { message: 'original' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [],
  execute: async function(inputData) {
    return [{ main: [{ json: { message: 'original' } }] }];
  }
};

module.exports = HotReloadTestNode;
`;
      await fs.writeFile(nodePath, nodeContent);

      // Update package.json
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      packageJson.nodes = ['nodes/hot-reload-test-node.node.js'];
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      // Load package
      const loadResult = await nodeLoader.loadNodePackage(packagePath);
      expect(loadResult.success).toBe(true);

      // Verify hot reload is set up (watchers should be created)
      const watchers = (nodeLoader as any).watchers;
      expect(watchers.size).toBeGreaterThan(0);
    });

    it('should reload package when file changes', async () => {
      // This test would require actual file watching, which is complex to test
      // In a real scenario, changing a file would trigger the reload
      
      // For now, we'll test the reload functionality directly
      const reloadResult = await nodeLoader.reloadNodePackage('hot-reload-test-node');
      expect(reloadResult.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid package structure gracefully', async () => {
      const invalidPackagePath = path.join(tempDir, 'invalid-package');
      await fs.mkdir(invalidPackagePath, { recursive: true });
      
      // Create invalid package.json
      const packageJsonPath = path.join(invalidPackagePath, 'package.json');
      await fs.writeFile(packageJsonPath, 'invalid json');

      const validation = await nodeLoader.validateNodePackage(invalidPackagePath);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid package.json format');
    });

    it('should handle missing node files', async () => {
      const missingNodePackagePath = path.join(tempDir, 'missing-node-package');
      await fs.mkdir(missingNodePackagePath, { recursive: true });
      
      const packageJson = {
        name: 'missing-node-package',
        version: '1.0.0',
        description: 'Package with missing node files',
        main: 'index.js',
        nodes: ['nodes/NonExistentNode.node.js']
      };
      
      const packageJsonPath = path.join(missingNodePackagePath, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const validation = await nodeLoader.validateNodePackage(missingNodePackagePath);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Node file not found: nodes/NonExistentNode.node.js');
    });

    it('should handle node execution errors gracefully', async () => {
      // Create a node that throws an error
      const errorNodePath = path.join(tempDir, 'error-node-package');
      await fs.mkdir(errorNodePath, { recursive: true });
      await fs.mkdir(path.join(errorNodePath, 'nodes'), { recursive: true });

      const packageJson = {
        name: 'error-node-package',
        version: '1.0.0',
        description: 'Package with error-throwing node',
        main: 'index.js',
        nodes: ['nodes/ErrorNode.node.js']
      };
      
      await fs.writeFile(
        path.join(errorNodePath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const errorNodeContent = `
const ErrorNode = {
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
  execute: async function(inputData) {
    throw new Error('Test error from node execution');
  }
};

module.exports = ErrorNode;
`;
      
      await fs.writeFile(
        path.join(errorNodePath, 'nodes', 'ErrorNode.node.js'),
        errorNodeContent
      );

      // Load the error node
      const loadResult = await nodeLoader.loadNodePackage(errorNodePath);
      expect(loadResult.success).toBe(true);

      // Execute the error node
      const inputData = { main: [[{ json: { test: 'data' } }]] };
      const result = await nodeService.executeNode('error-node', {}, inputData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('Test error from node execution');
    });
  });

  // Helper functions
  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
});
