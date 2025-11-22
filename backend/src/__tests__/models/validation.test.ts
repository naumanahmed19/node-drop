import {
  userCreateSchema,
  userUpdateSchema,
  workflowCreateSchema,
  workflowUpdateSchema,
  nodeSchema,
  connectionSchema,
  triggerSchema,
  validateWorkflowStructure,
} from '../../utils/validation'
import { UserRole } from '../../types/database'

describe('User Validation', () => {
  describe('userCreateSchema', () => {
    it('should validate valid user creation data', () => {
      const validUser = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: UserRole.USER,
      }

      const result = userCreateSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidUser = {
        email: 'invalid-email',
        password: 'password123',
      }

      const result = userCreateSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format')
      }
    })

    it('should reject short password', () => {
      const invalidUser = {
        email: 'test@example.com',
        password: '123',
      }

      const result = userCreateSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 6 characters')
      }
    })
  })

  describe('userUpdateSchema', () => {
    it('should validate partial user update data', () => {
      const updateData = {
        name: 'Updated Name',
        active: false,
      }

      const result = userUpdateSchema.safeParse(updateData)
      expect(result.success).toBe(true)
    })

    it('should validate empty update data', () => {
      const result = userUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})

describe('Node Validation', () => {
  describe('nodeSchema', () => {
    it('should validate valid node data', () => {
      const validNode = {
        id: 'node-1',
        type: 'http-request',
        name: 'HTTP Request',
        parameters: {
          method: 'GET',
          url: 'https://api.example.com',
        },
        position: { x: 100, y: 200 },
        disabled: false,
      }

      const result = nodeSchema.safeParse(validNode)
      expect(result.success).toBe(true)
    })

    it('should reject node without required fields', () => {
      const invalidNode = {
        id: 'node-1',
        type: 'http-request',
        // missing name, parameters, position, disabled
      }

      const result = nodeSchema.safeParse(invalidNode)
      expect(result.success).toBe(false)
    })
  })

  describe('connectionSchema', () => {
    it('should validate valid connection data', () => {
      const validConnection = {
        id: 'conn-1',
        sourceNodeId: 'node-1',
        sourceOutput: 'main',
        targetNodeId: 'node-2',
        targetInput: 'main',
      }

      const result = connectionSchema.safeParse(validConnection)
      expect(result.success).toBe(true)
    })
  })

  describe('triggerSchema', () => {
    it('should validate valid trigger data', () => {
      const validTrigger = {
        id: 'trigger-1',
        type: 'webhook' as const,
        settings: {
          path: '/webhook',
          method: 'POST',
        },
        active: true,
      }

      const result = triggerSchema.safeParse(validTrigger)
      expect(result.success).toBe(true)
    })

    it('should reject invalid trigger type', () => {
      const invalidTrigger = {
        id: 'trigger-1',
        type: 'invalid-type',
        settings: {},
        active: true,
      }

      const result = triggerSchema.safeParse(invalidTrigger)
      expect(result.success).toBe(false)
    })
  })
})

describe('Workflow Validation', () => {
  const validWorkflowData = {
    name: 'Test Workflow',
    description: 'A test workflow',
    nodes: [
      {
        id: 'node-1',
        type: 'webhook',
        name: 'Webhook',
        parameters: { path: '/test' },
        position: { x: 100, y: 100 },
        disabled: false,
      },
      {
        id: 'node-2',
        type: 'http-request',
        name: 'HTTP Request',
        parameters: { method: 'GET', url: 'https://api.example.com' },
        position: { x: 300, y: 100 },
        disabled: false,
      },
    ],
    connections: [
      {
        id: 'conn-1',
        sourceNodeId: 'node-1',
        sourceOutput: 'main',
        targetNodeId: 'node-2',
        targetInput: 'main',
      },
    ],
    triggers: [
      {
        id: 'trigger-1',
        type: 'webhook' as const,
        settings: { path: '/test' },
        active: true,
      },
    ],
    settings: {
      timezone: 'UTC',
      saveExecutionProgress: true,
    },
  }

  describe('workflowCreateSchema', () => {
    it('should validate valid workflow creation data', () => {
      const result = workflowCreateSchema.safeParse(validWorkflowData)
      expect(result.success).toBe(true)
    })

    it('should reject workflow without name', () => {
      const invalidWorkflow = { ...validWorkflowData, name: '' }
      const result = workflowCreateSchema.safeParse(invalidWorkflow)
      expect(result.success).toBe(false)
    })
  })

  describe('workflowUpdateSchema', () => {
    it('should validate partial workflow update data', () => {
      const updateData = {
        name: 'Updated Workflow Name',
        active: true,
      }

      const result = workflowUpdateSchema.safeParse(updateData)
      expect(result.success).toBe(true)
    })
  })

  describe('validateWorkflowStructure', () => {
    it('should validate workflow with valid structure', () => {
      const result = validateWorkflowStructure(validWorkflowData)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid node references in connections', () => {
      const invalidWorkflow = {
        ...validWorkflowData,
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'non-existent-node',
            sourceOutput: 'main',
            targetNodeId: 'node-2',
            targetInput: 'main',
          },
        ],
      }

      const result = validateWorkflowStructure(invalidWorkflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Connection references non-existent source node: non-existent-node')
    })

    it('should detect circular dependencies', () => {
      const circularWorkflow = {
        ...validWorkflowData,
        nodes: [
          {
            id: 'node-1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false,
          },
          {
            id: 'node-2',
            type: 'http-request',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false,
          },
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'node-1',
            sourceOutput: 'main',
            targetNodeId: 'node-2',
            targetInput: 'main',
          },
          {
            id: 'conn-2',
            sourceNodeId: 'node-2',
            sourceOutput: 'main',
            targetNodeId: 'node-1',
            targetInput: 'main',
          },
        ],
      }

      const result = validateWorkflowStructure(circularWorkflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow contains circular dependencies')
    })

    it('should require at least one trigger', () => {
      const workflowWithoutTrigger = {
        ...validWorkflowData,
        triggers: [],
        nodes: validWorkflowData.nodes.filter(node => node.type !== 'webhook'),
      }

      const result = validateWorkflowStructure(workflowWithoutTrigger)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow must have at least one trigger or manual start node')
    })
  })
})
