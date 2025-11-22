import { NodeMarketplace, NodeMarketplaceConfig, NodePackageMetadata } from '../services/NodeMarketplace';
import { promises as fs } from 'fs';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    rm: jest.fn()
  }
}));

jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('NodeMarketplace', () => {
  let marketplace: NodeMarketplace;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFetch: jest.MockedFunction<any>;

  const testConfig: NodeMarketplaceConfig = {
    registryUrl: 'https://test-registry.com',
    apiKey: 'test-api-key',
    timeout: 5000,
    retries: 2
  };

  const testPackageMetadata: NodePackageMetadata = {
    id: 'test-package',
    name: 'test-package',
    version: '1.0.0',
    description: 'Test package',
    author: 'Test Author',
    keywords: ['test', 'node'],
    downloadUrl: 'https://test-registry.com/packages/test-package/1.0.0/download',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    downloads: 100,
    rating: 4.5,
    ratingCount: 10,
    verified: true,
    nodeTypes: ['test-node'],
    credentialTypes: ['test-api']
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFetch = (await import('node-fetch')).default as jest.MockedFunction<any>;
    
    marketplace = new NodeMarketplace(testConfig, '/test/install-path');
  });

  describe('searchNodes', () => {
    it('should search for nodes successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          packages: [testPackageMetadata],
          total: 1,
          hasMore: false
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await marketplace.searchNodes({ query: 'test' });

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0]).toEqual(testPackageMetadata);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search?q=test'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should handle search with filters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          packages: [],
          total: 0,
          hasMore: false
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await marketplace.searchNodes({
        query: 'test',
        category: 'integration',
        verified: true,
        minRating: 4.0,
        sortBy: 'downloads',
        sortOrder: 'desc',
        limit: 10
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=integration'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('verified=true'),
        expect.any(Object)
      );
    });

    it('should handle search errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(marketplace.searchNodes({ query: 'test' }))
        .rejects.toThrow('Search failed: 500 Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(marketplace.searchNodes({ query: 'test' }))
        .rejects.toThrow('Search failed: Network error');
    });
  });

  describe('getNodeInfo', () => {
    it('should get node info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(testPackageMetadata)
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await marketplace.getNodeInfo('test-package');

      expect(result).toEqual(testPackageMetadata);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-registry.com/packages/test-package',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle package not found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(marketplace.getNodeInfo('non-existent'))
        .rejects.toThrow('Package not found: non-existent');
    });
  });

  describe('publishNode', () => {
    const publishOptions = {
      packagePath: '/test/package',
      version: '1.0.0',
      changelog: 'Initial release'
    };

    beforeEach(() => {
      // Mock successful validation
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        author: 'Test Author',
        license: 'MIT',
        nodes: ['nodes/test.node.js']
      }));
    });

    it('should publish node successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'test-package',
          version: '1.0.0',
          downloadUrl: 'https://test-registry.com/packages/test-package/1.0.0/download'
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await marketplace.publishNode(publishOptions);

      expect(result.success).toBe(true);
      expect(result.packageId).toBe('test-package');
      expect(result.version).toBe('1.0.0');
    });

    it('should handle dry run', async () => {
      const result = await marketplace.publishNode({
        ...publishOptions,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dry run - package not actually published');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid package', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await marketplace.publishNode(publishOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('package.json not found');
    });

    it('should handle upload errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await marketplace.publishNode(publishOptions);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Upload failed');
    });
  });

  describe('installNode', () => {
    beforeEach(() => {
      // Mock successful package info retrieval
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(testPackageMetadata)
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValue(new Error('File not found')); // Package not installed
    });

    it('should install node successfully', async () => {
      const result = await marketplace.installNode('test-package');

      expect(result.success).toBe(true);
      expect(result.packagePath).toContain('test-package');
      expect(result.version).toBe('1.0.0');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should skip installation if already installed with same version', async () => {
      // Mock package already installed
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-package',
        version: '1.0.0'
      }));

      const result = await marketplace.installNode('test-package');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Package test-package v1.0.0 is already installed');
    });

    it('should force reinstall when force option is true', async () => {
      // Mock package already installed
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-package',
        version: '1.0.0'
      }));

      const result = await marketplace.installNode('test-package', { force: true });

      expect(result.success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('should install specific version', async () => {
      const result = await marketplace.installNode('test-package', { version: '0.9.0' });

      expect(result.success).toBe(true);
      expect(result.version).toBe('0.9.0');
    });

    it('should handle installation errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await marketplace.installNode('test-package');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Install failed');
    });
  });

  describe('updateNode', () => {
    beforeEach(() => {
      // Mock package is installed
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-package',
        version: '0.9.0'
      }));

      // Mock package info with newer version
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...testPackageMetadata,
          version: '1.0.0'
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Mock successful installation
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should update node successfully', async () => {
      const result = await marketplace.updateNode('test-package');

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('0.9.0');
      expect(result.newVersion).toBe('1.0.0');
    });

    it('should skip update if already up to date', async () => {
      // Mock same version installed
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-package',
        version: '1.0.0'
      }));

      const result = await marketplace.updateNode('test-package');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Package test-package is already up to date (v1.0.0)');
    });

    it('should handle package not installed', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(marketplace.updateNode('test-package'))
        .rejects.toThrow('Package not installed: test-package');
    });
  });

  describe('getInstalledPackages', () => {
    it('should return installed packages', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readdir.mockResolvedValue([
        { name: 'package1', isDirectory: () => true },
        { name: 'package2', isDirectory: () => true }
      ] as any);
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ name: 'package1', version: '1.0.0' }))
        .mockResolvedValueOnce(JSON.stringify({ name: 'package2', version: '2.0.0' }));

      const packages = await marketplace.getInstalledPackages();

      expect(packages).toHaveLength(2);
      expect(packages[0].name).toBe('package1');
      expect(packages[1].name).toBe('package2');
    });

    it('should return empty array when install directory does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));

      const packages = await marketplace.getInstalledPackages();

      expect(packages).toEqual([]);
    });

    it('should skip invalid packages', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readdir.mockResolvedValue([
        { name: 'valid-package', isDirectory: () => true },
        { name: 'invalid-package', isDirectory: () => true }
      ] as any);
      
      mockFs.access
        .mockResolvedValueOnce(undefined) // valid package has package.json
        .mockRejectedValueOnce(new Error('File not found')); // invalid package missing package.json
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({ name: 'valid-package', version: '1.0.0' }));

      const packages = await marketplace.getInstalledPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].name).toBe('valid-package');
    });
  });

  describe('uninstallNode', () => {
    it('should uninstall node successfully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.rm.mockResolvedValue(undefined);

      await marketplace.uninstallNode('test-package');

      expect(mockFs.rm).toHaveBeenCalledWith(
        '/test/install-path/test-package',
        { recursive: true, force: true }
      );
    });

    it('should handle package not installed', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(marketplace.uninstallNode('test-package'))
        .rejects.toThrow('Package not installed: test-package');
    });

    it('should handle removal errors', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));

      await expect(marketplace.uninstallNode('test-package'))
        .rejects.toThrow('Uninstall failed: Permission denied');
    });
  });
});
