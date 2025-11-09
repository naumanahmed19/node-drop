import { z } from "zod";

// Common schemas
export const IdParamSchema = z.object({
  id: z
    .string()
    .min(1, "ID is required")
    .regex(
      /^(c[a-z0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
      "Invalid ID format"
    ),
});

export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Workflow schemas
export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(255),
  description: z.string().optional(),
  category: z
    .string()
    .nullish()
    .transform((val) => val || undefined),
  tags: z.array(z.string()).default([]),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.any()),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
        credentials: z.array(z.string()).optional(),
        disabled: z.boolean().default(false),
        mockData: z.any().optional(),
        mockDataPinned: z.boolean().optional(),
        locked: z.boolean().optional(),
        settings: z.record(z.any()).optional(), // Node-level settings
        // Group node properties
        parentId: z.string().optional(),
        extent: z
          .union([
            z.literal("parent"),
            z.tuple([z.number(), z.number(), z.number(), z.number()]),
          ])
          .optional(),
        style: z
          .object({
            width: z.number().optional(),
            height: z.number().optional(),
            backgroundColor: z.string().optional(),
          })
          .passthrough() // Allow additional style properties
          .optional(),
      })
    )
    .default([]),
  connections: z
    .array(
      z.object({
        id: z.string(),
        sourceNodeId: z.string(),
        sourceOutput: z.string(),
        targetNodeId: z.string(),
        targetInput: z.string(),
      })
    )
    .default([]),
  triggers: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        nodeId: z.string(),
        settings: z.record(z.any()),
      })
    )
    .default([]),
  settings: z
    .object({
      timezone: z.string().optional(),
      saveExecutionProgress: z.boolean().default(true),
      saveDataErrorExecution: z.enum(["all", "none"]).default("all"),
      saveDataSuccessExecution: z.enum(["all", "none"]).default("all"),
      saveExecutionToDatabase: z.boolean().default(true), // Skip saving executions to database
      callerPolicy: z
        .enum(["workflowsFromSameOwner", "workflowsFromAList", "any"])
        .default("workflowsFromSameOwner"),
    })
    .default({}),
  active: z.boolean().default(false),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

export const WorkflowQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  userId: z.string().uuid().optional(),
});

// Execution schemas
export const ExecuteWorkflowSchema = z.object({
  triggerData: z.record(z.any()).optional(),
  startNodes: z.array(z.string()).optional(),
  // Optional workflow data to avoid requiring database save
  workflowData: z
    .object({
      nodes: z.array(z.any()).optional(),
      connections: z.array(z.any()).optional(),
      settings: z.any().optional(),
    })
    .optional(),
});

export const ExecutionQuerySchema = PaginationQuerySchema.extend({
  workflowId: z.string().cuid().optional(),
  status: z.enum(["RUNNING", "SUCCESS", "ERROR", "CANCELLED"]).optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
});

// Node schemas
export const NodeQuerySchema = PaginationQuerySchema.extend({
  category: z.string().optional(),
  search: z.string().optional(),
});

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

// Response types
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  warnings?: Array<{
    type: string;
    message: string;
    details?: any;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowRequest = z.infer<typeof UpdateWorkflowSchema>;
export type WorkflowQueryRequest = z.infer<typeof WorkflowQuerySchema>;
export type ExecuteWorkflowRequest = z.infer<typeof ExecuteWorkflowSchema>;
export type ExecutionQueryRequest = z.infer<typeof ExecutionQuerySchema>;
export type NodeQueryRequest = z.infer<typeof NodeQuerySchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;
