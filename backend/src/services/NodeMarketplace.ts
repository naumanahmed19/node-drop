import { promises as fs } from 'fs';
import * as path from 'path';
import { NodePackageInfo } from './NodeLoader';
import { logger } from '../utils/logger';

export interface NodeMarketplaceConfig {
  registryUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface NodePackageMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  keywords: string[];
  downloadUrl: string;
  homepage?: string;
  repository?: string;
  license?: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  verified: boolean;
  screenshots?: string[];
  readme?: string;
  changelog?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  nodeTypes: string[];
  credentialTypes: string[];
}

export interface NodeSearchFilters {
  query?: string;
  category?: string;
  author?: string;
  verified?: boolean;
  minRating?: number;
  tags?: string[];
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface NodeSearchResult {
  packages: NodePackageMetadata[];
  total: number;
  hasMore: boolean;
}

export interface PublishOptions {
  packagePath: string;
  version?: string;
  changelog?: string;
  tags?: string[];
  private?: boolean;
  dryRun?: boolean;
}

export interface PublishResult {
  success: boolean;
  packageId?: string;
  version?: string;
  downloadUrl?: string;
  errors?: string[];
  warnings?: string[];
}

export interface InstallOptions {
  version?: string;
  force?: boolean;
  skipValidation?: boolean;
  installPath?: string;
}

export interface InstallResult {
  success: boolean;
  packagePath?: string;
  version?: string;
  errors?: string[];
  warnings?: string[];
}

export interface UpdateResult {
  success: boolean;
  oldVersion?: string;
  newVersion?: string;
  changelog?: string;
  errors?: string[];
  warnings?: string[];
}

export class NodeMarketplace {
  private config: NodeMarketplaceConfig;
  private defaultInstallPath: string;

  constructor(config: NodeMarketplaceConfig, installPath?: string) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    };
    this.defaultInstallPath = installPath || path.join(process.cwd(), 'custom-nodes');
  }

  /**
   * Search for nodes in the marketplace
   */
  async searchNodes(filters: NodeSearchFilters = {}): Promise<NodeSearchResult> {
    try {
      // Fetch from external API
      const apiUrl = 'https://nodedrop.app/api/nodes';
      logger.info('Starting marketplace search', { apiUrl, filters });

      const fetch = (await import('node-fetch')).default;

      let allPackages: NodePackageMetadata[] = [];

      try {
        logger.info('Fetching from external API...');
        const response = await fetch(apiUrl);
        logger.info('API response received', { ok: response.ok, status: response.status });

        if (response.ok) {
          const apiNodes = await response.json() as any[];
          logger.info('Fetched nodes from external API', { count: apiNodes.length, firstNode: apiNodes[0] });

          // Transform API response to our format
          allPackages = apiNodes.map(node => ({
            id: node.id,
            name: node.title,
            version: node.version || '1.0.0',
            description: node.description,
            author: node.author,
            keywords: node.tags || [],
            downloadUrl: node.downloadUrl || (node.githubUrl ? `${node.githubUrl}/archive/refs/heads/main.zip` : ''),
            icon: node.icon,
            iconUrl: node.iconUrl,
            homepage: node.githubUrl,
            repository: node.githubUrl,
            license: 'MIT',
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            downloads: node.downloads || 0,
            rating: node.rating || 0,
            ratingCount: 0,
            verified: node.published || false,
            screenshots: [],
            readme: node.longDescription || node.description,
            changelog: '',
            dependencies: {},
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: [node.title],
            credentialTypes: []
          }));

          logger.info('Transformed API nodes', { count: allPackages.length });
        } else {
          logger.warn('API response not OK', { status: response.status, statusText: response.statusText });
        }
      } catch (apiError) {
        logger.error('Failed to fetch from external API', { error: apiError, message: apiError instanceof Error ? apiError.message : 'Unknown error' });
      }

      // Fallback to mock data if API fails
      if (allPackages.length === 0) {
        const mockPackages: NodePackageMetadata[] = [
          {
            id: 'slack-advanced',
            name: 'nd-nodes-slack-advanced',
            version: '1.2.3',
            description: 'Advanced Slack integration with threads, reactions, and file uploads',
            author: 'SlackDevs',
            keywords: ['communication', 'slack', 'messaging', 'notifications'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-slack-advanced/-/nd-nodes-slack-advanced-1.2.3.tgz',
            homepage: 'https://github.com/slackdevs/nd-nodes-slack-advanced',
            repository: 'https://github.com/slackdevs/nd-nodes-slack-advanced',
            license: 'MIT',
            createdAt: '2024-08-15T10:30:00Z',
            updatedAt: '2024-09-20T14:45:00Z',
            downloads: 15420,
            rating: 4.8,
            ratingCount: 127,
            verified: true,
            screenshots: [],
            readme: '# Slack Advanced Node\n\nAdvanced Slack integration for nodeDrop with support for threads, reactions, and file uploads.',
            changelog: '## v1.2.3\n- Fixed thread reply issues\n- Added reaction support',
            dependencies: { 'axios': '^1.0.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['SlackAdvanced'],
            credentialTypes: ['SlackAdvancedApi']
          },
          {
            id: 'mongodb-extended',
            name: 'nd-nodes-mongodb-extended',
            version: '2.1.0',
            description: 'Enhanced MongoDB operations with aggregation pipelines and advanced queries',
            author: 'DatabaseExperts',
            keywords: ['database', 'mongodb', 'aggregation', 'nosql'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-mongodb-extended/-/nd-nodes-mongodb-extended-2.1.0.tgz',
            homepage: 'https://github.com/dbexperts/nd-nodes-mongodb-extended',
            repository: 'https://github.com/dbexperts/nd-nodes-mongodb-extended',
            license: 'Apache-2.0',
            createdAt: '2024-07-10T08:15:00Z',
            updatedAt: '2024-09-18T11:20:00Z',
            downloads: 8930,
            rating: 4.6,
            ratingCount: 89,
            verified: true,
            screenshots: [],
            readme: '# MongoDB Extended Node\n\nEnhanced MongoDB operations for nodeDrop with aggregation pipeline support.',
            changelog: '## v2.1.0\n- Added aggregation pipeline support\n- Improved error handling',
            dependencies: { 'mongodb': '^5.0.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['MongoDBExtended'],
            credentialTypes: ['MongoDBExtended']
          },
          {
            id: 'email-templates-pro',
            name: 'nd-nodes-email-templates-pro',
            version: '1.5.2',
            description: 'Professional email templates with dynamic content and styling',
            author: 'EmailMasters',
            keywords: ['communication', 'email', 'templates', 'html'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-email-templates-pro/-/nd-nodes-email-templates-pro-1.5.2.tgz',
            homepage: 'https://github.com/emailmasters/nd-nodes-email-templates-pro',
            repository: 'https://github.com/emailmasters/nd-nodes-email-templates-pro',
            license: 'MIT',
            createdAt: '2024-06-20T16:45:00Z',
            updatedAt: '2024-09-15T09:30:00Z',
            downloads: 12350,
            rating: 4.9,
            ratingCount: 156,
            verified: false,
            screenshots: [],
            readme: '# Email Templates Pro\n\nProfessional email templates with dynamic content for nodeDrop.',
            changelog: '## v1.5.2\n- Added new template designs\n- Fixed CSS rendering issues',
            dependencies: { 'handlebars': '^4.7.0', 'mjml': '^4.14.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['EmailTemplatesPro'],
            credentialTypes: []
          },
          {
            id: 'data-transformer',
            name: 'nd-nodes-data-transformer',
            version: '3.0.1',
            description: 'Advanced data transformation with custom functions and filters',
            author: 'DataWizards',
            keywords: ['transform', 'data', 'filter', 'manipulation'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-data-transformer/-/nd-nodes-data-transformer-3.0.1.tgz',
            homepage: 'https://github.com/datawizards/nd-nodes-data-transformer',
            repository: 'https://github.com/datawizards/nd-nodes-data-transformer',
            license: 'MIT',
            createdAt: '2024-05-05T12:00:00Z',
            updatedAt: '2024-09-22T15:15:00Z',
            downloads: 25670,
            rating: 4.7,
            ratingCount: 203,
            verified: true,
            screenshots: [],
            readme: '# Data Transformer Node\n\nAdvanced data transformation capabilities for nodeDrop workflows.',
            changelog: '## v3.0.1\n- Performance improvements\n- Added new transformation functions',
            dependencies: { 'lodash': '^4.17.0', 'jsonpath': '^1.1.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['DataTransformer'],
            credentialTypes: []
          },
          {
            id: 'api-gateway',
            name: 'nd-nodes-api-gateway',
            version: '1.8.4',
            description: 'Comprehensive API gateway with rate limiting and authentication',
            author: 'APIDevs',
            keywords: ['api', 'gateway', 'auth', 'rate-limiting'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-api-gateway/-/nd-nodes-api-gateway-1.8.4.tgz',
            homepage: 'https://github.com/apidevs/nd-nodes-api-gateway',
            repository: 'https://github.com/apidevs/nd-nodes-api-gateway',
            license: 'MIT',
            createdAt: '2024-04-12T14:20:00Z',
            updatedAt: '2024-09-10T10:45:00Z',
            downloads: 7890,
            rating: 4.4,
            ratingCount: 67,
            verified: true,
            screenshots: [],
            readme: '# API Gateway Node\n\nComprehensive API gateway functionality for nodeDrop.',
            changelog: '## v1.8.4\n- Fixed rate limiting bugs\n- Improved authentication handling',
            dependencies: { 'express-rate-limit': '^6.0.0', 'jsonwebtoken': '^9.0.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['APIGateway'],
            credentialTypes: ['APIGatewayAuth']
          },
          {
            id: 'webhook-enhanced',
            name: 'nd-nodes-webhook-enhanced',
            version: '2.3.1',
            description: 'Enhanced webhook node with advanced filtering and validation',
            author: 'WebhookPro',
            keywords: ['trigger', 'webhook', 'http', 'validation'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-webhook-enhanced/-/nd-nodes-webhook-enhanced-2.3.1.tgz',
            homepage: 'https://github.com/webhookpro/nd-nodes-webhook-enhanced',
            repository: 'https://github.com/webhookpro/nd-nodes-webhook-enhanced',
            license: 'MIT',
            createdAt: '2024-03-18T09:30:00Z',
            updatedAt: '2024-09-25T13:20:00Z',
            downloads: 18750,
            rating: 4.5,
            ratingCount: 142,
            verified: true,
            screenshots: [],
            readme: '# Webhook Enhanced Node\n\nAdvanced webhook functionality with filtering and validation.',
            changelog: '## v2.3.1\n- Added payload validation\n- Improved error handling',
            dependencies: { 'joi': '^17.0.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['WebhookEnhanced'],
            credentialTypes: []
          },
          {
            id: 'csv-processor',
            name: 'nd-nodes-csv-processor',
            version: '1.4.0',
            description: 'Advanced CSV processing with custom delimiters and encoding support',
            author: 'CSVExperts',
            keywords: ['transform', 'csv', 'data', 'processing'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-csv-processor/-/nd-nodes-csv-processor-1.4.0.tgz',
            homepage: 'https://github.com/csvexperts/nd-nodes-csv-processor',
            repository: 'https://github.com/csvexperts/nd-nodes-csv-processor',
            license: 'MIT',
            createdAt: '2024-02-14T11:15:00Z',
            updatedAt: '2024-09-12T16:40:00Z',
            downloads: 9340,
            rating: 4.3,
            ratingCount: 78,
            verified: false,
            screenshots: [],
            readme: '# CSV Processor Node\n\nAdvanced CSV processing capabilities for nodeDrop.',
            changelog: '## v1.4.0\n- Added custom delimiter support\n- Improved encoding detection',
            dependencies: { 'csv-parser': '^3.0.0', 'iconv-lite': '^0.6.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['CSVProcessor'],
            credentialTypes: []
          },
          {
            id: 'scheduler-pro',
            name: 'nd-nodes-scheduler-pro',
            version: '2.0.5',
            description: 'Professional scheduling with cron expressions and timezone support',
            author: 'ScheduleMasters',
            keywords: ['trigger', 'schedule', 'cron', 'timezone'],
            downloadUrl: 'https://registry.npmjs.org/nd-nodes-scheduler-pro/-/nd-nodes-scheduler-pro-2.0.5.tgz',
            homepage: 'https://github.com/schedulemasters/nd-nodes-scheduler-pro',
            repository: 'https://github.com/schedulemasters/nd-nodes-scheduler-pro',
            license: 'MIT',
            createdAt: '2024-01-20T07:45:00Z',
            updatedAt: '2024-09-08T12:30:00Z',
            downloads: 14200,
            rating: 4.6,
            ratingCount: 118,
            verified: true,
            screenshots: [],
            readme: '# Scheduler Pro Node\n\nProfessional scheduling capabilities for nodeDrop workflows.',
            changelog: '## v2.0.5\n- Fixed timezone handling\n- Added new cron presets',
            dependencies: { 'node-cron': '^3.0.0', 'moment-timezone': '^0.5.0' },
            peerDependencies: {},
            engines: { 'node': '>=16.0.0' },
            nodeTypes: ['SchedulerPro'],
            credentialTypes: []
          }
        ];
        allPackages = mockPackages;
      }

      // Apply filters
      let filteredPackages = [...allPackages];
      logger.info('Starting filtering', { initialCount: filteredPackages.length, filters });

      // Filter by search query
      if (filters.query) {
        const query = filters.query.toLowerCase();
        filteredPackages = filteredPackages.filter(pkg =>
          pkg.name.toLowerCase().includes(query) ||
          pkg.description.toLowerCase().includes(query) ||
          pkg.author.toLowerCase().includes(query) ||
          pkg.keywords.some(keyword => keyword.toLowerCase().includes(query))
        );
      }

      // Filter by category (using first keyword as category)
      if (filters.category) {
        const category = filters.category.toLowerCase();
        filteredPackages = filteredPackages.filter(pkg =>
          pkg.keywords.length > 0 && pkg.keywords[0].toLowerCase() === category
        );
      }

      // Filter by author
      if (filters.author) {
        filteredPackages = filteredPackages.filter(pkg =>
          pkg.author.toLowerCase().includes(filters.author!.toLowerCase())
        );
      }

      // Filter by verified status
      if (filters.verified !== undefined) {
        logger.info('Filtering by verified status', { verified: filters.verified, beforeCount: filteredPackages.length });
        filteredPackages = filteredPackages.filter(pkg => pkg.verified === filters.verified);
        logger.info('After verified filter', { afterCount: filteredPackages.length });
      }

      // Filter by minimum rating
      if (filters.minRating) {
        filteredPackages = filteredPackages.filter(pkg => pkg.rating >= filters.minRating!);
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        filteredPackages = filteredPackages.filter(pkg =>
          filters.tags!.some(tag =>
            pkg.keywords.some(keyword => keyword.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }

      // Sort packages
      if (filters.sortBy) {
        filteredPackages.sort((a, b) => {
          let aValue: any, bValue: any;

          switch (filters.sortBy) {
            case 'downloads':
              aValue = a.downloads;
              bValue = b.downloads;
              break;
            case 'rating':
              aValue = a.rating;
              bValue = b.rating;
              break;
            case 'updated':
              aValue = new Date(a.updatedAt).getTime();
              bValue = new Date(b.updatedAt).getTime();
              break;
            case 'created':
              aValue = new Date(a.createdAt).getTime();
              bValue = new Date(b.createdAt).getTime();
              break;
            default: // relevance
              aValue = a.downloads * a.rating;
              bValue = b.downloads * b.rating;
          }

          if (filters.sortOrder === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        });
      }

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 20; // Default to 20 nodes
      const total = filteredPackages.length;
      const paginatedPackages = filteredPackages.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      logger.info('Marketplace search completed', {
        query: filters.query,
        total,
        returned: paginatedPackages.length,
        hasMore
      });

      return {
        packages: paginatedPackages,
        total,
        hasMore
      };
    } catch (error) {
      logger.error('Failed to search nodes', { error, filters });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a specific node package
   */
  async getNodeInfo(packageId: string): Promise<NodePackageMetadata> {
    try {
      // Get all packages from search and find the specific one
      const searchResult = await this.searchNodes({});
      const packageInfo = searchResult.packages.find(pkg => pkg.id === packageId);

      if (!packageInfo) {
        throw new Error(`Package not found: ${packageId}`);
      }

      logger.info('Retrieved package info', { packageId, name: packageInfo.name });
      return packageInfo;
    } catch (error) {
      logger.error('Failed to get node info', { error, packageId });
      throw new Error(`Failed to get package info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publish a node package to the marketplace
   */
  async publishNode(options: PublishOptions): Promise<PublishResult> {
    try {
      // Validate package before publishing
      const validation = await this.validatePackageForPublish(options.packagePath);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Create package archive
      const archivePath = await this.createPackageArchive(options.packagePath);

      try {
        // Upload package
        const uploadResult = await this.uploadPackage(archivePath, options);

        if (uploadResult.success) {

        }

        return uploadResult;
      } finally {
        // Clean up archive
        try {
          await fs.unlink(archivePath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up package archive', { error: cleanupError, archivePath });
        }
      }
    } catch (error) {
      logger.error('Failed to publish node', { error, options });
      return {
        success: false,
        errors: [`Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Install a node package from the marketplace
   */
  async installNode(packageId: string, options: InstallOptions = {}): Promise<InstallResult> {
    try {
      // Get package information
      const packageInfo = await this.getNodeInfo(packageId);

      // Determine version to install
      const versionToInstall = options.version || packageInfo.version;

      // Check if package is already installed
      const installPath = options.installPath || this.defaultInstallPath;
      const packagePath = path.join(installPath, packageInfo.name);

      if (!options.force) {
        const isInstalled = await this.isPackageInstalled(packagePath);
        if (isInstalled) {
          const installedVersion = await this.getInstalledVersion(packagePath);
          if (installedVersion === versionToInstall) {
            return {
              success: true,
              packagePath,
              version: versionToInstall,
              warnings: [`Package ${packageInfo.name} v${versionToInstall} is already installed`]
            };
          }
        }
      }

      // Simulate installation process
      logger.info('Starting package installation', { packageId, version: versionToInstall });

      // Simulate download delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Download package (mock implementation)
      const downloadResult = await this.downloadPackage(packageInfo, versionToInstall, installPath);

      if (!downloadResult.success) {
        return downloadResult;
      }

      // Validate installed package
      if (!options.skipValidation) {
        const validation = await this.validateInstalledPackage(downloadResult.packagePath!);
        if (!validation.valid) {
          return {
            success: false,
            errors: [`Package validation failed: ${validation.errors.join(', ')}`]
          };
        }
      }

      logger.info('Package installation completed', {
        packageId,
        version: versionToInstall,
        packagePath: downloadResult.packagePath
      });

      return {
        success: true,
        packagePath: downloadResult.packagePath,
        version: versionToInstall
      };
    } catch (error) {
      logger.error('Failed to install node', { error, packageId, options });
      return {
        success: false,
        errors: [`Install failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Update a node package to the latest version
   */
  async updateNode(packageId: string): Promise<UpdateResult> {
    try {
      // Get current installed version
      const packagePath = path.join(this.defaultInstallPath, packageId);
      const isInstalled = await this.isPackageInstalled(packagePath);

      if (!isInstalled) {
        throw new Error(`Package not installed: ${packageId}`);
      }

      const currentVersion = await this.getInstalledVersion(packagePath);

      // Get latest version from marketplace
      const packageInfo = await this.getNodeInfo(packageId);
      const latestVersion = packageInfo.version;

      if (currentVersion === latestVersion) {
        return {
          success: true,
          oldVersion: currentVersion,
          newVersion: latestVersion,
          warnings: [`Package ${packageId} is already up to date (v${latestVersion})`]
        };
      }

      // Install latest version
      const installResult = await this.installNode(packageId, { force: true });

      if (!installResult.success) {
        return {
          success: false,
          errors: installResult.errors
        };
      }



      return {
        success: true,
        oldVersion: currentVersion,
        newVersion: latestVersion,
        changelog: packageInfo.changelog
      };
    } catch (error) {
      logger.error('Failed to update node', { error, packageId });
      return {
        success: false,
        errors: [`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get list of installed packages
   */
  async getInstalledPackages(): Promise<NodePackageInfo[]> {
    try {
      const packages: NodePackageInfo[] = [];
      const installPath = this.defaultInstallPath;

      const dirExists = await this.directoryExists(installPath);
      if (!dirExists) {
        return packages;
      }

      const entries = await fs.readdir(installPath, { withFileTypes: true });
      const packageDirs = entries.filter(entry => entry.isDirectory());

      // Directories to exclude from package list
      const excludedDirs = ['node_modules', '.git', 'credentials', 'nodes', 'dist', 'build'];

      for (const packageDir of packageDirs) {
        try {
          // Skip excluded directories
          if (excludedDirs.includes(packageDir.name)) {
            continue;
          }

          const packagePath = path.join(installPath, packageDir.name);
          const packageJsonPath = path.join(packagePath, 'package.json');

          const packageJsonExists = await this.fileExists(packageJsonPath);
          if (!packageJsonExists) {
            logger.debug('Skipping directory without package.json', { dir: packageDir.name });
            continue;
          }

          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
          const packageInfo = JSON.parse(packageJsonContent);

          // Validate that it's a valid node package
          if (!packageInfo.name) {
            logger.debug('Skipping package without name', { dir: packageDir.name });
            continue;
          }

          packages.push(packageInfo);
        } catch (error) {
          logger.warn('Failed to read package info', { error, packageName: packageDir.name });
        }
      }

      return packages;
    } catch (error) {
      logger.error('Failed to get installed packages', { error });
      return [];
    }
  }

  /**
   * Uninstall a node package
   */
  async uninstallNode(packageId: string): Promise<void> {
    try {
      const packagePath = path.join(this.defaultInstallPath, packageId);
      const isInstalled = await this.isPackageInstalled(packagePath);

      if (!isInstalled) {
        throw new Error(`Package not installed: ${packageId}`);
      }

      // Remove package directory
      await this.removeDirectory(packagePath);


    } catch (error) {
      logger.error('Failed to uninstall node', { error, packageId });
      throw new Error(`Uninstall failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest(url: string, method: string, body?: any): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'nd-node-cli/1.0.0'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        const fetch = (await import('node-fetch')).default;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response as any; // Type assertion for compatibility
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.config.retries!) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Validate package for publishing
   */
  private async validatePackageForPublish(packagePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check package.json
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);

      if (!packageJsonExists) {
        errors.push('package.json not found');
        return { valid: false, errors };
      }

      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageInfo = JSON.parse(packageJsonContent);

      // Validate required fields for publishing
      if (!packageInfo.name) errors.push('Package name is required');
      if (!packageInfo.version) errors.push('Package version is required');
      if (!packageInfo.description) errors.push('Package description is required');
      if (!packageInfo.author) errors.push('Package author is required');
      if (!packageInfo.license) errors.push('Package license is required');
      if (!packageInfo.nodes || packageInfo.nodes.length === 0) {
        errors.push('Package must define at least one node');
      }

      // Check README
      const readmePath = path.join(packagePath, 'README.md');
      const readmeExists = await this.fileExists(readmePath);
      if (!readmeExists) {
        errors.push('README.md is required for publishing');
      }

      // Validate node files exist
      if (packageInfo.nodes) {
        for (const nodePath of packageInfo.nodes) {
          const fullNodePath = path.join(packagePath, nodePath);
          const nodeExists = await this.fileExists(fullNodePath);
          if (!nodeExists) {
            errors.push(`Node file not found: ${nodePath}`);
          }
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Create package archive for upload
   */
  private async createPackageArchive(packagePath: string): Promise<string> {
    // This is a simplified implementation
    // In a real implementation, you would create a tar.gz archive
    const archivePath = path.join(packagePath, '..', `${path.basename(packagePath)}.tar.gz`);

    // For now, just return the package path
    // In production, implement actual archiving logic
    return packagePath;
  }

  /**
   * Upload package to marketplace
   */
  private async uploadPackage(archivePath: string, options: PublishOptions): Promise<PublishResult> {
    try {
      if (options.dryRun) {
        return {
          success: true,
          warnings: ['Dry run - package not actually published']
        };
      }

      // Read package info
      const packageJsonPath = path.join(archivePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageInfo = JSON.parse(packageJsonContent);

      // In a real implementation, you would upload the archive
      // For now, simulate the upload
      const url = `${this.config.registryUrl}/packages`;
      const response = await this.makeRequest(url, 'POST', {
        name: packageInfo.name,
        version: options.version || packageInfo.version,
        description: packageInfo.description,
        author: packageInfo.author,
        changelog: options.changelog,
        tags: options.tags,
        private: options.private
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;

      return {
        success: true,
        packageId: result.id,
        version: result.version,
        downloadUrl: result.downloadUrl
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Download package from marketplace
   */
  private async downloadPackage(
    packageInfo: NodePackageMetadata,
    version: string,
    installPath: string
  ): Promise<InstallResult> {
    try {
      const packagePath = path.join(installPath, packageInfo.name);

      // Ensure install directory exists
      await fs.mkdir(installPath, { recursive: true });

      // Download the package from the downloadUrl
      if (packageInfo.downloadUrl) {
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(packageInfo.downloadUrl);

          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }

          // Get the zip file
          const buffer = await response.buffer();

          // Extract the zip file
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(buffer);

          // Create a temporary extraction directory
          const tempExtractPath = path.join(installPath, `temp-${packageInfo.name}-${Date.now()}`);
          await fs.mkdir(tempExtractPath, { recursive: true });

          // Extract to temp directory
          zip.extractAllTo(tempExtractPath, true);

          // Find the actual package directory (GitHub creates a folder like "mongodb-main")
          const extractedContents = await fs.readdir(tempExtractPath);
          logger.info('Extracted contents', { contents: extractedContents, tempPath: tempExtractPath });

          // If there's only one directory, assume it's the package root
          if (extractedContents.length === 1) {
            const extractedDir = path.join(tempExtractPath, extractedContents[0]);
            const stat = await fs.stat(extractedDir);

            if (stat.isDirectory()) {
              // Move the contents from the nested directory to the final package path
              await fs.mkdir(packagePath, { recursive: true });

              // Copy all files from nested directory to package path
              const files = await fs.readdir(extractedDir);
              for (const file of files) {
                const srcPath = path.join(extractedDir, file);
                const destPath = path.join(packagePath, file);
                await fs.rename(srcPath, destPath);
              }

              // Clean up temp directory
              await fs.rm(tempExtractPath, { recursive: true, force: true });

              logger.info('Package downloaded and extracted (flattened)', { packageName: packageInfo.name, packagePath });

              // Read the actual package.json to get the real package name
              const packageJsonPath = path.join(packagePath, 'package.json');
              let actualPackageName = packageInfo.name;
              try {
                const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
                const packageJson = JSON.parse(packageJsonContent);
                actualPackageName = packageJson.name || packageInfo.name;
                logger.info('Read actual package name from package.json', { actualPackageName });
              } catch (readError) {
                logger.warn('Could not read package.json, using API name', { error: readError });
              }

              // Install dependencies if package.json exists
              await this.installPackageDependencies(packagePath);

              return {
                success: true,
                packagePath,
                version,
                packageName: actualPackageName
              };
            }
          }

          // If extraction structure is different, just move the temp directory
          await fs.rename(tempExtractPath, packagePath);

          logger.info('Package downloaded and extracted', { packageName: packageInfo.name, packagePath });

          // Read the actual package.json to get the real package name
          const packageJsonPath = path.join(packagePath, 'package.json');
          let actualPackageName = packageInfo.name;
          try {
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);
            actualPackageName = packageJson.name || packageInfo.name;
            logger.info('Read actual package name from package.json', { actualPackageName });
          } catch (readError) {
            logger.warn('Could not read package.json, using API name', { error: readError });
          }

          // Install dependencies if package.json exists
          await this.installPackageDependencies(packagePath);

          return {
            success: true,
            packagePath,
            version,
            packageName: actualPackageName
          };
        } catch (downloadError) {
          logger.error('Failed to download package from URL', { error: downloadError, url: packageInfo.downloadUrl });
          // Fall back to creating a basic package structure
        }
      }

      // Fallback: create a basic package structure
      await fs.mkdir(packagePath, { recursive: true });

      // Create a basic package.json
      const packageJson = {
        name: packageInfo.name,
        version: version,
        description: packageInfo.description,
        author: packageInfo.author,
        nodes: packageInfo.nodeTypes.map(type => `nodes/${type}.node.js`),
        credentials: packageInfo.credentialTypes.map(type => `credentials/${type}.credentials.js`)
      };

      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      return {
        success: true,
        packagePath,
        version
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate installed package
   */
  private async validateInstalledPackage(packagePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);

      if (!packageJsonExists) {
        errors.push('package.json not found in installed package');
        return { valid: false, errors };
      }

      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageInfo = JSON.parse(packageJsonContent);

      if (!packageInfo.name) errors.push('Package name missing');
      if (!packageInfo.version) errors.push('Package version missing');

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Check if package is installed
   */
  private async isPackageInstalled(packagePath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      return await this.fileExists(packageJsonPath);
    } catch {
      return false;
    }
  }

  /**
   * Get installed package version
   */
  private async getInstalledVersion(packagePath: string): Promise<string> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageInfo = JSON.parse(packageJsonContent);
      return packageInfo.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      throw new Error(`Failed to remove directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install package dependencies using npm
   */
  private async installPackageDependencies(packagePath: string): Promise<void> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);

      if (!packageJsonExists) {
        logger.info('No package.json found, skipping dependency installation', { packagePath });
        return;
      }

      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check if there are dependencies to install
      const hasDependencies = packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;
      const hasDevDependencies = packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0;

      if (!hasDependencies && !hasDevDependencies) {
        logger.info('No dependencies to install', { packagePath });
        return;
      }

      logger.info('Installing package dependencies', {
        packagePath,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies
      });

      // Run npm install in the package directory
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        const { stdout, stderr } = await execAsync('npm install --production', {
          cwd: packagePath,
          timeout: 120000 // 2 minutes timeout
        });

        if (stdout) logger.info('npm install stdout', { stdout: stdout.substring(0, 500) });
        if (stderr) logger.warn('npm install stderr', { stderr: stderr.substring(0, 500) });

        logger.info('Dependencies installed successfully', { packagePath });
      } catch (execError: any) {
        logger.error('Failed to install dependencies', {
          error: execError,
          stdout: execError.stdout,
          stderr: execError.stderr
        });
        throw new Error(`Failed to install dependencies: ${execError.message}`);
      }
    } catch (error) {
      logger.error('Error in installPackageDependencies', { error, packagePath });
      throw error;
    }
  }
}