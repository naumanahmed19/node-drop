import { NodeLoader, NodePackageInfo } from '../services/NodeLoader';
import { NodeService } from '../services/NodeService';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
const mockFs = {
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  rm: jest.fn()
};

jest.mock('fs', () => ({
  promises: mockFs
}));

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('../services/NodeService');
jest.mock('@prisma/client');

describe('NodeLoader', () => {
  let nodeLoader: NodeLoader;
  let mockNodeService: jest.Mocked<NodeService>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const testPackagePath = '/test/custom-nodes/test-package';
  const testPackageInfo: NodePackageInfo = {
    name: 'test-package',
    version: '1.0.0',
    description: 'Test package',
    main: 'index.js',
    nodes: ['nodes/TestNode.node.js'],
    author: 'Test Author'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockNodeService = {
      registerNode: jest.fn(),
      unregisterNode: jest.fn(),
      validateNodeDefinition: jest.fn()
    } as any;
    
    mockPrisma = {} as jest.Mocked<PrismaClient>;
    
    nodeLoader = new NodeLoader(mockNodeService, mockPrisma, '/test/custom-nodes');
  });

  describe('validateNodePackage', () => {
    it('should validate a valid package', async () => {
      // Mock file system calls
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(testPackageInfo));
      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.packageInfo).toEqual(testPackageInfo);
    });

    it('should fail validation when package.json is missing', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('package.json not found');
    });

    it('should fail validation when package.json is invalid JSON', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid package.json format');
    });

    it('should fail validation when required fields are missing', async () => {
      const invalidPackageInfo = {
        description: 'Test package'
        // Missing name, version, main, nodes
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidPackageInfo));

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Package name is required');
      expect(result.errors).toContain('Package version is required');
      expect(result.errors).toContain('Package main entry point is required');
      expect(result.errors).toContain('Package must define at least one node');
    });

    it('should fail validation when node files do not exist', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined) // package.json exists
        .mockResolvedValueOnce(undefined) // main file exists
        .mockRejectedValueOnce(new Error('Node file not found')); // node file missing

      mockFs.readFile.mockResolvedValue(JSON.stringify(testPackageInfo));

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Node file not found: nodes/TestNode.node.js');
    });

    it('should warn about TypeScript files', async () => {
      const tsPackageInfo = {
        ...testPackageInfo,
        nodes: ['nodes/TestNode.node.ts']
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(tsPackageInfo));

      const result = await nodeLoader.validateNodePackage(testPackagePath);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('TypeScript file detected: nodes/TestNode.node.ts. Make sure to compile before loading.');
    });
  });

  describe('loadNodePackage', () => {
    beforeEach(() => {
      // Mock successful validation
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(testPackageInfo));
      
      // Mock successful node service registration
      mockNodeService.registerNode.mockResolvedValue({
        success: true,
        nodeType: 'test-node'
      });

      // Mock require for node loading
      const mockNodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: jest.fn()
      };

      // Mock require for node loading
      jest.doMock('/test/path', () => mockNodeDefinition, { virtual: true });
    });

    it('should load a valid package successfully', async () => {
      const result = await nodeLoader.loadNodePackage(testPackagePath);

      expect(result.success).toBe(true);
      expect(result.nodeType).toBe('test-package');
      expect(mockNodeService.registerNode).toHaveBeenCalled();
    });

    it('should fail to load invalid package', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await nodeLoader.loadNodePackage(testPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('package.json not found');
    });

    it('should fail when node registration fails', async () => {
      mockNodeService.registerNode.mockResolvedValue({
        success: false,
        errors: ['Registration failed']
      });

      const result = await nodeLoader.loadNodePackage(testPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Registration failed');
    });
  });

  describe('compileNodePackage', () => {
    it('should skip compilation when no TypeScript files exist', async () => {
      // Mock no TypeScript files
      mockFs.readdir.mockResolvedValue([]);

      const result = await nodeLoader.compileNodePackage(testPackagePath);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('No TypeScript files found, skipping compilation');
    });

    it('should fail when TypeScript is not available', async () => {
      // Mock TypeScript files exist
      mockFs.readdir.mockResolvedValue([
        { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any
      ]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      // Mock TypeScript not available by mocking require.resolve to throw
      const originalResolve = require.resolve;
      (require.resolve as any) = jest.fn().mockImplementation((module: string) => {
        if (module === 'typescript') {
          throw new Error('Module not found');
        }
        return originalResolve(module);
      });

      const result = await nodeLoader.compileNodePackage(testPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('TypeScript is required for compilation but not found');

      // Restore original require.resolve
      require.resolve = originalResolve;
    });
  });

  describe('unloadNodePackage', () => {
    beforeEach(async () => {
      // Load a package first
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(testPackageInfo));
      mockNodeService.registerNode.mockResolvedValue({
        success: true,
        nodeType: 'test-node'
      });

      const mockNodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: jest.fn()
      };

      (require as any).resolve = jest.fn().mockReturnValue('/test/path');
      (require as any).cache = {};
      (global as any).require = jest.fn().mockReturnValue(mockNodeDefinition);

      await nodeLoader.loadNodePackage(testPackagePath);
    });

    it('should unload a loaded package', async () => {
      await nodeLoader.unloadNodePackage('test-package');

      expect(mockNodeService.unregisterNode).toHaveBeenCalledWith('test-node');
    });

    it('should fail to unload non-existent package', async () => {
      await expect(nodeLoader.unloadNodePackage('non-existent')).rejects.toThrow('Package not found: non-existent');
    });
  });

  describe('getLoadedPackages', () => {
    it('should return empty array when no packages loaded', () => {
      const packages = nodeLoader.getLoadedPackages();
      expect(packages).toEqual([]);
    });

    it('should return loaded packages', async () => {
      // Load a package first
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(testPackageInfo));
      mockNodeService.registerNode.mockResolvedValue({
        success: true,
        nodeType: 'test-node'
      });

      const mockNodeDefinition = {
        type: 'test-node',
        displayName: 'Test Node',
        name: 'testNode',
        group: ['test'],
        version: 1,
        description: 'Test node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: jest.fn()
      };

      (require as any).resolve = jest.fn().mockReturnValue('/test/path');
      (require as any).cache = {};
      (global as any).require = jest.fn().mockReturnValue(mockNodeDefinition);

      await nodeLoader.loadNodePackage(testPackagePath);

      const packages = nodeLoader.getLoadedPackages();
      expect(packages).toHaveLength(1);
      expect(packages[0]).toEqual(testPackageInfo);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const mockWatcher = {
        close: jest.fn().mockResolvedValue(void 0)
      };

      // Simulate a watcher being added
      (nodeLoader as any).watchers.set('test-package', mockWatcher);

      await nodeLoader.cleanup();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
