import { logger } from '../logger';

export interface ResourceUsage {
  memoryUsed: number;
  executionTime: number;
  networkRequests: number;
  dataTransferred: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  maxNetworkRequests: number;
  maxDataTransferMB: number;
  maxResponseSizeMB: number;
}

export class ResourceLimitsEnforcer {
  private static readonly DEFAULT_LIMITS: ResourceLimits = {
    maxMemoryMB: 512,
    maxExecutionTimeMs: 30000,
    maxNetworkRequests: 10,
    maxDataTransferMB: 50,
    maxResponseSizeMB: 10
  };

  private static executionTracking = new Map<string, ResourceUsage>();

  /**
   * Initialize resource tracking for an execution
   */
  public static initializeTracking(executionId: string): void {
    this.executionTracking.set(executionId, {
      memoryUsed: 0,
      executionTime: 0,
      networkRequests: 0,
      dataTransferred: 0
    });
  }

  /**
   * Track network request
   */
  public static trackNetworkRequest(executionId: string, dataSize: number): void {
    const usage = this.executionTracking.get(executionId);
    if (usage) {
      usage.networkRequests += 1;
      usage.dataTransferred += dataSize;
      this.executionTracking.set(executionId, usage);
    }
  }

  /**
   * Enforce timeout limit with proper cleanup
   */
  public static enforceTimeoutLimit<T>(
    operation: Promise<T>,
    timeout: number,
    executionId?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Validate request size limits
   */
  public static validateRequestSize(
    bodySize: number,
    limits: Partial<ResourceLimits> = {}
  ): { isValid: boolean; error?: string } {
    const effectiveLimits = { ...this.DEFAULT_LIMITS, ...limits };
    const maxBodySizeMB = effectiveLimits.maxDataTransferMB;
    const maxBodySizeBytes = maxBodySizeMB * 1024 * 1024;

    if (bodySize > maxBodySizeBytes) {
      return {
        isValid: false,
        error: `Request body size (${Math.round(bodySize / 1024 / 1024)}MB) exceeds limit (${maxBodySizeMB}MB)`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate response size limits
   */
  public static validateResponseSize(
    responseSize: number,
    limits: Partial<ResourceLimits> = {}
  ): { isValid: boolean; error?: string } {
    const effectiveLimits = { ...this.DEFAULT_LIMITS, ...limits };
    const maxResponseSizeMB = effectiveLimits.maxResponseSizeMB;
    const maxResponseSizeBytes = maxResponseSizeMB * 1024 * 1024;

    if (responseSize > maxResponseSizeBytes) {
      return {
        isValid: false,
        error: `Response size (${Math.round(responseSize / 1024 / 1024)}MB) exceeds limit (${maxResponseSizeMB}MB)`
      };
    }

    return { isValid: true };
  }

  /**
   * Check network request limits
   */
  public static checkNetworkLimits(
    executionId: string,
    limits: Partial<ResourceLimits> = {}
  ): { isValid: boolean; error?: string } {
    const usage = this.executionTracking.get(executionId);
    if (!usage) {
      return { isValid: true };
    }

    const effectiveLimits = { ...this.DEFAULT_LIMITS, ...limits };

    if (usage.networkRequests >= effectiveLimits.maxNetworkRequests) {
      return {
        isValid: false,
        error: `Network request limit exceeded (${usage.networkRequests}/${effectiveLimits.maxNetworkRequests})`
      };
    }

    const dataTransferredMB = usage.dataTransferred / 1024 / 1024;
    if (dataTransferredMB >= effectiveLimits.maxDataTransferMB) {
      return {
        isValid: false,
        error: `Data transfer limit exceeded (${Math.round(dataTransferredMB)}MB/${effectiveLimits.maxDataTransferMB}MB)`
      };
    }

    return { isValid: true };
  }

  /**
   * Get current resource usage
   */
  public static getResourceUsage(executionId: string): ResourceUsage | null {
    return this.executionTracking.get(executionId) || null;
  }

  /**
   * Cleanup tracking for an execution
   */
  public static cleanupTracking(executionId: string): void {
    this.executionTracking.delete(executionId);
  }

  /**
   * Get memory usage in MB
   */
  public static getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * Check memory limits
   */
  public static checkMemoryLimits(limits: Partial<ResourceLimits> = {}): { isValid: boolean; error?: string } {
    const effectiveLimits = { ...this.DEFAULT_LIMITS, ...limits };
    const currentMemoryMB = this.getMemoryUsageMB();

    if (currentMemoryMB > effectiveLimits.maxMemoryMB) {
      return {
        isValid: false,
        error: `Memory usage (${currentMemoryMB}MB) exceeds limit (${effectiveLimits.maxMemoryMB}MB)`
      };
    }

    return { isValid: true };
  }
}
