import { PrismaClient } from '@prisma/client';
import { SecureExecutionService } from '../../services/SecureExecutionService';

// Mock PrismaClient
const mockPrisma = {
  // Add any needed mock methods
} as unknown as PrismaClient;

describe('Isolated-VM Security Tests', () => {
  let secureExecutionService: SecureExecutionService;

  beforeEach(() => {
    secureExecutionService = new SecureExecutionService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Critical Security Features', () => {
    it('should prevent access to Node.js process object', async () => {
      const code = 'return typeof process;';
      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent require() function access', async () => {
      const code = 'return typeof require;';
      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent global object access', async () => {
      const code = 'return typeof global;';
      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent Buffer access', async () => {
      const code = 'return typeof Buffer;';
      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent filesystem path access', async () => {
      const codes = [
        'return typeof __dirname;',
        'return typeof __filename;'
      ];

      for (const code of codes) {
        const result = await secureExecutionService.executeInSandbox(code, {});
        expect(result).toBe('undefined');
      }
    });

    it('should prevent timer function access', async () => {
      const codes = [
        'return typeof setTimeout;',
        'return typeof setInterval;',
        'return typeof setImmediate;'
      ];

      for (const code of codes) {
        const result = await secureExecutionService.executeInSandbox(code, {});
        expect(result).toBe('undefined');
      }
    });

    it('should enforce execution timeout', async () => {
      const code = `
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // Infinite loop
        }
        return 'should not reach here';
      `;

      await expect(
        secureExecutionService.executeInSandbox(code, {}, { timeout: 1000 })
      ).rejects.toThrow('Script execution timed out');
    });

    it('should enforce memory limits', async () => {
      const code = `
        // Try to allocate a lot of memory
        const arrays = [];
        for (let i = 0; i < 1000; i++) {
          arrays.push(new Array(100000).fill('x'.repeat(1000)));
        }
        return arrays.length;
      `;

      await expect(
        secureExecutionService.executeInSandbox(code, {}, { memoryLimit: 8 * 1024 * 1024 }) // 8MB
      ).rejects.toThrow();
    });

    it('should prevent eval usage', async () => {
      const code = 'return eval("1 + 1");';
      
      await expect(
        secureExecutionService.executeInSandbox(code, {})
      ).rejects.toThrow();
    });

    it('should prevent Function constructor usage', async () => {
      const code = 'return new Function("return 1 + 1")();';
      
      await expect(
        secureExecutionService.executeInSandbox(code, {})
      ).rejects.toThrow();
    });

    it('should prevent prototype pollution', async () => {
      const code = `
        try {
          Object.prototype.polluted = 'yes';
          return 'pollution-attempted';
        } catch (e) {
          return 'pollution-blocked';
        }
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('pollution-attempted'); // Code runs but pollution is contained
      
      // Verify pollution didn't escape the sandbox
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should isolate execution contexts', async () => {
      // First execution sets a variable
      const code1 = `
        globalThis.testVar = 'first-execution';
        return globalThis.testVar;
      `;

      // Second execution should not see the variable
      const code2 = `
        return typeof globalThis.testVar;
      `;

      const result1 = await secureExecutionService.executeInSandbox(code1, {});
      const result2 = await secureExecutionService.executeInSandbox(code2, {});

      expect(result1).toBe('first-execution');
      expect(result2).toBe('undefined');
    });

    it('should prevent access to constructor functions', async () => {
      const code = `
        try {
          const obj = {};
          return obj.constructor.constructor('return process')();
        } catch (e) {
          return 'blocked';
        }
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('blocked');
    });

    it('should prevent access to import/export', async () => {
      const codes = [
        'import fs from "fs"; return "imported";',
        'const fs = await import("fs"); return "imported";'
      ];

      for (const code of codes) {
        await expect(
          secureExecutionService.executeInSandbox(code, {})
        ).rejects.toThrow();
      }
    });

    it('should handle errors securely', async () => {
      const code = `
        throw new Error('test error with sensitive info: ' + (typeof process));
      `;

      await expect(
        secureExecutionService.executeInSandbox(code, {})
      ).rejects.toThrow('test error with sensitive info: undefined');
    });

    it('should limit output size', async () => {
      const code = `
        return 'x'.repeat(10000); // 10KB string
      `;

      await expect(
        secureExecutionService.executeInSandbox(code, {}, { maxOutputSize: 1000 }) // 1KB limit
      ).rejects.toThrow('Output size limit exceeded');
    });

    it('should sanitize context values', async () => {
      const maliciousContext = {
        process: process, // Should be filtered out
        safeValue: 'allowed',
        dangerousFunction: () => 'dangerous',
        Buffer: Buffer // Should be filtered out
      };

      const code = `
        return {
          hasProcess: typeof process !== 'undefined',
          hasSafeValue: typeof safeValue !== 'undefined',
          hasDangerousFunction: typeof dangerousFunction !== 'undefined',
          hasBuffer: typeof Buffer !== 'undefined',
          safeValueContent: typeof safeValue !== 'undefined' ? safeValue : 'missing'
        };
      `;

      const result = await secureExecutionService.executeInSandbox(code, maliciousContext);
      
      expect(result.hasProcess).toBe(false);
      expect(result.hasSafeValue).toBe(true);
      expect(result.hasDangerousFunction).toBe(false);
      expect(result.hasBuffer).toBe(false);
      expect(result.safeValueContent).toBe('allowed');
    });

    it('should prevent WebAssembly usage', async () => {
      const code = `
        return typeof WebAssembly;
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent SharedArrayBuffer usage', async () => {
      const code = `
        return typeof SharedArrayBuffer;
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should prevent Atomics usage', async () => {
      const code = `
        return typeof Atomics;
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      expect(result).toBe('undefined');
    });

    it('should allow safe JavaScript features', async () => {
      const code = `
        // Test safe JavaScript features
        const obj = { a: 1, b: 2 };
        const arr = [1, 2, 3];
        const str = 'hello world';
        const num = 42;
        const bool = true;
        
        return {
          objectKeys: Object.keys(obj),
          arrayLength: arr.length,
          stringUpper: str.toUpperCase(),
          mathResult: Math.max(1, 2, 3),
          dateNow: typeof Date.now(),
          jsonStringify: typeof JSON.stringify,
          regexTest: /test/.test('testing')
        };
      `;

      const result = await secureExecutionService.executeInSandbox(code, {});
      
      expect(result.objectKeys).toEqual(['a', 'b']);
      expect(result.arrayLength).toBe(3);
      expect(result.stringUpper).toBe('HELLO WORLD');
      expect(result.mathResult).toBe(3);
      expect(result.dateNow).toBe('function');
      expect(result.jsonStringify).toBe('function');
      expect(result.regexTest).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should properly dispose of isolates', async () => {
      // This test ensures isolates are cleaned up properly
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          secureExecutionService.executeInSandbox(`return ${i};`, {})
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle concurrent executions', async () => {
      const code = `
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Short busy wait
        }
        return 'completed';
      `;

      const promises = Array(5).fill(0).map(() => 
        secureExecutionService.executeInSandbox(code, {})
      );

      const results = await Promise.all(promises);
      expect(results).toEqual(['completed', 'completed', 'completed', 'completed', 'completed']);
    });
  });
});
