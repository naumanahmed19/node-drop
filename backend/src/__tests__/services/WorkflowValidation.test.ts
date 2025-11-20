import { WorkflowService } from '../../services/WorkflowService';

// Mock PrismaClient for validation tests
const mockPrisma = {} as any;

describe('WorkflowService Validation', () => {
  let workflowService: WorkflowService;

  beforeAll(() => {
    workflowService = new WorkflowService(mockPrisma);
  });

  describe('validateWorkflow', () => {
    it('should validate correct workflow', async () => {
      const validWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: { path: '/test' },
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: 'http',
            name: 'HTTP Request',
            parameters: { url: 'https://api.example.com' },
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          }
        ],
        triggers: [
          {
            id: 'trigger1',
            type: 'webhook',
            nodeId: 'node1',
            settings: {}
          }
        ],
        settings: {
          timezone: 'UTC',
          saveExecutionProgress: true
        }
      };

      const validation = await workflowService.validateWorkflow(validWorkflow);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect empty workflow', async () => {
      const emptyWorkflow = {
        nodes: [],
        connections: [],
        triggers: [],
        settings: {}
      };

      const validation = await workflowService.validateWorkflow(emptyWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Workflow must contain at least one node');
    });

    it('should detect invalid connections', async () => {
      const invalidWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: { path: '/test' },
            position: { x: 100, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'nonexistent',
            sourceOutput: 'main',
            targetNodeId: 'node1',
            targetInput: 'main'
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(invalidWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => 
        error.includes('source node nonexistent not found')
      )).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const circularWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          },
          {
            id: 'conn2',
            sourceNodeId: 'node2',
            sourceOutput: 'main',
            targetNodeId: 'node1',
            targetInput: 'main'
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(circularWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Workflow contains circular dependencies');
    });

    it('should detect self-connections', async () => {
      const selfConnectedWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node1',
            targetInput: 'main'
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(selfConnectedWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Node node1 cannot connect to itself');
    });

    it('should detect duplicate node IDs', async () => {
      const duplicateNodeWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook 1',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node1',
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: []
      };

      const validation = await workflowService.validateWorkflow(duplicateNodeWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Workflow contains duplicate node IDs');
    });

    it('should warn about orphaned nodes', async () => {
      const orphanedNodeWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          },
          {
            id: 'node3',
            type: 'email',
            name: 'Send Email',
            parameters: {},
            position: { x: 500, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(orphanedNodeWorkflow);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.warnings!.some(warning => 
        warning.includes('Orphaned nodes detected: node3')
      )).toBe(true);
    });

    it('should detect invalid node structure', async () => {
      const invalidNodeWorkflow = {
        nodes: [
          {
            id: '',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: '',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          },
          {
            id: 'node3',
            type: 'email',
            name: '',
            parameters: {},
            position: { x: 500, y: 100 },
            disabled: false
          },
          {
            id: 'node4',
            type: 'transform',
            name: 'Transform',
            parameters: {},
            position: { x: 'invalid', y: 200 },
            disabled: false
          }
        ],
        connections: []
      };

      const validation = await workflowService.validateWorkflow(invalidNodeWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All nodes must have a valid ID');
      expect(validation.errors.some(error => error.includes('must have a valid type'))).toBe(true);
      expect(validation.errors.some(error => error.includes('must have a valid name'))).toBe(true);
      expect(validation.errors.some(error => error.includes('must have valid position coordinates'))).toBe(true);
    });

    it('should detect invalid connection structure', async () => {
      const invalidConnectionWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: '',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          },
          {
            id: 'conn2',
            sourceNodeId: '',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          },
          {
            id: 'conn3',
            sourceNodeId: 'node1',
            sourceOutput: '',
            targetNodeId: 'node2',
            targetInput: 'main'
          },
          {
            id: 'conn4',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: ''
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(invalidConnectionWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All connections must have a valid ID');
      expect(validation.errors.some(error => error.includes('must have a valid source output'))).toBe(true);
      expect(validation.errors.some(error => error.includes('must have a valid target input'))).toBe(true);
    });

    it('should detect duplicate connection IDs', async () => {
      const duplicateConnectionWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node2',
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node2',
            targetInput: 'main'
          },
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'secondary',
            targetNodeId: 'node2',
            targetInput: 'secondary'
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(duplicateConnectionWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Duplicate connection ID: conn1');
    });

    it('should detect invalid triggers', async () => {
      const invalidTriggerWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          }
        ],
        connections: [],
        triggers: [
          {
            id: '',
            type: 'webhook',
            nodeId: 'node1',
            settings: {}
          },
          {
            id: 'trigger2',
            type: '',
            nodeId: 'node1',
            settings: {}
          },
          {
            id: 'trigger3',
            type: 'schedule',
            nodeId: 'nonexistent',
            settings: {}
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(invalidTriggerWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All triggers must have a valid ID');
      expect(validation.errors.some(error => error.includes('must have a valid type'))).toBe(true);
      expect(validation.errors.some(error => error.includes('references non-existent node'))).toBe(true);
    });

    it('should detect invalid workflow settings', async () => {
      const invalidSettingsWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          }
        ],
        connections: [],
        settings: {
          timezone: 123,
          saveExecutionProgress: 'true',
          saveDataErrorExecution: 'false',
          saveDataSuccessExecution: 1
        }
      };

      const validation = await workflowService.validateWorkflow(invalidSettingsWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Workflow timezone must be a valid string');
      expect(validation.errors).toContain('saveExecutionProgress must be a boolean');
      expect(validation.errors).toContain('saveDataErrorExecution must be a boolean');
      expect(validation.errors).toContain('saveDataSuccessExecution must be a boolean');
    });

    it('should handle complex workflow with multiple validation issues', async () => {
      const complexInvalidWorkflow = {
        nodes: [
          {
            id: 'node1',
            type: 'webhook',
            name: 'Webhook',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'node1', // Duplicate ID
            type: 'http',
            name: 'HTTP Request',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          },
          {
            id: 'node3',
            type: '', // Invalid type
            name: 'Transform',
            parameters: {},
            position: { x: 500, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn1',
            sourceNodeId: 'node1',
            sourceOutput: 'main',
            targetNodeId: 'node1', // Self-connection
            targetInput: 'main'
          },
          {
            id: 'conn2',
            sourceNodeId: 'nonexistent', // Invalid source
            sourceOutput: 'main',
            targetNodeId: 'node3',
            targetInput: 'main'
          }
        ],
        triggers: [
          {
            id: 'trigger1',
            type: 'webhook',
            nodeId: 'nonexistent', // Invalid node reference
            settings: {}
          }
        ]
      };

      const validation = await workflowService.validateWorkflow(complexInvalidWorkflow);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(3);
      expect(validation.errors).toContain('Workflow contains duplicate node IDs');
      expect(validation.errors).toContain('Node node1 cannot connect to itself');
      expect(validation.errors.some(error => error.includes('must have a valid type'))).toBe(true);
      expect(validation.errors.some(error => error.includes('source node nonexistent not found'))).toBe(true);
      expect(validation.errors.some(error => error.includes('references non-existent node'))).toBe(true);
    });
  });
});
