


import { PrismaClient } from "@prisma/client";
import {
  NodeDefinition,
  NodeExecutionContext,
  NodeExecutionResult,
  NodeInputData,
  NodeOutputData,
  NodeProperty,
  NodeRegistrationResult,
  NodeSchema,
  NodeTypeInfo,
  NodeValidationError,
  NodeValidationResult,
  StandardizedNodeOutput,
} from "../types/node.types";
import { NodeSettingsConfig } from "../types/settings.types";
import { logger } from "../utils/logger";
import {
  extractJsonData,
  normalizeInputItems,
  resolvePath,
  resolveValue,
  wrapJsonData,
} from "../utils/nodeHelpers";
import {
  SecureExecutionOptions,
  SecureExecutionService,
} from "./SecureExecutionService";

export class NodeService {
  private prisma: PrismaClient;
  private nodeRegistry = new Map<string, NodeDefinition>();
  private secureExecutionService: SecureExecutionService;
  private initializationPromise: Promise<void>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.secureExecutionService = new SecureExecutionService(prisma);
    this.initializationPromise = this.initializeBuiltInNodes();
  }

  /**
   * Wait for built-in nodes to be initialized
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  /**
   * Helper to resolve properties - handles both static arrays and dynamic functions
   */
  private resolveProperties(
    properties: NodeProperty[] | (() => NodeProperty[])
  ): NodeProperty[] {
    if (typeof properties === "function") {
      return properties();
    }
    return properties;
  }

  /**
   * Standardize node output data format for consistent frontend handling
   * All nodes should return data in this format for uniform processing
   */
  private standardizeNodeOutput(
    nodeType: string,
    outputs: NodeOutputData[],
    nodeDefinition?: NodeDefinition
  ): StandardizedNodeOutput {
    // Check if this is a multi-output node (like Loop with multiple outputs)
    const hasMultipleOutputs = nodeDefinition && nodeDefinition.outputs.length > 1;

    if (hasMultipleOutputs && nodeDefinition) {
      // Multi-output node: map array outputs to named branches
      const branches: Record<string, any[]> = {};
      let mainOutput: any[] = [];

      outputs.forEach((output, index) => {
        const outputName = nodeDefinition.outputs[index] || `output${index}`;
        const outputData = output.main || [];
        branches[outputName] = outputData;
        
        // Add to main output for backward compatibility
        mainOutput = mainOutput.concat(outputData);
      });

      return {
        main: mainOutput,
        branches,
        metadata: {
          nodeType,
          outputCount: outputs.length,
          hasMultipleBranches: true,
        },
      };
    }

    // Detect if this is a branching node by checking if outputs have named branches (not just "main")
    const hasMultipleBranches = outputs.some((output) => {
      const keys = Object.keys(output);
      return keys.some((key) => key !== "main");
    });

    // Handle branching nodes (IF, Switch, or any future branch-type nodes)
    if (hasMultipleBranches) {
      const branches: Record<string, any[]> = {};
      let mainOutput: any[] = [];

      // Extract branch data from node format: [{branchName1: [...]}, {branchName2: [...]}]
      outputs.forEach((output) => {
        Object.keys(output).forEach((branchName) => {
          if (branchName !== "main") {
            branches[branchName] = output[branchName] || [];
            // Also add to main output for backward compatibility
            mainOutput = mainOutput.concat(output[branchName] || []);
          }
        });
      });

      return {
        main: mainOutput,
        branches,
        metadata: {
          nodeType,
          outputCount: outputs.length,
          hasMultipleBranches: true,
        },
      };
    }

    // Handle standard nodes with main output: [{main: [{json: data}]}]
    const mainOutput: any[] = [];
    outputs.forEach((output) => {
      if (output.main) {
        mainOutput.push(...output.main);
      }
    });

    return {
      main: mainOutput,
      metadata: {
        nodeType,
        outputCount: outputs.length,
        hasMultipleBranches: false,
      },
    };
  }

  /**
   * Register a new node type
   */
  async registerNode(
    nodeDefinition: NodeDefinition
  ): Promise<NodeRegistrationResult> {
    try {
      // Validate node definition
      const validation = this.validateNodeDefinition(nodeDefinition);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Check if node type already exists
      const existingNode = await this.prisma.nodeType.findUnique({
        where: { type: nodeDefinition.type },
      });

      // Resolve properties before saving to database
      const resolvedProperties = this.resolveProperties(
        nodeDefinition.properties
      );

      if (existingNode) {
        // Update existing node but preserve the active status
        await this.prisma.nodeType.update({
          where: { type: nodeDefinition.type },
          data: {
            displayName: nodeDefinition.displayName,
            name: nodeDefinition.name,
            group: nodeDefinition.group,
            version: nodeDefinition.version,
            description: nodeDefinition.description,
            defaults: nodeDefinition.defaults as any,
            inputs: nodeDefinition.inputs,
            outputs: nodeDefinition.outputs,
            properties: resolvedProperties as any,
            icon: nodeDefinition.icon,
            color: nodeDefinition.color,
            outputComponent: nodeDefinition.outputComponent, // Save custom output component
            // Preserve existing active status instead of overriding to true
            active: existingNode.active,
          },
        });
      } else {
        // Create new node
        await this.prisma.nodeType.create({
          data: {
            type: nodeDefinition.type,
            displayName: nodeDefinition.displayName,
            name: nodeDefinition.name,
            group: nodeDefinition.group,
            version: nodeDefinition.version,
            description: nodeDefinition.description,
            defaults: nodeDefinition.defaults as any,
            inputs: nodeDefinition.inputs,
            outputs: nodeDefinition.outputs,
            properties: resolvedProperties as any,
            icon: nodeDefinition.icon,
            color: nodeDefinition.color,
            outputComponent: nodeDefinition.outputComponent, // Save custom output component
            active: true,
          },
        });
      }

      // Store in memory registry
      this.nodeRegistry.set(nodeDefinition.type, nodeDefinition);

      return {
        success: true,
        nodeType: nodeDefinition.type,
      };
    } catch (error) {
      logger.error("Failed to register node", {
        error,
        nodeType: nodeDefinition.type,
      });
      return {
        success: false,
        errors: [
          `Failed to register node: ${error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * Unregister a node type (sets inactive in database)
   */
  async unregisterNode(nodeType: string): Promise<void> {
    try {
      await this.prisma.nodeType.update({
        where: { type: nodeType },
        data: { active: false },
      });

      this.nodeRegistry.delete(nodeType);
      logger.info(`Node type unregistered: ${nodeType}`);
    } catch (error) {
      logger.error("Failed to unregister node", { error, nodeType });
      throw new Error(
        `Failed to unregister node: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Unload a node type from memory only (for package deletion)
   */
  async unloadNodeFromMemory(nodeType: string): Promise<void> {
    try {
      this.nodeRegistry.delete(nodeType);
      logger.info(`Node type unloaded from memory: ${nodeType}`);
    } catch (error) {
      logger.error("Failed to unload node from memory", { error, nodeType });
      throw new Error(
        `Failed to unload node from memory: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get all available node types from in-memory registry (live definitions)
   */
  async getNodeTypes(): Promise<NodeTypeInfo[]> {
    try {
      const nodeTypesFromRegistry: NodeTypeInfo[] = [];

      // First, get live node definitions from in-memory registry
      for (const [nodeType, nodeDefinition] of this.nodeRegistry.entries()) {
        nodeTypesFromRegistry.push({
          type: nodeDefinition.type,
          displayName: nodeDefinition.displayName,
          name: nodeDefinition.name,
          description: nodeDefinition.description,
          group: nodeDefinition.group,
          version: nodeDefinition.version,
          defaults: nodeDefinition.defaults || {},
          inputs: nodeDefinition.inputs,
          outputs: nodeDefinition.outputs,
          properties: this.resolveProperties(nodeDefinition.properties || []),
          credentials: nodeDefinition.credentials, // Include credentials
          credentialSelector: nodeDefinition.credentialSelector, // Include unified credential selector
          icon: nodeDefinition.icon,
          color: nodeDefinition.color,
          // Add execution metadata - use provided values or compute from group
          executionCapability:
            nodeDefinition.executionCapability ||
            this.getExecutionCapability(nodeDefinition),
          canExecuteIndividually:
            nodeDefinition.canExecuteIndividually ??
            this.canExecuteIndividually(nodeDefinition),
          canBeDisabled: nodeDefinition.canBeDisabled ?? true, // Default to true if not specified
        });
      }

      // If registry is empty, fallback to database (for built-in nodes that might be stored there)
      if (nodeTypesFromRegistry.length === 0) {
        logger.warn("Node registry is empty, falling back to database");
        const nodeTypes = await this.prisma.nodeType.findMany({
          where: { active: true },
          select: {
            type: true,
            displayName: true,
            name: true,
            description: true,
            group: true,
            version: true,
            defaults: true,
            inputs: true,
            outputs: true,
            properties: true,
            icon: true,
            color: true,
          },
          orderBy: { displayName: "asc" },
        });

        return nodeTypes.map((node) => ({
          ...node,
          icon: node.icon || undefined,
          color: node.color || undefined,
          properties: Array.isArray(node.properties)
            ? (node.properties as unknown as NodeProperty[])
            : [],
          defaults:
            typeof node.defaults === "object" && node.defaults !== null
              ? (node.defaults as Record<string, any>)
              : {},
          inputs: Array.isArray(node.inputs) ? node.inputs : ["main"],
          outputs: Array.isArray(node.outputs) ? node.outputs : ["main"],
        }));
      }

      // Sort by display name
      nodeTypesFromRegistry.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );

      logger.info(
        `Returning ${nodeTypesFromRegistry.length} node types from in-memory registry`
      );
      return nodeTypesFromRegistry;
    } catch (error) {
      logger.error("Failed to get node types", { error });
      throw new Error(
        `Failed to get node types: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get node schema by type from in-memory registry (live definition)
   */
  async getNodeSchema(nodeType: string): Promise<NodeSchema | null> {
    try {
      // Wait for built-in nodes to be initialized before accessing registry
      await this.waitForInitialization();

      // First, try to get from in-memory registry
      const nodeDefinition = this.nodeRegistry.get(nodeType);

      if (nodeDefinition) {
        return {
          type: nodeDefinition.type,
          displayName: nodeDefinition.displayName,
          name: nodeDefinition.name,
          group: nodeDefinition.group,
          version: nodeDefinition.version,
          description: nodeDefinition.description,
          defaults: nodeDefinition.defaults || {},
          inputs: nodeDefinition.inputs,
          outputs: nodeDefinition.outputs,
          properties: this.resolveProperties(nodeDefinition.properties || []),
          credentials: nodeDefinition.credentials, // Include credentials
          credentialSelector: nodeDefinition.credentialSelector, // Include unified credential selector
          icon: nodeDefinition.icon,
          color: nodeDefinition.color,
        };
      }

      // Fallback to database if not found in registry
      logger.warn(
        `Node type ${nodeType} not found in registry, checking database`
      );
      const node = await this.prisma.nodeType.findUnique({
        where: { type: nodeType, active: true },
      });

      if (!node) {
        return null;
      }

      return {
        type: node.type,
        displayName: node.displayName,
        name: node.name,
        group: node.group,
        version: node.version,
        description: node.description,
        defaults: node.defaults as Record<string, any>,
        inputs: node.inputs,
        outputs: node.outputs,
        properties: node.properties as unknown as NodeProperty[],
        icon: node.icon || undefined,
        color: node.color || undefined,
      };
    } catch (error) {
      logger.error("Failed to get node schema", { error, nodeType });
      throw new Error(
        `Failed to get node schema: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Execute a node securely
   */
  async executeNode(
    nodeType: string,
    parameters: Record<string, any>,
    inputData: NodeInputData,
    credentials?: Record<string, any>,
    executionId?: string,
    userId?: string,
    options?: SecureExecutionOptions,
    workflowId?: string,
    settings?: NodeSettingsConfig
  ): Promise<NodeExecutionResult> {
    const execId =
      executionId ||
      `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use provided userId or fallback to "system" for backward compatibility
    const executingUserId = userId || "system";

    try {
      // Wait for built-in nodes to be initialized before executing
      await this.waitForInitialization();

      const nodeDefinition = this.nodeRegistry.get(nodeType);
      if (!nodeDefinition) {
        throw new Error(`Node type not found: ${nodeType}`);
      }

      // Validate input data
      const inputValidation =
        this.secureExecutionService.validateInputData(inputData);
      if (!inputValidation.valid) {
        throw new Error(
          `Invalid input data: ${inputValidation.errors.join(", ")}`
        );
      }

      // Create secure execution context
      // credentials is already a mapping of type -> id (e.g., { "googleSheetsOAuth2": "cred_123" })
      const context = await this.secureExecutionService.createSecureContext(
        parameters,
        inputValidation.sanitizedData!,
        credentials || {},
        executingUserId,
        execId,
        options,
        workflowId,
        settings,
        options?.nodeId // Pass nodeId for state management
      );

      // Execute the node in secure context
      const result = await nodeDefinition.execute.call(
        context,
        inputValidation.sanitizedData!
      );

      // Validate output data
      const outputValidation =
        this.secureExecutionService.validateOutputData(result);
      if (!outputValidation.valid) {
        throw new Error(
          `Invalid output data: ${outputValidation.errors.join(", ")}`
        );
      }

      // Standardize the output format for consistent frontend handling
      const standardizedOutput = this.standardizeNodeOutput(
        nodeType,
        outputValidation.sanitizedData as NodeOutputData[],
        nodeDefinition
      );

      // Cleanup execution resources
      await this.secureExecutionService.cleanupExecution(execId);

      return {
        success: true,
        data: standardizedOutput,
      };
    } catch (error) {
      logger.error("Secure node execution failed", {
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
        nodeType,
        parameters,
        executionId: execId,
      });

      // Cleanup execution resources on error
      await this.secureExecutionService.cleanupExecution(execId);

      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Unknown execution error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Validate node definition
   */
  validateNodeDefinition(definition: NodeDefinition): NodeValidationResult {
    const errors: NodeValidationError[] = [];

    // Required fields validation
    if (!definition.type || typeof definition.type !== "string") {
      errors.push({
        property: "type",
        message: "Node type is required and must be a string",
      });
    }

    if (!definition.displayName || typeof definition.displayName !== "string") {
      errors.push({
        property: "displayName",
        message: "Display name is required and must be a string",
      });
    }

    if (!definition.name || typeof definition.name !== "string") {
      errors.push({
        property: "name",
        message: "Name is required and must be a string",
      });
    }

    if (!Array.isArray(definition.group) || definition.group.length === 0) {
      errors.push({
        property: "group",
        message: "Group is required and must be a non-empty array",
      });
    }

    if (typeof definition.version !== "number" || definition.version < 1) {
      errors.push({
        property: "version",
        message: "Version is required and must be a positive number",
      });
    }

    if (!definition.description || typeof definition.description !== "string") {
      errors.push({
        property: "description",
        message: "Description is required and must be a string",
      });
    }

    if (!Array.isArray(definition.inputs)) {
      errors.push({ property: "inputs", message: "Inputs must be an array" });
    }

    if (!Array.isArray(definition.outputs)) {
      errors.push({ property: "outputs", message: "Outputs must be an array" });
    }

    // Validate properties - can be an array or a function
    if (
      !definition.properties ||
      (!Array.isArray(definition.properties) &&
        typeof definition.properties !== "function")
    ) {
      errors.push({
        property: "properties",
        message:
          "Properties must be an array or a function that returns an array",
      });
    }

    if (typeof definition.execute !== "function") {
      errors.push({
        property: "execute",
        message: "Execute function is required",
      });
    }

    // Validate properties - resolve them first if they're a function
    const resolvedProperties = this.resolveProperties(definition.properties);
    if (Array.isArray(resolvedProperties)) {
      resolvedProperties.forEach((prop, index) => {
        const validation = this.validateNodeProperty(prop);
        if (!validation.valid) {
          validation.errors.forEach((error) => {
            errors.push({
              property: `properties[${index}].${error.property}`,
              message: error.message,
              value: error.value,
            });
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate node property
   */
  private validateNodeProperty(property: NodeProperty): NodeValidationResult {
    const errors: NodeValidationError[] = [];

    if (!property.displayName || typeof property.displayName !== "string") {
      errors.push({
        property: "displayName",
        message: "Property display name is required",
      });
    }

    if (!property.name || typeof property.name !== "string") {
      errors.push({ property: "name", message: "Property name is required" });
    }

    const validTypes = [
      "string",
      "number",
      "boolean",
      "options",
      "multiOptions",
      "json",
      "dateTime",
      "collection",
      "autocomplete", // Support for autocomplete fields
      "credential", // Support for credential selector fields
      "custom", // Support for custom components
      "conditionRow", // Support for condition row (key-expression-value)
    ];
    if (!validTypes.includes(property.type)) {
      errors.push({
        property: "type",
        message: `Property type must be one of: ${validTypes.join(", ")}`,
        value: property.type,
      });
    }

    // Validate options for option-based types
    if (
      (property.type === "options" || property.type === "multiOptions") &&
      !Array.isArray(property.options)
    ) {
      errors.push({
        property: "options",
        message: "Options are required for options/multiOptions type",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create execution context for node execution
   */
  private createExecutionContext(
    parameters: Record<string, any>,
    inputData: NodeInputData,
    credentials?: Record<string, any>
  ): NodeExecutionContext {
    return {
      getNodeParameter: (parameterName: string, itemIndex?: number) => {
        const value = parameters[parameterName];

        // Auto-resolve placeholders if value is a string with {{...}} patterns
        if (typeof value === "string" && value.includes("{{")) {
          // Normalize and extract input items
          const items = normalizeInputItems(inputData.main || []);
          const processedItems = extractJsonData(items);

          if (processedItems.length > 0) {
            // Use specified itemIndex or default to first item (0)
            const targetIndex = itemIndex ?? 0;
            const itemToUse = processedItems[targetIndex];

            if (itemToUse) {
              return resolveValue(value, itemToUse);
            }
          }
        }

        return value;
      },
      getCredentials: async (type: string) => {
        return credentials?.[type] || {};
      },
      getInputData: (inputName = "main") => {
        return inputData;
      },
      helpers: {
        request: async (options) => {
          // Basic HTTP request implementation
          const fetch = (await import("node-fetch")).default;
          const response = await fetch(options.url, {
            method: options.method || "GET",
            headers: options.headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });

          if (options.json !== false) {
            return response.json();
          }
          return response.text();
        },
        requestWithAuthentication: async (credentialType: string, options) => {
          // TODO: Implement authentication logic
          return this.createExecutionContext(
            parameters,
            inputData,
            credentials
          ).helpers.request(options);
        },
        returnJsonArray: (jsonData: any[]) => {
          return { main: jsonData };
        },
        normalizeItems: (items: any[]) => {
          return items.map((item) => ({ json: item }));
        },
      },
      logger: {
        debug: (message: string, extra?: any) => logger.debug(message, extra),
        info: (message: string, extra?: any) => logger.info(message, extra),
        warn: (message: string, extra?: any) => logger.warn(message, extra),
        error: (message: string, extra?: any) => logger.error(message, extra),
      },
      // Utility functions for common node operations
      resolveValue,
      resolvePath,
      extractJsonData,
      wrapJsonData,
      normalizeInputItems,
    };
  }

  /**
   * Initialize built-in nodes
   */
  private async initializeBuiltInNodes(): Promise<void> {
    try {
      // Register built-in nodes
      await this.registerBuiltInNodes();
      logger.info("Built-in nodes initialized");
    } catch (error) {
      logger.error("Failed to initialize built-in nodes", { error });

      // Don't throw the error - allow the application to start even if node registration fails
      // This prevents the entire application from failing to start due to node registration issues
    }
  }

  /**
   * Register all discovered nodes from the nodes directory
   */
  async registerDiscoveredNodes(): Promise<void> {
    try {
      await this.registerBuiltInNodes();
    } catch (error) {
      throw new Error(
        `Failed to register discovered nodes: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Register all built-in nodes using auto-discovery
   */
  private async registerBuiltInNodes(): Promise<void> {
    const { nodeDiscovery } = await import("../utils/NodeDiscovery");

    try {
      const nodeDefinitions = await nodeDiscovery.getAllNodeDefinitions();

      if (nodeDefinitions.length === 0) {
        return;
      }

      for (const nodeDefinition of nodeDefinitions) {
        try {
          await this.registerNode(nodeDefinition);
        } catch (error) {
          logger.error(`Error registering ${nodeDefinition.displayName}:`, error);
        }
      }
    } catch (error) {
      logger.error("Error during node discovery and registration:", error);
      throw error;
    }
  }

  /**
   * Activate a node type
   */
  async activateNode(
    nodeType: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const existingNode = await this.prisma.nodeType.findUnique({
        where: { type: nodeType },
      });

      if (!existingNode) {
        return {
          success: false,
          message: `Node type '${nodeType}' not found`,
        };
      }

      if (existingNode.active) {
        return {
          success: true,
          message: `Node type '${nodeType}' is already active`,
        };
      }

      await this.prisma.nodeType.update({
        where: { type: nodeType },
        data: { active: true, updatedAt: new Date() },
      });

      logger.info("Node type activated", { nodeType });
      return {
        success: true,
        message: `Node type '${nodeType}' activated successfully`,
      };
    } catch (error) {
      logger.error("Failed to activate node type", { error, nodeType });
      return {
        success: false,
        message: `Failed to activate node type: ${error instanceof Error ? error.message : "Unknown error"
          }`,
      };
    }
  }

  /**
   * Deactivate a node type
   */
  async deactivateNode(
    nodeType: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const existingNode = await this.prisma.nodeType.findUnique({
        where: { type: nodeType },
      });

      if (!existingNode) {
        return {
          success: false,
          message: `Node type '${nodeType}' not found`,
        };
      }

      if (!existingNode.active) {
        return {
          success: true,
          message: `Node type '${nodeType}' is already inactive`,
        };
      }

      await this.prisma.nodeType.update({
        where: { type: nodeType },
        data: { active: false, updatedAt: new Date() },
      });

      logger.info("Node type deactivated", { nodeType });
      return {
        success: true,
        message: `Node type '${nodeType}' deactivated successfully`,
      };
    } catch (error) {
      logger.error("Failed to deactivate node type", { error, nodeType });
      return {
        success: false,
        message: `Failed to deactivate node type: ${error instanceof Error ? error.message : "Unknown error"
          }`,
      };
    }
  }

  /**
   * Get all active node types
   */
  async getActiveNodes(): Promise<
    Array<{
      type: string;
      displayName: string;
      group: string[];
      description: string;
    }>
  > {
    try {
      const nodes = await this.prisma.nodeType.findMany({
        where: { active: true },
        select: {
          type: true,
          displayName: true,
          group: true,
          description: true,
        },
        orderBy: { displayName: "asc" },
      });

      return nodes;
    } catch (error) {
      logger.error("Failed to get active nodes", { error });
      return [];
    }
  }

  /**
   * Get all node types with their activation status
   */
  async getNodesWithStatus(): Promise<
    Array<{
      type: string;
      displayName: string;
      active: boolean;
      group: string[];
      description: string;
    }>
  > {
    try {
      const nodes = await this.prisma.nodeType.findMany({
        select: {
          type: true,
          displayName: true,
          active: true,
          group: true,
          description: true,
        },
        orderBy: [
          { active: "desc" }, // Active nodes first
          { displayName: "asc" }, // Then alphabetical
        ],
      });

      return nodes;
    } catch (error) {
      logger.error("Failed to get nodes with status", { error });
      return [];
    }
  }

  /**
   * Bulk activate/deactivate nodes
   */
  async bulkUpdateNodeStatus(
    nodeTypes: string[],
    active: boolean
  ): Promise<{ success: boolean; message: string; updated: number }> {
    try {
      const result = await this.prisma.nodeType.updateMany({
        where: {
          type: { in: nodeTypes },
        },
        data: {
          active,
          updatedAt: new Date(),
        },
      });

      const action = active ? "activated" : "deactivated";
      logger.info(`Bulk ${action} node types`, {
        nodeTypes,
        count: result.count,
      });

      return {
        success: true,
        message: `Successfully ${action} ${result.count} node(s)`,
        updated: result.count,
      };
    } catch (error) {
      logger.error("Failed to bulk update node status", {
        error,
        nodeTypes,
        active,
      });
      return {
        success: false,
        message: `Failed to update node status: ${error instanceof Error ? error.message : "Unknown error"
          }`,
        updated: 0,
      };
    }
  }

  /**
   * Determine execution capability based on node group
   */
  private getExecutionCapability(
    nodeDefinition: NodeDefinition
  ): "trigger" | "action" | "transform" | "condition" {
    const group = nodeDefinition.group;

    if (group.includes("trigger")) {
      return "trigger";
    } else if (group.includes("condition")) {
      return "condition";
    } else if (group.includes("transform")) {
      return "transform";
    } else {
      return "action";
    }
  }

  /**
   * Determine if node can execute individually (only trigger nodes)
   */
  private canExecuteIndividually(nodeDefinition: NodeDefinition): boolean {
    return nodeDefinition.group.includes("trigger");
  }

  /**
   * Refresh and register custom nodes from the custom-nodes directory
   */
  async refreshCustomNodes(): Promise<{ success: boolean; message: string; registered: number }> {
    try {
      const { nodeDiscovery } = await import("../utils/NodeDiscovery");
      const customNodeInfos = await nodeDiscovery.loadCustomNodes();
      
      let registered = 0;
      const errors: string[] = [];
      
      for (const nodeInfo of customNodeInfos) {
        try {
          const result = await this.registerNode(nodeInfo.definition);
          if (result.success) {
            registered++;
            logger.info("Registered custom node", {
              nodeType: nodeInfo.definition.type,
              displayName: nodeInfo.definition.displayName,
              path: nodeInfo.path,
            });
          } else {
            errors.push(`Failed to register ${nodeInfo.definition.type}: ${result.errors?.join(", ")}`);
          }
        } catch (error) {
          const errorMsg = `Failed to register ${nodeInfo.definition.type}: ${error instanceof Error ? error.message : "Unknown error"}`;
          errors.push(errorMsg);
          logger.warn(errorMsg, { error });
        }
      }
      
      const message = registered > 0 
        ? `Successfully registered ${registered} custom node(s)${errors.length > 0 ? ` (${errors.length} errors)` : ""}`
        : `No custom nodes registered${errors.length > 0 ? ` (${errors.length} errors)` : ""}`;
      
      logger.info("Custom nodes refresh completed", {
        registered,
        errors: errors.length,
        totalFound: customNodeInfos.length,
      });
      
      return {
        success: registered > 0 || errors.length === 0,
        message,
        registered,
      };
    } catch (error) {
      const errorMsg = `Failed to refresh custom nodes: ${error instanceof Error ? error.message : "Unknown error"}`;
      logger.error(errorMsg, { error });
      return {
        success: false,
        message: errorMsg,
        registered: 0,
      };
    }
  }

  /**
   * Load dynamic options for a node field
   */
  async loadNodeOptions(
    nodeType: string,
    method: string,
    parameters: Record<string, any> = {},
    credentials: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    data?: Array<{ name: string; value: any; description?: string }>;
    error?: { message: string };
  }> {
    try {
      const nodeDefinition = this.nodeRegistry.get(nodeType);

      if (!nodeDefinition) {
        return {
          success: false,
          error: { message: `Node type '${nodeType}' not found` },
        };
      }

      // Check if node has loadOptions methods
      if (
        !nodeDefinition.loadOptions ||
        typeof nodeDefinition.loadOptions !== "object"
      ) {
        return {
          success: false,
          error: {
            message: `Node '${nodeType}' does not support dynamic options loading`,
          },
        };
      }

      // Check if the specific method exists
      const loadOptionsMethod = (nodeDefinition.loadOptions as any)[method];
      if (typeof loadOptionsMethod !== "function") {
        return {
          success: false,
          error: {
            message: `Load options method '${method}' not found for node '${nodeType}'`,
          },
        };
      }

      // Build credential type mapping from node properties
      // Map credential field names to their types (e.g., "authentication" -> "postgresDb")
      const credentialTypeMap: Record<string, string> = {};
      if (nodeDefinition.properties) {
        const properties =
          typeof nodeDefinition.properties === "function"
            ? nodeDefinition.properties()
            : nodeDefinition.properties;

        for (const property of properties) {
          if (
            property.type === "credential" &&
            property.allowedTypes &&
            property.allowedTypes.length > 0
          ) {
            // Use the first allowed type as the credential type
            credentialTypeMap[property.name] = property.allowedTypes[0];
          }
        }
      }

      // Create execution context for loadOptions
      const context: any = {
        getNodeParameter: (paramName: string) => {
          return parameters[paramName];
        },
        getCredentials: async (credentialType: string) => {
          // Get credential service
          const credentialService = global.credentialService;
          if (!credentialService) {
            throw new Error("Credential service not initialized");
          }

          // Try to get credential ID from credentials object
          // First try by credential type directly
          let credentialId = credentials[credentialType];

          if (!credentialId) {
            // Look for field name that maps to this credential type
            for (const [fieldName, mappedType] of Object.entries(
              credentialTypeMap
            )) {
              if (mappedType === credentialType && credentials[fieldName]) {
                credentialId = credentials[fieldName];
                break;
              }
            }
          }

          // If still not found, check all credential fields and match by actual credential type
          if (!credentialId) {
            for (const [fieldName, value] of Object.entries(credentials)) {
              if (value && (typeof value === "string" || typeof value === "number")) {
                try {
                  const credential = await credentialService.getCredentialById(String(value));
                  if (credential && credential.type === credentialType) {
                    credentialId = value;
                    break;
                  }
                } catch (error) {
                  // Continue checking other fields
                }
              }
            }
          }

          if (credentialId) {
            if (
              typeof credentialId === "string" ||
              typeof credentialId === "number"
            ) {
              const credential = await credentialService.getCredentialById(
                String(credentialId)
              );
              if (credential) {
                return credential.data;
              }
            }
            // If it's already the data object, return it
            return credentialId;
          }

          return null;
        },
        logger: {
          info: (message: string, data?: any) => logger.info(message, data),
          error: (message: string, data?: any) => logger.error(message, data),
          warn: (message: string, data?: any) => logger.warn(message, data),
          debug: (message: string, data?: any) => logger.debug(message, data),
        },
      };

      // Execute the loadOptions method
      const options = await loadOptionsMethod.call(context);

      // Validate the returned options format
      if (!Array.isArray(options)) {
        return {
          success: false,
          error: {
            message: `Load options method '${method}' did not return an array`,
          },
        };
      }

      return {
        success: true,
        data: options,
      };
    } catch (error) {
      logger.error(
        `Failed to load options for node '${nodeType}', method '${method}'`,
        { error }
      );
      return {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Unknown error loading options",
        },
      };
    }
  }
}
