import { PrismaClient } from '@prisma/client';
import { SecureExecutionService } from '../../services/SecureExecutionService';
import { NodeInputData, NodeOutputData } from '../../types/node.types';

// Mock PrismaClient
const mockPrisma = {
  // Add any needed mock methods
} as unknown as PrismaClient;

describe('SecureExecutionService', () => {
  let secureExecutionService: SecureExecutionService;

  beforeEach(() => {
    secureExecutionService = new SecureExecutionService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeInSandbox', () => {
    it('should execute simple JavaScript code safely', async () => {
      const code = 'return 1 + 1;';
      const context = {};
      
      const result = await secureExecutionService.executeInSandbox(code, context);
      expect(result).toBe(2);
    });

    it('should prevent access to dangerous globals', async () => {
      const dangerousCodes = [
        { code: 'return typeof process;', expected: 'undefined' },
        { code: 'return typeof require;', expected: 'undefined' },
        { code: 'return typeof global;', expected: 'undefined' },
        { code: 'return typeof Buffer;', expected: 'undefined' },
        { code: 'return typeof __dirname;', expected: 'undefined' },
        { code: 'return typeof __filename;', expected: 'undefined' }
      ];

      for (const { code, expected } of dangerousCodes) {
        const result = await secureExecutionService.executeInSandbox(code, {});
        expect(result).toBe(expected);
      }
    });

    it('should prevent infinite loops with timeout', async () => {
      const code = 'while(true) {}';
      
      await expect(
        secureExecutionService.executeInSandbox(code, {}, { timeout: 1000 })
      ).rejects.toThrow();
    });

    it('should prevent eval usage', async () => {
      const code = 'return eval("1 + 1");';
      
      await expect(
        secureExecutionService.executeInSandbox(code, {})
      ).rejects.toThrow();
    });

    it('should prevent setTimeout/setInterval usage', async () => {
      const codes = [
        'setTimeout(() => {}, 1000);',
        'setInterval(() => {}, 1000);',
        'setImmediate(() => {});'
      ];

      for (const code of codes) {
        await expect(
          secureExecutionService.executeInSandbox(code, {})
        ).rejects.toThrow();
      }
    });

    it('should limit output size', async () => {
      const code = 'return "x".repeat(1000000);'; // 1MB string
      
      await expect(
        secureExecutionService.executeInSandbox(code, {}, { maxOutputSize: 1000 })
      ).rejects.toThrow('Output size limit exceeded');
    });

    it('should execute code without console access', async () => {
      const code = `
        return typeof console === 'undefined' ? 'no-console' : 'has-console';
      `;
      
      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('no-console');
    });
  });

  describe('validateInputData', () => {
    it('should validate correct input data', () => {
      const inputData: NodeInputData = {
        main: [[{ json: { test: 'value' } }]]
      };
      
      const result = secureExecutionService.validateInputData(inputData);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData).toEqual(inputData);
    });

    it('should reject non-object input', () => {
      const result = secureExecutionService.validateInputData(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input data must be an object');
    });

    it('should reject dangerous properties', () => {
      const inputData = {
        main: [[{ json: { test: 'value' } }]],
        __proto__: { malicious: true }
      } as any;
      
      const result = secureExecutionService.validateInputData(inputData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('__proto__'))).toBe(true);
    });

    it('should validate main input is array', () => {
      const inputData = {
        main: 'not an array'
      } as any;
      
      const result = secureExecutionService.validateInputData(inputData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Main input must be an array');
    });

    it('should sanitize nested dangerous properties', () => {
      const inputData = {
        main: [[{
          json: {
            test: 'value',
            nested: {
              __proto__: { malicious: true },
              safe: 'value'
            }
          }
        }]]
      } as any;
      
      const result = secureExecutionService.validateInputData(inputData);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData?.main[0][0].json.nested).not.toHaveProperty('__proto__');
      expect(result.sanitizedData?.main[0][0].json.nested.safe).toBe('value');
    });
  });

  describe('validateOutputData', () => {
    it('should validate correct output data', () => {
      const outputData: NodeOutputData[] = [
        { main: [{ json: { result: 'success' } }] }
      ];
      
      const result = secureExecutionService.validateOutputData(outputData);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData).toEqual(outputData);
    });

    it('should reject non-array output', () => {
      const result = secureExecutionService.validateOutputData('not an array' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output data must be an array');
    });

    it('should reject dangerous properties in output', () => {
      const outputData = [
        {
          main: [{ json: { result: 'success' } }],
          __proto__: { malicious: true }
        }
      ] as any;
      
      const result = secureExecutionService.validateOutputData(outputData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('__proto__'))).toBe(true);
    });

    it('should sanitize output data', () => {
      const outputData = [
        {
          main: [{
            json: {
              result: 'success',
              __proto__: { malicious: true }
            }
          }]
        }
      ] as any;
      
      const result = secureExecutionService.validateOutputData(outputData);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData?.[0].main[0].json).not.toHaveProperty('__proto__');
      expect(result.sanitizedData?.[0].main[0].json.result).toBe('success');
    });
  });

  describe('createSecureContext', () => {
    it('should create secure execution context', async () => {
      const parameters = { testParam: 'value' };
      const inputData: NodeInputData = { main: [[{ json: { test: 'data' } }]] };
      const credentials = { apiKey: 'secret' };
      const executionId = 'test-exec-123';
      
      const context = await secureExecutionService.createSecureContext(
        parameters,
        inputData,
        credentials,
        executionId
      );
      
      expect(context).toHaveProperty('getNodeParameter');
      expect(context).toHaveProperty('getCredentials');
      expect(context).toHaveProperty('getInputData');
      expect(context).toHaveProperty('helpers');
      expect(context).toHaveProperty('logger');
    });

    it('should sanitize parameter access', async () => {
      const parameters = {
        safe: 'value',
        __proto__: { malicious: true }
      } as any;
      const inputData: NodeInputData = { main: [[]] };
      
      const context = await secureExecutionService.createSecureContext(
        parameters,
        inputData,
        {},
        'test-exec'
      );
      
      expect(context.getNodeParameter('safe')).toBe('value');
      expect(context.getNodeParameter('__proto__')).toBeUndefined();
    });

    it('should validate parameter name type', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec'
      );
      
      expect(() => context.getNodeParameter(123 as any)).toThrow('Parameter name must be a string');
    });

    it('should validate credential type', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec'
      );
      
      await expect(context.getCredentials(123 as any)).rejects.toThrow('Credential type must be a string');
    });
  });

  describe('HTTP request security', () => {
    it('should block dangerous URLs', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec'
      );
      
      const dangerousUrls = [
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://192.168.1.1',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'ftp://example.com',
        'file:///etc/passwd'
      ];
      
      for (const url of dangerousUrls) {
        await expect(
          context.helpers.request({ url })
        ).rejects.toThrow('URL is not allowed');
      }
    });

    it('should limit concurrent requests', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec',
        { maxConcurrentRequests: 2 }
      );
      
      // Mock fetch to simulate slow requests
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        }), 1000))
      );
      
      try {
        // Start 3 concurrent requests (should fail on the 3rd)
        const requests = [
          context.helpers.request({ url: 'https://api.example.com/1' }),
          context.helpers.request({ url: 'https://api.example.com/2' }),
          context.helpers.request({ url: 'https://api.example.com/3' })
        ];
        
        await expect(Promise.all(requests)).rejects.toThrow('Maximum concurrent requests exceeded');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should sanitize request headers', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec'
      );
      
      // Mock fetch to capture request
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      global.fetch = mockFetch;
      
      try {
        await context.helpers.request({
          url: 'https://api.example.com',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
            'X-Custom-Header': 'value',
            'Dangerous-Header': 'should-be-removed'
          }
        });
        
        const callArgs = mockFetch.mock.calls[0][1];
        const headers = callArgs.headers;
        
        expect(headers).toHaveProperty('Content-Type');
        expect(headers).toHaveProperty('Authorization');
        expect(headers).toHaveProperty('X-Custom-Header');
        expect(headers).not.toHaveProperty('Dangerous-Header');
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('should enforce request timeout', async () => {
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        'test-exec',
        { maxRequestTimeout: 100 }
      );
      
      // Mock fetch to simulate slow response
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      try {
        await expect(
          context.helpers.request({ url: 'https://slow-api.example.com' })
        ).rejects.toThrow();
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe('Resource limits', () => {
    it('should enforce memory limits', async () => {
      const code = `
        const largeArray = new Array(1000000).fill('x'.repeat(1000));
        return largeArray;
      `;
      
      await expect(
        secureExecutionService.executeInSandbox(code, {}, { memoryLimit: 8 * 1024 * 1024 }) // 8MB minimum
      ).rejects.toThrow();
    });

    it('should enforce execution timeout', async () => {
      const code = `
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // Busy wait for 5 seconds
        }
        return 'completed';
      `;
      
      await expect(
        secureExecutionService.executeInSandbox(code, {}, { timeout: 1000 }) // 1 second
      ).rejects.toThrow();
    });
  });

  describe('Credential security', () => {
    it('should sanitize credentials for logging', async () => {
      const credentials = {
        username: 'user',
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123',
        safe_field: 'visible'
      };
      
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        { testCred: credentials },
        'test-exec'
      );
      
      const result = await context.getCredentials('testCred');
      
      // Should contain sanitized markers for sensitive fields
      expect(result).toHaveProperty('password_sanitized', '[REDACTED]');
      expect(result).toHaveProperty('safe_field', 'visible');
    });
  });

  describe('Deep sanitization', () => {
    it('should remove dangerous properties at all levels', () => {
      const maliciousData = {
        safe: 'value',
        __proto__: { malicious: true },
        nested: {
          also_safe: 'value',
          constructor: { malicious: true },
          deep: {
            prototype: { malicious: true },
            normal: 'value'
          }
        },
        array: [
          { __proto__: { malicious: true }, safe: 'value' },
          'string',
          123,
          { nested: { constructor: { malicious: true } } }
        ]
      };
      
      const result = secureExecutionService.validateInputData({ main: [[maliciousData]] });
      
      expect(result.valid).toBe(true);
      const sanitized = result.sanitizedData?.main[0][0];
      
      expect(sanitized).toHaveProperty('safe', 'value');
      expect(sanitized).not.toHaveProperty('__proto__');
      expect(sanitized.nested).toHaveProperty('also_safe', 'value');
      expect(sanitized.nested).not.toHaveProperty('constructor');
      expect(sanitized.nested.deep).toHaveProperty('normal', 'value');
      expect(sanitized.nested.deep).not.toHaveProperty('prototype');
      expect(sanitized.array[0]).toHaveProperty('safe', 'value');
      expect(sanitized.array[0]).not.toHaveProperty('__proto__');
      expect(sanitized.array[3].nested).not.toHaveProperty('constructor');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup execution resources', async () => {
      const executionId = 'test-cleanup-123';
      
      // Create context and make some requests to track resources
      const context = await secureExecutionService.createSecureContext(
        {},
        { main: [[]] },
        {},
        executionId
      );
      
      // Cleanup should not throw
      await expect(
        secureExecutionService.cleanupExecution(executionId)
      ).resolves.not.toThrow();
    });
  });
});
