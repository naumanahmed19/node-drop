import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

// Data validation rules for trigger data
interface DataValidationRules {
  maxSize?: number;
  allowedTypes?: string[];
  requiredFields?: string[];
  forbiddenFields?: string[];
}

// Trigger metadata interface
interface TriggerMetadata {
  executionId?: string;
  userId?: string;
  timestamp: string;
  source: "manual" | "api" | "webhook";
  ipAddress?: string;
  userAgent?: string;
}

// Enhanced trigger output interface
interface TriggerOutput {
  triggeredAt: string;
  triggerType: "manual";
  description: string;
  customData?: any;
  metadata: TriggerMetadata;
}

export const ManualTriggerNode: NodeDefinition = {
  identifier: "manual-trigger",
  displayName: "Manual Trigger",
  name: "manualTrigger",
  group: ["trigger"],
  nodeCategory: "trigger",
  triggerType: "manual",
  version: 1,
  description:
    "Triggers workflow execution manually when requested by the user",
  icon: "lucide:mouse-pointer-click",
  color: "#4CAF50",
  defaults: {
    description: "",
    allowCustomData: false,
    defaultData: "{}",
    validateData: true,
    maxDataSize: 1024 * 1024, // 1MB default
  },
  inputs: [],
  outputs: ["main"],
  properties: [
    {
      displayName: "Description",
      name: "description",
      type: "string",
      required: false,
      default: "",
      description: "Optional description for this manual trigger",
    },
    {
      displayName: "Allow Custom Data",
      name: "allowCustomData",
      type: "boolean",
      required: false,
      default: false,
      description:
        "Whether to allow custom data to be passed when triggering manually",
    },
    {
      displayName: "Default Data",
      name: "defaultData",
      type: "json",
      required: false,
      default: "{}",
      description: "Default data to use when no custom data is provided",
      displayOptions: {
        show: {
          allowCustomData: [true],
        },
      },
    },
    {
      displayName: "Validate Data",
      name: "validateData",
      type: "boolean",
      required: false,
      default: true,
      description: "Whether to validate trigger data for security",
      displayOptions: {
        show: {
          allowCustomData: [true],
        },
      },
    },
    {
      displayName: "Max Data Size (bytes)",
      name: "maxDataSize",
      type: "number",
      required: false,
      default: 1048576, // 1MB
      description: "Maximum size of trigger data in bytes",
      displayOptions: {
        show: {
          allowCustomData: [true],
          validateData: [true],
        },
      },
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    const description = await this.getNodeParameter("description") as string;
    const allowCustomData = await this.getNodeParameter("allowCustomData") as boolean;
    const defaultData = await this.getNodeParameter("defaultData") as string;
    const validateData = await this.getNodeParameter("validateData") as boolean;
    const maxDataSize = await this.getNodeParameter("maxDataSize") as number;

    // Create trigger metadata
    const metadata: TriggerMetadata = {
      timestamp: new Date().toISOString(),
      source: "manual",
    };

    // Get custom data from input or use default
    let customData: any = {};

    if (allowCustomData) {
      try {
        // First try to get data from the actual trigger input (passed from execution context)
        const triggerInput = inputData.main?.[0]?.[0];

        if (triggerInput && typeof triggerInput === "object") {
          // If we have actual trigger data, use it
          customData = triggerInput;
          this.logger.info("Manual trigger received custom data", {
            dataKeys: Object.keys(customData),
            dataSize: JSON.stringify(customData).length,
          });
        } else {
          // Fall back to default data
          customData = JSON.parse(defaultData || "{}");
          this.logger.info("Manual trigger using default data");
        }
      } catch (error) {
        this.logger.warn("Failed to parse trigger data, using empty object", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        customData = {};
      }

      // Validate trigger data if enabled
      if (validateData && this.validateTriggerData) {
        const validationResult = this.validateTriggerData(customData, {
          maxSize: maxDataSize,
          allowedTypes: ["object", "string", "number", "boolean", "array"],
          forbiddenFields: ["__proto__", "constructor", "prototype"],
        });

        if (!validationResult.isValid) {
          const errorMessage = `Trigger data validation failed: ${validationResult.errors.join(
            ", "
          )}`;
          this.logger.error("Manual trigger data validation failed", {
            errors: validationResult.errors,
            dataSize: JSON.stringify(customData).length,
          });
          throw new Error(errorMessage);
        }

        // Use sanitized data
        customData = validationResult.sanitizedData;
        this.logger.info("Manual trigger data validated successfully");
      } else if (validateData) {
        this.logger.warn(
          "Data validation requested but validateTriggerData method not available"
        );
      }
    }

    // Create trigger output
    const triggerOutput: TriggerOutput = {
      triggeredAt: new Date().toISOString(),
      triggerType: "manual",
      description: description || "Manual workflow trigger",
      customData: allowCustomData ? customData : undefined,
      metadata,
    };

    this.logger.info("Manual trigger executed successfully", {
      description,
      allowCustomData,
      hasCustomData: !!customData && Object.keys(customData).length > 0,
      triggerTime: triggerOutput.triggeredAt,
    });

    return [
      {
        main: [
          {
            json: triggerOutput,
          },
        ],
      },
    ];
  },
};

// Add validation method to the node execution context
declare module "../../types/node.types" {
  interface NodeExecutionContext {
    validateTriggerData?: (
      data: any,
      rules: DataValidationRules
    ) => {
      isValid: boolean;
      errors: string[];
      sanitizedData: any;
    };
  }
}

// Extend the execution context with validation method
const originalExecute = ManualTriggerNode.execute;
ManualTriggerNode.execute = async function (
  inputData: NodeInputData
): Promise<NodeOutputData[]> {
  // Add validation method to context
  this.validateTriggerData = (data: any, rules: DataValidationRules) => {
    const errors: string[] = [];
    let sanitizedData = data;

    try {
      // Check data size
      if (rules.maxSize) {
        const dataSize = JSON.stringify(data).length;
        if (dataSize > rules.maxSize) {
          errors.push(
            `Data size ${dataSize} bytes exceeds maximum ${rules.maxSize} bytes`
          );
        }
      }

      // Check data type
      if (rules.allowedTypes && !rules.allowedTypes.includes(typeof data)) {
        errors.push(
          `Data type '${typeof data}' is not allowed. Allowed types: ${rules.allowedTypes.join(
            ", "
          )}`
        );
      }

      // Check for forbidden fields (only check own properties, not inherited)
      if (rules.forbiddenFields && typeof data === "object" && data !== null) {
        const forbiddenFound = rules.forbiddenFields.filter((field) =>
          Object.prototype.hasOwnProperty.call(data, field)
        );
        if (forbiddenFound.length > 0) {
          errors.push(`Forbidden fields found: ${forbiddenFound.join(", ")}`);
        }

        // Sanitize by removing forbidden fields
        sanitizedData = { ...data };
        rules.forbiddenFields.forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(sanitizedData, field)) {
            delete sanitizedData[field];
          }
        });
      }

      // Check for required fields
      if (rules.requiredFields && typeof data === "object" && data !== null) {
        const missingFields = rules.requiredFields.filter(
          (field) => !(field in data)
        );
        if (missingFields.length > 0) {
          errors.push(`Required fields missing: ${missingFields.join(", ")}`);
        }
      }

      // Additional security checks
      if (typeof data === "object" && data !== null) {
        // Check for potential prototype pollution (only own properties)
        const dangerousKeys = ["__proto__", "constructor", "prototype"];
        const foundDangerous = Object.getOwnPropertyNames(data).filter((key) =>
          dangerousKeys.includes(key)
        );
        if (foundDangerous.length > 0) {
          errors.push(
            `Potentially dangerous keys found: ${foundDangerous.join(", ")}`
          );
        }

        // Recursively check nested objects (only own properties)
        const checkNestedObjects = (obj: any, path = ""): void => {
          if (typeof obj === "object" && obj !== null) {
            Object.getOwnPropertyNames(obj).forEach((key) => {
              const currentPath = path ? `${path}.${key}` : key;
              if (dangerousKeys.includes(key)) {
                errors.push(
                  `Dangerous key '${key}' found at path '${currentPath}'`
                );
              }
              if (typeof obj[key] === "object" && obj[key] !== null) {
                checkNestedObjects(obj[key], currentPath);
              }
            });
          }
        };

        checkNestedObjects(sanitizedData);
      }
    } catch (error) {
      errors.push(
        `Data validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData,
    };
  };

  // Call the original execute function
  return originalExecute.call(this, inputData);
};
