import { NodeTemplateGenerator, NodeTemplateOptions } from '../services/NodeTemplateGenerator';
import { promises as fs } from 'fs';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn()
  }
}));

describe('NodeTemplateGenerator', () => {
  let generator: NodeTemplateGenerator;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fs as jest.Mocked<typeof fs>;
    generator = new NodeTemplateGenerator();
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

    beforeEach(() => {
      // Mock directory doesn't exist (so we can create it)
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should generate a basic action node package', async () => {
      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe('/test/output/test-node');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/output/test-node', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/package.json',
        expect.stringContaining('"name": "test-node"')
      );
    });

    it('should generate a trigger node package', async () => {
      const triggerOptions: NodeTemplateOptions = {
        ...baseOptions,
        type: 'trigger'
      };

      const result = await generator.generateNodePackage('/test/output', triggerOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/nodes/test-node.node.ts',
        expect.stringContaining('TriggerNode')
      );
    });

    it('should generate a transform node package', async () => {
      const transformOptions: NodeTemplateOptions = {
        ...baseOptions,
        type: 'transform'
      };

      const result = await generator.generateNodePackage('/test/output', transformOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/nodes/test-node.node.ts',
        expect.stringContaining('transform')
      );
    });

    it('should include credentials when requested', async () => {
      const optionsWithCredentials: NodeTemplateOptions = {
        ...baseOptions,
        includeCredentials: true
      };

      const result = await generator.generateNodePackage('/test/output', optionsWithCredentials);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/credentials/test-node.credentials.ts',
        expect.stringContaining('Credentials')
      );
    });

    it('should include test files when requested', async () => {
      const optionsWithTests: NodeTemplateOptions = {
        ...baseOptions,
        includeTests: true
      };

      const result = await generator.generateNodePackage('/test/output', optionsWithTests);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/__tests__/test-node.test.ts',
        expect.stringContaining('describe')
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/jest.config.js',
        expect.stringContaining('ts-jest')
      );
    });

    it('should generate TypeScript configuration when TypeScript is enabled', async () => {
      const tsOptions: NodeTemplateOptions = {
        ...baseOptions,
        typescript: true
      };

      const result = await generator.generateNodePackage('/test/output', tsOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/tsconfig.json',
        expect.stringContaining('"target": "ES2020"')
      );
    });

    it('should generate JavaScript files when TypeScript is disabled', async () => {
      const jsOptions: NodeTemplateOptions = {
        ...baseOptions,
        typescript: false
      };

      const result = await generator.generateNodePackage('/test/output', jsOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/nodes/test-node.node.js',
        expect.not.stringContaining('import')
      );
    });

    it('should generate README file', async () => {
      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/README.md',
        expect.stringContaining('# Test Node')
      );
    });

    it('should generate .gitignore file', async () => {
      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/output/test-node/.gitignore',
        expect.stringContaining('node_modules/')
      );
    });

    it('should fail when package directory already exists', async () => {
      // Mock directory exists
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Package directory already exists: /test/output/test-node');
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await generator.generateNodePackage('/test/output', baseOptions);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Failed to generate package');
    });

    it('should sanitize package names', async () => {
      const optionsWithSpecialChars: NodeTemplateOptions = {
        ...baseOptions,
        name: 'Test Node With Spaces & Special@Chars!'
      };

      const result = await generator.generateNodePackage('/test/output', optionsWithSpecialChars);

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe('/test/output/test-node-with-spaces-special-chars');
    });

    it('should include custom groups in package.json', async () => {
      const optionsWithGroups: NodeTemplateOptions = {
        ...baseOptions,
        group: ['custom', 'integration']
      };

      const result = await generator.generateNodePackage('/test/output', optionsWithGroups);

      expect(result.success).toBe(true);
      
      // Check that package.json was written with custom groups
      const packageJsonCall = (mockFs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].endsWith('package.json')
      );
      expect(packageJsonCall).toBeDefined();
      
      const packageJsonContent = packageJsonCall[1];
      expect(packageJsonContent).toContain('"custom"');
      expect(packageJsonContent).toContain('"integration"');
    });
  });

  describe('template content validation', () => {
    const baseOptions: NodeTemplateOptions = {
      name: 'test-node',
      displayName: 'Test Node',
      description: 'A test node for testing',
      type: 'action',
      typescript: true
    };

    beforeEach(() => {
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should generate valid TypeScript node template', async () => {
      await generator.generateNodePackage('/test/output', baseOptions);

      const nodeFileCall = (mockFs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.node.ts')
      );
      expect(nodeFileCall).toBeDefined();
      
      const nodeContent = nodeFileCall[1];
      expect(nodeContent).toContain('import {');
      expect(nodeContent).toContain('NodeDefinition');
      expect(nodeContent).toContain('export default');
      expect(nodeContent).toContain('type: \'test-node\'');
      expect(nodeContent).toContain('displayName: \'Test Node\'');
    });

    it('should generate valid JavaScript node template', async () => {
      const jsOptions = { ...baseOptions, typescript: false };
      await generator.generateNodePackage('/test/output', jsOptions);

      const nodeFileCall = (mockFs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.node.js')
      );
      expect(nodeFileCall).toBeDefined();
      
      const nodeContent = nodeFileCall[1];
      expect(nodeContent).not.toContain('import {');
      expect(nodeContent).toContain('module.exports =');
      expect(nodeContent).toContain('type: \'test-node\'');
    });

    it('should generate valid credentials template', async () => {
      const optionsWithCredentials = { ...baseOptions, includeCredentials: true };
      await generator.generateNodePackage('/test/output', optionsWithCredentials);

      const credentialsFileCall = (mockFs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].endsWith('.credentials.ts')
      );
      expect(credentialsFileCall).toBeDefined();
      
      const credentialsContent = credentialsFileCall[1];
      expect(credentialsContent).toContain('name: \'test-nodeApi\'');
      expect(credentialsContent).toContain('displayName: \'Test Node API\'');
      expect(credentialsContent).toContain('API Key');
    });

    it('should generate valid test template', async () => {
      const optionsWithTests = { ...baseOptions, includeTests: true };
      await generator.generateNodePackage('/test/output', optionsWithTests);

      const testFileCall = (mockFs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].includes('__tests__') && call[0].endsWith('.test.ts')
      );
      expect(testFileCall).toBeDefined();
      
      const testContent = testFileCall[1];
      expect(testContent).toContain('describe(\'TestNodeNode\'');
      expect(testContent).toContain('should have correct node definition');
      expect(testContent).toContain('should execute successfully');
    });
  });
});
