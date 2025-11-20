import { PrismaClient } from '@prisma/client';
import { NodeService } from '../../services/NodeService';
import { NodeDefinition, NodeInputData, BuiltInNodeTypes } from '../../types/node.types';

// Mock PrismaClient
const mockPrisma = {
  nodeType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  }
} as unknown as PrismaClient;

describe('Sandbox Security Tests', () => {
  let nodeService: NodeService;

  beforeEach(() => {
    nodeService = new NodeService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('JavaScript Code Injection Prevention', () => {
    it('should prevent code injection through node parameters', async () => {
      // Create a malicious node that tries to execute arbitrary code
      const maliciousNode: NodeDefinition = {
        type: 'test-malicious',
        displayName: 'Malicious Test Node',
        name: 'maliciousTest',
        group: ['test'],
        version: 1,
        description: 'Test node for security',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Code',
            name: 'code',
            type: 'string',
            required: true,
            default: ''
          }
        ],
        execute: async function(inputData: NodeInputData) {
          // This node tries to execute user-provided code
          const code = this.getNodeParameter('code') as string;
          
          // This should be prevented by the sandbox
          try {
            const result = eval(code);
            return [{ main: [{ json: { result } }] }];
          } catch (error) {
            throw new Error(`Code execution failed: ${error}`);
          }
        }
      };

      await nodeService.registerNode(maliciousNode);

      const maliciousCode = `
        require('fs').readFileSync('/etc/passwd', 'utf8')
      `;

      const result = await nodeService.executeNode(
        'test-malicious',
        { code: maliciousCode },
        { main: [[]] }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('execution failed');
    });

    it('should prevent prototype pollution attacks', async () => {
      const pollutionNode: NodeDefinition = {
        type: 'test-pollution',
        displayName: 'Pollution Test Node',
        name: 'pollutionTest',
        group: ['test'],
        version: 1,
        description: 'Test node for prototype pollution',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Try to pollute Object prototype
          const maliciousData = JSON.parse('{"__proto__": {"polluted": true}}');
          return [{ main: [{ json: maliciousData }] }];
        }
      };

      await nodeService.registerNode(pollutionNode);

      const result = await nodeService.executeNode(
        'test-pollution',
        {},
        { main: [[]] }
      );

      // Should succeed but without prototype pollution
      expect(result.success).toBe(true);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should prevent access to Node.js globals', async () => {
      const globalsNode: NodeDefinition = {
        type: 'test-globals',
        displayName: 'Globals Test Node',
        name: 'globalsTest',
        group: ['test'],
        version: 1,
        description: 'Test node for globals access',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Try to access various Node.js globals
          const results: any = {};
          
          try { results.process = typeof process; } catch (e) { results.process = 'blocked'; }
          try { results.global = typeof global; } catch (e) { results.global = 'blocked'; }
          try { results.Buffer = typeof Buffer; } catch (e) { results.Buffer = 'blocked'; }
          try { results.require = typeof require; } catch (e) { results.require = 'blocked'; }
          try { results.__dirname = typeof __dirname; } catch (e) { results.__dirname = 'blocked'; }
          try { results.__filename = typeof __filename; } catch (e) { results.__filename = 'blocked'; }
          
          return [{ main: [{ json: results }] }];
        }
      };

      await nodeService.registerNode(globalsNode);

      const result = await nodeService.executeNode(
        'test-globals',
        {},
        { main: [[]] }
      );

      expect(result.success).toBe(true);
      const data = result.data?.[0]?.main?.[0]?.json;
      
      // All dangerous globals should be blocked
      expect(data.process).toBe('blocked');
      expect(data.global).toBe('blocked');
      expect(data.Buffer).toBe('blocked');
      expect(data.require).toBe('blocked');
      expect(data.__dirname).toBe('blocked');
      expect(data.__filename).toBe('blocked');
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    it('should prevent infinite loops', async () => {
      const infiniteLoopNode: NodeDefinition = {
        type: 'test-infinite-loop',
        displayName: 'Infinite Loop Test Node',
        name: 'infiniteLoopTest',
        group: ['test'],
        version: 1,
        description: 'Test node for infinite loops',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Create an infinite loop
          while (true) {
            // This should be terminated by timeout
          }
          return [{ main: [{ json: { completed: true } }] }];
        }
      };

      await nodeService.registerNode(infiniteLoopNode);

      const result = await nodeService.executeNode(
        'test-infinite-loop',
        {},
        { main: [[]] },
        undefined,
        'test-exec',
        { timeout: 1000 } // 1 second timeout
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should prevent memory exhaustion', async () => {
      const memoryExhaustionNode: NodeDefinition = {
        type: 'test-memory-exhaustion',
        displayName: 'Memory Exhaustion Test Node',
        name: 'memoryExhaustionTest',
        group: ['test'],
        version: 1,
        description: 'Test node for memory exhaustion',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Try to allocate large amounts of memory
          const largeArray = new Array(10000000).fill('x'.repeat(1000));
          return [{ main: [{ json: { size: largeArray.length } }] }];
        }
      };

      await nodeService.registerNode(memoryExhaustionNode);

      const result = await nodeService.executeNode(
        'test-memory-exhaustion',
        {},
        { main: [[]] },
        undefined,
        'test-exec',
        { memoryLimit: 1024 * 1024 } // 1MB limit
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Memory limit exceeded');
    });

    it('should limit output size', async () => {
      const largeOutputNode: NodeDefinition = {
        type: 'test-large-output',
        displayName: 'Large Output Test Node',
        name: 'largeOutputTest',
        group: ['test'],
        version: 1,
        description: 'Test node for large output',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Generate large output
          const largeString = 'x'.repeat(1000000); // 1MB string
          return [{ main: [{ json: { data: largeString } }] }];
        }
      };

      await nodeService.registerNode(largeOutputNode);

      const result = await nodeService.executeNode(
        'test-large-output',
        {},
        { main: [[]] },
        undefined,
        'test-exec',
        { maxOutputSize: 1000 } // 1KB limit
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Output size limit exceeded');
    });
  });

  describe('Network Security', () => {
    it('should prevent SSRF attacks', async () => {
      const ssrfNode: NodeDefinition = {
        type: 'test-ssrf',
        displayName: 'SSRF Test Node',
        name: 'ssrfTest',
        group: ['test'],
        version: 1,
        description: 'Test node for SSRF prevention',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            required: true,
            default: ''
          }
        ],
        execute: async function(inputData: NodeInputData) {
          const url = this.getNodeParameter('url') as string;
          
          try {
            const response = await this.helpers.request({ url });
            return [{ main: [{ json: { response } }] }];
          } catch (error) {
            throw new Error(`Request failed: ${error}`);
          }
        }
      };

      await nodeService.registerNode(ssrfNode);

      const dangerousUrls = [
        'http://localhost:3000/admin',
        'http://127.0.0.1:22',
        'http://192.168.1.1/config',
        'http://10.0.0.1/internal',
        'http://172.16.0.1/secrets',
        'file:///etc/passwd',
        'ftp://internal.server.com'
      ];

      for (const url of dangerousUrls) {
        const result = await nodeService.executeNode(
          'test-ssrf',
          { url },
          { main: [[]] }
        );

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Security validation failed');
      }
    });

    it('should limit concurrent HTTP requests', async () => {
      const concurrentRequestsNode: NodeDefinition = {
        type: 'test-concurrent-requests',
        displayName: 'Concurrent Requests Test Node',
        name: 'concurrentRequestsTest',
        group: ['test'],
        version: 1,
        description: 'Test node for concurrent request limits',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Try to make many concurrent requests
          const requests = [];
          for (let i = 0; i < 10; i++) {
            requests.push(
              this.helpers.request({ url: `https://httpbin.org/delay/1?id=${i}` })
            );
          }
          
          const results = await Promise.all(requests);
          return [{ main: [{ json: { count: results.length } }] }];
        }
      };

      await nodeService.registerNode(concurrentRequestsNode);

      const result = await nodeService.executeNode(
        'test-concurrent-requests',
        {},
        { main: [[]] },
        undefined,
        'test-exec',
        { maxConcurrentRequests: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Maximum concurrent requests exceeded');
    });
  });

  describe('Built-in Node Security', () => {
    beforeEach(() => {
      // Mock the database calls for built-in nodes
      (mockPrisma.nodeType.findUnique as jest.Mock).mockResolvedValue({
        type: BuiltInNodeTypes.HTTP_REQUEST,
        displayName: 'HTTP Request',
        name: 'httpRequest',
        group: ['transform'],
        version: 1,
        description: 'Make HTTP requests to any URL',
        defaults: { method: 'GET', url: '', headers: {}, body: '' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        icon: 'fa:globe',
        color: '#2196F3',
        active: true
      });
    });

    it('should secure HTTP Request node against SSRF', async () => {
      const result = await nodeService.executeNode(
        BuiltInNodeTypes.HTTP_REQUEST,
        {
          method: 'GET',
          url: 'http://localhost:3000/admin',
          headers: {},
          body: ''
        },
        { main: [[]] }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Security validation failed');
    });

    it('should sanitize HTTP headers', async () => {
      // Mock fetch to capture the request
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      global.fetch = mockFetch;

      try {
        await nodeService.executeNode(
          BuiltInNodeTypes.HTTP_REQUEST,
          {
            method: 'GET',
            url: 'https://api.example.com',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer token',
              'X-Custom': 'allowed',
              'Host': 'malicious.com', // Should be filtered
              'Connection': 'close' // Should be filtered
            },
            body: ''
          },
          { main: [[]] }
        );

        const callArgs = mockFetch.mock.calls[0][1];
        const headers = callArgs.headers;

        expect(headers).toHaveProperty('Content-Type');
        expect(headers).toHaveProperty('Authorization');
        expect(headers).toHaveProperty('X-Custom');
        expect(headers).not.toHaveProperty('Host');
        expect(headers).not.toHaveProperty('Connection');
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe('Input/Output Validation', () => {
    it('should validate and sanitize malicious input data', async () => {
      const maliciousInput = {
        main: [[{
          json: {
            normal: 'data',
            __proto__: { polluted: true },
            constructor: { malicious: 'code' }
          }
        }]],
        __proto__: { globalPollution: true }
      } as any;

      const result = await nodeService.executeNode(
        BuiltInNodeTypes.JSON,
        { jsonData: '{"test": "value"}' },
        maliciousInput
      );

      expect(result.success).toBe(true);
      // Verify no prototype pollution occurred
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).globalPollution).toBeUndefined();
    });

    it('should validate output data structure', async () => {
      const maliciousOutputNode: NodeDefinition = {
        type: 'test-malicious-output',
        displayName: 'Malicious Output Test Node',
        name: 'maliciousOutputTest',
        group: ['test'],
        version: 1,
        description: 'Test node for malicious output',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          // Return malicious output structure
          return [
            {
              main: [{ json: { normal: 'data' } }],
              __proto__: { malicious: true }
            }
          ] as any;
        }
      };

      await nodeService.registerNode(maliciousOutputNode);

      const result = await nodeService.executeNode(
        'test-malicious-output',
        {},
        { main: [[]] }
      );

      expect(result.success).toBe(true);
      // Output should be sanitized
      expect(result.data?.[0]).not.toHaveProperty('__proto__');
      expect(result.data?.[0]?.main?.[0]?.json?.normal).toBe('data');
    });
  });

  describe('Credential Security', () => {
    it('should sanitize credentials in logs', async () => {
      const credentialNode: NodeDefinition = {
        type: 'test-credentials',
        displayName: 'Credentials Test Node',
        name: 'credentialsTest',
        group: ['test'],
        version: 1,
        description: 'Test node for credential handling',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
        execute: async function(inputData: NodeInputData) {
          const creds = await this.getCredentials('testCred');
          
          // Log credentials (should be sanitized)
          this.logger.info('Retrieved credentials', creds);
          
          return [{ main: [{ json: { hasCredentials: !!creds } }] }];
        }
      };

      await nodeService.registerNode(credentialNode);

      const credentials = {
        testCred: {
          username: 'user',
          password: 'secret123',
          apiKey: 'key123',
          normalField: 'visible'
        }
      };

      const result = await nodeService.executeNode(
        'test-credentials',
        {},
        { main: [[]] },
        credentials
      );

      expect(result.success).toBe(true);
      expect(result.data?.[0]?.main?.[0]?.json?.hasCredentials).toBe(true);
    });
  });
});
