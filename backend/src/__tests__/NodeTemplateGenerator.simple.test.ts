import { NodeTemplateGenerator, NodeTemplateOptions } from '../services/NodeTemplateGenerator';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn()
  }
}));

const mockFs = require('fs').promises;

describe('NodeTemplateGenerator Basic Tests', () => {
  let generator: NodeTemplateGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new NodeTemplateGenerator();
  });

  describe('constructor', () => {
    it('should create NodeTemplateGenerator instance', () => {
      expect(generator).toBeInstanceOf(NodeTemplateGenerator);
    });
  });

  describe('generateNodePackage', () => {
    const baseOptions: NodeTemplateOptions = {
      name: 'test-node',
      displayName: 'Test Node',
      description: 'A test node for testing',
      type: 'action',
      author: 'Test Author',
      version: '1.0.0'
    };

    it('should fail when package directory already exists', async () => {
      // Mock directory exists
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Package directory already exists: /test/output/test-node');
    });

    it('should handle file system errors gracefully', async () => {
      // Mock directory doesn't exist
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Failed to generate package');
    });

    it('should attempt to create package when directory does not exist', async () => {
      // Mock directory doesn't exist (so we can create it)
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe('/test/output/test-node');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/output/test-node', { recursive: true });
    });
  });
});
