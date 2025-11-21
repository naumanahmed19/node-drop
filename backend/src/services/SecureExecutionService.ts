import { PrismaClient } from "@prisma/client";
import ivm from "isolated-vm";
import {
  NodeExecutionContext,
  NodeHelpers,
  NodeInputData,
  NodeLogger,
  NodeOutputData,
  RequestOptions,
} from "../types/node.types";
import { logger } from "../utils/logger";
import {
  extractJsonData,
  normalizeInputItems,
  resolvePath,
  resolveValue,
  wrapJsonData,
} from "../utils/nodeHelpers";
import { CredentialService } from "./CredentialService";

import { VariableService } from "./VariableService";

export interface SecureExecutionOptions {
  timeout?: number;
  memoryLimit?: number;
  allowedModules?: string[];
  maxOutputSize?: number;
  maxRequestTimeout?: number;
  maxConcurrentRequests?: number;
  nodeId?: string; // For state management in stateful nodes
}

export interface CredentialData {
  [key: string]: any;
}

export interface ExecutionLimits {
  timeout: number;
  memoryLimit: number;
  maxOutputSize: number;
  maxRequestTimeout: number;
  maxConcurrentRequests: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export class SecureExecutionService {
  private prisma: PrismaClient;
  private credentialService: CredentialService;
  private variableService: VariableService;
  private defaultLimits: ExecutionLimits;
  private activeRequests: Map<string, number>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.credentialService = new CredentialService();
    this.variableService = new VariableService();
    this.activeRequests = new Map();

    // Set default security limits
    this.defaultLimits = {
      timeout: 30000, // 30 seconds
      memoryLimit: 128 * 1024 * 1024, // 128MB
      maxOutputSize: 10 * 1024 * 1024, // 10MB
      maxRequestTimeout: 30000, // 30 seconds
      maxConcurrentRequests: 5,
    };
  }

  /**
   * Execute JavaScript code in a secure isolated-vm sandbox
   */
  async executeInSandbox(
    code: string,
    context: Record<string, any>,
    options: SecureExecutionOptions = {}
  ): Promise<any> {
    const limits = this.mergeLimits(options);
    let isolate: ivm.Isolate | null = null;

    try {
      // Create isolated VM with memory limit
      isolate = new ivm.Isolate({
        memoryLimit: Math.floor(limits.memoryLimit / (1024 * 1024)), // Convert to MB
        inspector: false, // Disable debugging
      });

      // Create context within the isolate
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      // Note: Console is not available in the sandbox for security

      // Add context variables securely
      for (const [key, value] of Object.entries(context)) {
        if (this.isSafeContextValue(key, value)) {
          await jail.set(key, new ivm.ExternalCopy(value).copyInto());
        }
      }

      // Wrap code to return result and handle errors
      const wrappedCode = `
        (function() {
          try {
            const result = (function() {
              ${code}
            })();
            return { success: true, result: result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })()
      `;

      // Compile and run the script with timeout
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(vmContext, {
        timeout: limits.timeout,
        copy: true,
      });

      // Check if execution was successful
      if (!result.success) {
        throw new Error(result.error || "Script execution failed");
      }

      // Validate output size
      const outputSize = this.calculateObjectSize(result.result);
      if (outputSize > limits.maxOutputSize) {
        throw new Error(`Output size limit exceeded: ${outputSize} bytes`);
      }

      return result.result;
    } catch (error) {
      logger.error("Sandbox execution failed:", error);
      throw new Error(
        `Sandbox execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      // Clean up isolate
      if (isolate) {
        isolate.dispose();
      }
    }
  }

  /**
   * Create secure execution context with credential injection
   */
  // Store node state per execution
  private nodeStates: Map<string, Record<string, any>> = new Map();

  async createSecureContext(
    parameters: Record<string, any>,
    inputData: NodeInputData,
    credentialIds: string[] | Record<string, string> = [],
    userId: string,
    executionId: string,
    options: SecureExecutionOptions = {},
    workflowId?: string,
    settings?: Record<string, any>,
    nodeId?: string
  ): Promise<NodeExecutionContext> {
    const limits = this.mergeLimits(options);
    
    // Create state key for this node in this execution
    const stateKey = nodeId ? `${executionId}:${nodeId}` : executionId;

    // Helper function to recursively resolve parameters (including nested objects/arrays)
    const resolveParameterValue = async (value: any): Promise<any> => {
      if (typeof value === "string" && (value.includes("$vars") || value.includes("$local"))) {
        try {
          let resolvedValue = await this.variableService.replaceVariablesInText(
            value,
            userId,
            workflowId
          );

          // Unwrap simple {{value}} patterns
          const wrappedMatch = resolvedValue.match(/^\{\{(.+)\}\}$/);
          if (wrappedMatch) {
            const innerContent = wrappedMatch[1].trim();
            const hasExpressionSyntax =
              /[+\-*%()[\]<>=!&|]/.test(innerContent) ||
              innerContent.includes("{{") ||
              innerContent.includes("json.") ||
              innerContent.includes("$item") ||
              innerContent.includes("$node") ||
              innerContent.includes("$workflow");

            if (!hasExpressionSyntax) {
              resolvedValue = innerContent;
            }
          }

          return resolvedValue;
        } catch (error) {
          logger.warn("Failed to resolve variables in parameter value", {
            originalValue: value,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return value;
        }
      } else if (Array.isArray(value)) {
        // Recursively resolve array elements
        return Promise.all(value.map(item => resolveParameterValue(item)));
      } else if (value && typeof value === "object" && value.constructor === Object) {
        // Recursively resolve object properties
        const resolved: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
          resolved[k] = await resolveParameterValue(v);
        }
        return resolved;
      }
      return value;
    };

    // Pre-resolve all variables in parameters before creating context (including nested)
    const resolvedParameters: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      resolvedParameters[key] = await resolveParameterValue(value);
    }

    // Convert credentialIds to a mapping object if it's an array
    const credentialsMapping: Record<string, string> = Array.isArray(
      credentialIds
    )
      ? {} // Empty mapping if array (legacy format)
      : credentialIds; // Use the mapping directly

    return {
      settings: settings || {}, // Node settings from Settings tab
      getNodeParameter: (parameterName: string, itemIndex?: number) => {
        // Validate parameter access
        if (typeof parameterName !== "string") {
          throw new Error("Parameter name must be a string");
        }

        let value = resolvedParameters[parameterName];
        value = this.sanitizeValue(value);

        // Also unwrap simple {{value}} patterns even without variables
        // This handles cases where variables were already resolved: {{https://...}} -> https://...
        if (
          typeof value === "string" &&
          !value.includes("$vars") &&
          !value.includes("$local")
        ) {
          const wrappedMatch = value.match(/^\{\{(.+)\}\}$/);
          if (wrappedMatch) {
            const innerContent = wrappedMatch[1].trim();
            // Check for nodeDrop expression syntax patterns (but not URL slashes)
            const hasExpressionSyntax =
              /[+\-*%()[\]<>=!&|]/.test(innerContent) ||
              innerContent.includes("{{") ||
              innerContent.includes("json.") ||
              innerContent.includes("$item") ||
              innerContent.includes("$node") ||
              innerContent.includes("$workflow");

            if (!hasExpressionSyntax) {
              logger.info("Unwrapping simple wrapped value (non-variable)", {
                parameterName,
                before: value,
                after: innerContent,
              });
              value = innerContent;
            }
          }
        }

        // Helper function to recursively resolve expressions in nested structures
        const resolveExpressions = (val: any, itemData: any): any => {
          if (typeof val === "string" && val.includes("{{")) {
            return resolveValue(val, itemData);
          } else if (Array.isArray(val)) {
            return val.map(item => resolveExpressions(item, itemData));
          } else if (val && typeof val === "object" && val.constructor === Object) {
            const resolved: Record<string, any> = {};
            for (const [k, v] of Object.entries(val)) {
              resolved[k] = resolveExpressions(v, itemData);
            }
            return resolved;
          }
          return val;
        };

        // Auto-resolve placeholders if value contains {{...}} patterns (recursively)
        // This now runs AFTER variable resolution
        const items = normalizeInputItems(inputData.main || []);
        const processedItems = extractJsonData(items);

        if (processedItems.length > 0) {
          // Use specified itemIndex or default to first item (0)
          const targetIndex = itemIndex ?? 0;
          const itemToUse = processedItems[targetIndex];

          if (itemToUse) {
            return resolveExpressions(value, itemToUse);
          }
        }

        return value;
      },

      getCredentials: async (type: string) => {
        // Validate credential type
        if (typeof type !== "string") {
          throw new Error("Credential type must be a string");
        }

        // Use the credentials mapping to find the credential ID for this type
        const credentialId = credentialsMapping[type];
        if (!credentialId) {
          logger.error(`No credential found for type '${type}'`, {
            requestedType: type,
            availableCredentials: Object.keys(credentialsMapping),
          });
          throw new Error(`No credential of type '${type}' available`);
        }

        // Inject credentials securely
        const credential = await this.injectCredentials(
          credentialId,
          userId,
          executionId
        );
        return this.sanitizeCredentials(credential);
      },

      getInputData: (inputName = "main") => {
        // Validate and sanitize input data
        const validation = this.validateInputData(inputData);
        if (!validation.valid) {
          throw new Error(
            `Invalid input data: ${validation.errors.join(", ")}`
          );
        }

        // Return data for the specified input name
        const sanitizedData = validation.sanitizedData as any;
        if (inputName && inputName !== "main" && sanitizedData[inputName]) {
          return { [inputName]: sanitizedData[inputName] };
        }

        return validation.sanitizedData;
      },

      helpers: this.createSecureHelpers(
        limits,
        executionId,
        Array.isArray(credentialIds)
          ? credentialIds
          : Object.values(credentialsMapping),
        userId
      ),
      logger: this.createSecureLogger(executionId),
      // Expose userId for service nodes that need to fetch credentials
      userId,
      // Utility functions for common node operations
      resolveValue,
      resolvePath,
      extractJsonData,
      wrapJsonData,
      normalizeInputItems,
      // State management for stateful nodes
      getNodeState: () => {
        return this.nodeStates.get(stateKey) || {};
      },
      setNodeState: (state: Record<string, any>) => {
        this.nodeStates.set(stateKey, state);
      },
    };
  }

  /**
   * Validate input data
   */
  public validateInputData(inputData: NodeInputData): ValidationResult {
    const errors: string[] = [];

    try {
      // Check if inputData is an object
      if (!inputData || typeof inputData !== "object") {
        errors.push("Input data must be an object");
        return { valid: false, errors };
      }

      // Validate main input
      if (inputData.main && !Array.isArray(inputData.main)) {
        errors.push("Main input must be an array");
      }

      // Check for dangerous properties
      const dangerousProps = ["__proto__", "constructor", "prototype"];
      for (const prop of dangerousProps) {
        if (Object.prototype.hasOwnProperty.call(inputData, prop)) {
          errors.push(`Dangerous property detected: ${prop}`);
        }
      }

      // Sanitize data
      const sanitizedData = this.deepSanitize(inputData);

      return {
        valid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? sanitizedData : undefined,
      };
    } catch (error) {
      errors.push(
        `Validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return { valid: false, errors };
    }
  }

  /**
   * Validate output data
   */
  public validateOutputData(outputData: NodeOutputData[]): ValidationResult {
    const errors: string[] = [];

    try {
      if (!Array.isArray(outputData)) {
        errors.push("Output data must be an array");
        return { valid: false, errors };
      }

      // Validate each output item
      for (let i = 0; i < outputData.length; i++) {
        const item = outputData[i];

        if (!item || typeof item !== "object") {
          errors.push(`Output item ${i} must be an object`);
          continue;
        }

        // Check for dangerous properties
        const dangerousProps = ["__proto__", "constructor", "prototype"];
        for (const prop of dangerousProps) {
          if (Object.prototype.hasOwnProperty.call(item, prop)) {
            errors.push(
              `Dangerous property detected in output item ${i}: ${prop}`
            );
          }
        }
      }

      // Sanitize output data
      const sanitizedData = this.deepSanitize(outputData);

      return {
        valid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? sanitizedData : undefined,
      };
    } catch (error) {
      errors.push(
        `Output validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return { valid: false, errors };
    }
  }

  /**
   * Inject credentials securely
   */
  private async injectCredentials(
    credentialId: string,
    userId: string,
    executionId: string
  ): Promise<any> {
    try {
      // Log credential access for audit
      logger.info(`Credential access: ${credentialId}`, {
        executionId,
        credentialId,
        userId,
      });

      // Get credential from secure storage using CredentialService
      const credentialData =
        await this.credentialService.getCredentialForExecution(
          credentialId,
          userId
        );

      // Check if this is an OAuth credential that might need token refresh
      if (this.isOAuthCredential(credentialData)) {
        // Check if token needs refresh
        if (this.shouldRefreshToken(credentialData)) {
          logger.info(`Token refresh needed for credential ${credentialId}`);
          
          try {
            // Attempt to refresh the token
            const refreshedData = await this.refreshOAuthToken(
              credentialId,
              userId,
              credentialData
            );
            
            if (refreshedData) {
              logger.info(`Token refreshed successfully for credential ${credentialId}`);
              return refreshedData;
            }
          } catch (refreshError) {
            logger.warn(`Token refresh failed for credential ${credentialId}, using existing token`, {
              error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
            });
            // Continue with existing token if refresh fails
          }
        }
      }

      return credentialData;
    } catch (error) {
      logger.error("Credential injection failed:", {
        error,
        credentialId,
        executionId,
      });
      throw new Error(
        `Failed to inject credentials: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if credential is OAuth-based
   */
  private isOAuthCredential(credentialData: any): boolean {
    return !!(
      credentialData.accessToken &&
      credentialData.refreshToken &&
      credentialData.clientId &&
      credentialData.clientSecret
    );
  }

  /**
   * Check if OAuth token needs refresh (expired or expiring soon)
   */
  private shouldRefreshToken(credentialData: any): boolean {
    if (!credentialData.tokenObtainedAt || !credentialData.expiresIn) {
      return false; // Can't determine, assume valid
    }

    const obtainedAt = new Date(credentialData.tokenObtainedAt);
    const expiresAt = new Date(obtainedAt.getTime() + credentialData.expiresIn * 1000);
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes buffer

    return expiresAt <= bufferTime;
  }

  /**
   * Refresh OAuth token
   */
  private async refreshOAuthToken(
    credentialId: string,
    userId: string,
    credentialData: any
  ): Promise<any> {
    try {
      // Get the full credential from database to access the type
      const credential = await this.credentialService.getCredential(
        credentialId,
        userId
      );
      
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      // Get credential type to find OAuth provider
      const credentialType = this.credentialService.getCredentialType(credential.type);
      if (!credentialType || !credentialType.oauthProvider) {
        throw new Error(`Credential type ${credential.type} is not an OAuth credential`);
      }

      // Get OAuth provider from registry
      const { oauthProviderRegistry } = require('../oauth');
      const oauthProvider = oauthProviderRegistry.get(credentialType.oauthProvider);
      
      if (!oauthProvider) {
        throw new Error(`OAuth provider ${credentialType.oauthProvider} not found`);
      }

      if (!oauthProvider.refreshAccessToken) {
        throw new Error(`OAuth provider ${credentialType.oauthProvider} does not support token refresh`);
      }

      // Refresh the token using the provider
      const tokens = await oauthProvider.refreshAccessToken({
        refreshToken: credentialData.refreshToken,
        clientId: credentialData.clientId,
        clientSecret: credentialData.clientSecret,
      });

      // Update credential in database
      await this.credentialService.updateCredential(credentialId, userId, {
        data: {
          ...credentialData,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || credentialData.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenObtainedAt: new Date().toISOString(),
        },
      });

      // Return updated credential data
      return {
        ...credentialData,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || credentialData.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenObtainedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to refresh OAuth token:', error);
      throw error;
    }
  }

  /**
   * Extract OAuth provider from credential type
   * Examples:
   * - "googleOAuth2" -> "google"
   * - "githubOAuth2" -> "github"
   * - "microsoftOAuth2" -> "microsoft"
   * - "slackOAuth2" -> "slack"
   */
  private extractProviderFromType(credentialType: string): string {
    // Remove "OAuth2" suffix and convert to lowercase
    const provider = credentialType
      .replace(/OAuth2$/i, '')
      .replace(/OAuth$/i, '')
      .toLowerCase();
    
    // Handle special cases
    if (provider === 'googlesheets' || provider === 'googledrive') {
      return 'google';
    }
    
    return provider;
  }

  /**
   * Create secure helpers with resource limits
   */
  private createSecureHelpers(
    limits: ExecutionLimits,
    executionId: string,
    credentialIds: string[] = [],
    userId: string
  ): NodeHelpers {
    return {
      request: async (options: RequestOptions) => {
        return this.makeSecureRequest(options, limits, executionId);
      },

      requestWithAuthentication: async (
        credentialType: string,
        options: RequestOptions
      ) => {
        // Find credential for the requested type
        // This is a simplified implementation - in practice, you'd need to map credential types to IDs
        const credentialId = credentialIds[0]; // Simplified - use first available credential
        if (!credentialId) {
          throw new Error(
            `No credential available for type: ${credentialType}`
          );
        }

        try {
          const credentialData =
            await this.credentialService.getCredentialForExecution(
              credentialId,
              userId
            );

          // Apply authentication to request based on credential type
          const authenticatedOptions = this.applyAuthentication(
            options,
            credentialType,
            credentialData
          );
          return this.makeSecureRequest(
            authenticatedOptions,
            limits,
            executionId
          );
        } catch (error) {
          logger.error("Authenticated request failed:", {
            error,
            credentialType,
            executionId,
          });
          throw new Error(
            `Authentication failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      },

      returnJsonArray: (jsonData: any[]) => {
        if (!Array.isArray(jsonData)) {
          throw new Error("Data must be an array");
        }

        const sanitized = this.deepSanitize(jsonData);
        return { main: sanitized };
      },

      normalizeItems: (items: any[]) => {
        if (!Array.isArray(items)) {
          throw new Error("Items must be an array");
        }

        return items.map((item) => ({ json: this.sanitizeValue(item) }));
      },
    };
  }

  /**
   * Make secure HTTP request with limits
   */
  private async makeSecureRequest(
    options: RequestOptions,
    limits: ExecutionLimits,
    executionId: string
  ): Promise<any> {
    // Check concurrent request limit
    const currentRequests = this.activeRequests.get(executionId) || 0;
    if (currentRequests >= limits.maxConcurrentRequests) {
      throw new Error(
        `Maximum concurrent requests exceeded: ${limits.maxConcurrentRequests}`
      );
    }

    // Validate URL
    if (!options.url || typeof options.url !== "string") {
      throw new Error("URL is required and must be a string");
    }

    // Block dangerous URLs
    if (this.isDangerousUrl(options.url)) {
      throw new Error("URL is not allowed");
    }

    // Increment active request counter
    this.activeRequests.set(executionId, currentRequests + 1);

    try {
      const fetch = (await import("node-fetch")).default;
      const controller = new AbortController();

      // Set timeout
      const timeout = Math.min(
        options.timeout || limits.maxRequestTimeout,
        limits.maxRequestTimeout
      );
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(options.url, {
        method: options.method || "GET",
        headers: this.sanitizeHeaders(options.headers || {}),
        body: options.body
          ? JSON.stringify(this.sanitizeValue(options.body))
          : undefined,
        signal: controller.signal,
        follow: options.followRedirect !== false ? 10 : 0,
        size: limits.maxOutputSize, // Limit response size
      });

      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok && !options.ignoreHttpStatusErrors) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse response
      let result;
      if (options.json !== false) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      // Validate response size
      const responseSize = this.calculateObjectSize(result);
      if (responseSize > limits.maxOutputSize) {
        throw new Error(`Response size limit exceeded: ${responseSize} bytes`);
      }

      return this.sanitizeValue(result);
    } catch (error) {
      logger.error("Secure request failed:", {
        error,
        url: options.url,
        executionId,
      });
      throw error;
    } finally {
      // Decrement active request counter
      const currentRequests = this.activeRequests.get(executionId) || 0;
      this.activeRequests.set(executionId, Math.max(0, currentRequests - 1));
    }
  }

  /**
   * Create secure logger
   */
  private createSecureLogger(executionId: string): NodeLogger {
    return {
      executionId, // Expose execution ID for service node event emission
      debug: (message: string, extra?: any) => {
        logger.debug(`[${executionId}] ${message}`, this.sanitizeValue(extra));
      },
      info: (message: string, extra?: any) => {
        logger.info(`[${executionId}] ${message}`, this.sanitizeValue(extra));
      },
      warn: (message: string, extra?: any) => {
        logger.warn(`[${executionId}] ${message}`, this.sanitizeValue(extra));
      },
      error: (message: string, extra?: any) => {
        logger.error(`[${executionId}] ${message}`, this.sanitizeValue(extra));
      },
    };
  }

  /**
   * Create secure console for VM sandbox
   */
  private createSecureConsole() {
    return {
      log: (...args: any[]) => {
        // Sandbox console.log - disabled for cleaner output
      },
      error: (...args: any[]) => {
        logger.error(
          "Sandbox console.error:",
          args.map((arg) => this.sanitizeValue(arg))
        );
      },
      warn: (...args: any[]) => {
        logger.warn(
          "Sandbox console.warn:",
          args.map((arg) => this.sanitizeValue(arg))
        );
      },
      info: (...args: any[]) => {
        // Sandbox console.info - disabled for cleaner output
      },
    };
  }

  /**
   * Deep sanitize object to remove dangerous properties
   */
  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (
      typeof obj === "string" ||
      typeof obj === "number" ||
      typeof obj === "boolean"
    ) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepSanitize(item));
    }

    if (typeof obj === "object") {
      const sanitized: any = {};
      const dangerousProps = ["__proto__", "constructor", "prototype"];

      for (const [key, value] of Object.entries(obj)) {
        if (!dangerousProps.includes(key)) {
          sanitized[key] = this.deepSanitize(value);
        }
      }

      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize a single value
   */
  private sanitizeValue(value: any): any {
    return this.deepSanitize(value);
  }

  /**
   * Sanitize credentials
   */
  private sanitizeCredentials(credentials: any): any {
    if (!credentials || typeof credentials !== "object") {
      return credentials;
    }

    // Remove sensitive fields that shouldn't be exposed
    const sensitiveFields = ["password", "secret", "key", "token", "private"];
    const sanitized = { ...credentials };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        // Keep the credential but mark it as sanitized for logging
        sanitized[`${field}_sanitized`] = "[REDACTED]";
      }
    }

    return this.deepSanitize(sanitized);
  }

  /**
   * Sanitize HTTP headers
   */
  private sanitizeHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      "content-type",
      "accept",
      "user-agent",
      "authorization",
      "x-api-key",
      "x-custom-header",
    ];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (allowedHeaders.includes(lowerKey) || lowerKey.startsWith("x-")) {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Check if URL is dangerous
   */
  private isDangerousUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Block local/private networks
      const hostname = parsedUrl.hostname.toLowerCase();
      const dangerousHosts = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "10.",
        "172.16.",
        "172.17.",
        "172.18.",
        "172.19.",
        "172.20.",
        "172.21.",
        "172.22.",
        "172.23.",
        "172.24.",
        "172.25.",
        "172.26.",
        "172.27.",
        "172.28.",
        "172.29.",
        "172.30.",
        "172.31.",
        "192.168.",
      ];

      for (const dangerous of dangerousHosts) {
        if (hostname === dangerous || hostname.startsWith(dangerous)) {
          return true;
        }
      }

      // Block non-HTTP protocols
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return true;
      }

      return false;
    } catch {
      return true; // Invalid URL is dangerous
    }
  }

  /**
   * Calculate approximate object size in bytes
   */
  private calculateObjectSize(obj: any): number {
    try {
      const jsonString = JSON.stringify(obj);
      if (jsonString === undefined) {
        return 0;
      }
      return Buffer.byteLength(jsonString, "utf8");
    } catch (error) {
      // If JSON.stringify fails, estimate size
      return String(obj).length * 2; // Rough estimate for UTF-8
    }
  }

  /**
   * Merge execution limits with defaults
   */
  private mergeLimits(options: SecureExecutionOptions): ExecutionLimits {
    return {
      timeout: options.timeout || this.defaultLimits.timeout,
      memoryLimit: options.memoryLimit || this.defaultLimits.memoryLimit,
      maxOutputSize: options.maxOutputSize || this.defaultLimits.maxOutputSize,
      maxRequestTimeout:
        options.maxRequestTimeout || this.defaultLimits.maxRequestTimeout,
      maxConcurrentRequests:
        options.maxConcurrentRequests ||
        this.defaultLimits.maxConcurrentRequests,
    };
  }

  /**
   * Check if a context value is safe to pass to the sandbox
   */
  private isSafeContextValue(key: string, value: any): boolean {
    // Block dangerous keys
    const dangerousKeys = [
      "process",
      "global",
      "require",
      "Buffer",
      "__dirname",
      "__filename",
      "setTimeout",
      "setInterval",
      "setImmediate",
      "clearTimeout",
      "clearInterval",
    ];

    if (dangerousKeys.includes(key)) {
      return false;
    }

    // Only allow primitive types and plain objects
    const type = typeof value;
    if (type === "function") {
      return false;
    }

    if (type === "object" && value !== null) {
      // Check for dangerous object types
      if (value instanceof Buffer || value instanceof Function) {
        return false;
      }

      // Only allow plain objects and arrays
      const constructor = value.constructor;
      if (constructor !== Object && constructor !== Array) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup resources for execution
   */
  async cleanupExecution(executionId: string): Promise<void> {
    this.activeRequests.delete(executionId);
  }

  /**
   * Apply authentication to request options based on credential type
   */
  private applyAuthentication(
    options: RequestOptions,
    credentialType: string,
    credentialData: any
  ): RequestOptions {
    const authenticatedOptions = { ...options };
    authenticatedOptions.headers = { ...options.headers };

    switch (credentialType) {
      case "httpBasicAuth":
        if (credentialData.username && credentialData.password) {
          const auth = Buffer.from(
            `${credentialData.username}:${credentialData.password}`
          ).toString("base64");
          authenticatedOptions.headers["Authorization"] = `Basic ${auth}`;
        }
        break;

      case "apiKey":
        if (credentialData.apiKey) {
          const headerName = credentialData.headerName || "Authorization";
          authenticatedOptions.headers[headerName] = credentialData.apiKey;
        }
        break;

      case "oauth2":
        if (credentialData.accessToken) {
          authenticatedOptions.headers[
            "Authorization"
          ] = `Bearer ${credentialData.accessToken}`;
        }
        break;

      default:
        throw new Error(
          `Unsupported credential type for authentication: ${credentialType}`
        );
    }

    return authenticatedOptions;
  }
}
