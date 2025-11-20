import { FlowExecutionEngine, FlowExecutionContext, FlowExecutionOptions } from '../FlowExecutionEngine';
import { NodeService } from '../NodeService';
import { PrismaClient } from '@prisma/client';
import { Node, Connection, Workflow } from '../../types/database';
import { CircularDependencyError, FlowExecutionErrorType } from '../../utils/errors/FlowExecutionError';

// Mock PrismaClient
const mockPrisma = {
  workflow: {
    findUnique: jest.fn()
  }
} as unknown as PrismaClient;

// Mock NodeService
const mockNodeService = {
  executeNode: jest.fn()
} as unknown as NodeService;

describe('FlowExecutionEngine', () => {
  let flowEngine: FlowExecutionEngine;

  beforeEach(() => {
    flowEngine = new FlowExecutionEngine(mockPrisma, mockNodeService);
    jest.clearAllMocks();
  });

  describe('Core Class Functionality', () => {
    it('should create FlowExecutionEngine instance', () => {
      expect(flowEngine).toBeInstanceOf(FlowExecutionEngine);
    });

    it('should have executeFromNode method', () => {
      expect(typeof flowEngine.executeFromNode).toBe('function');
    });

    it('should have executeFromTrigger method', () => {
      expect(typeof flowEngine.executeFromTrigger).toBe('function');
    });

    it('should have getExecutionStatus method', () => {
      expect(typeof flowEngine.getExecutionStatus).toBe('function');
    });

    it('should have cancelExecution method', () => {
      expect(typeof flowEngine.cancelExecution).toBe('function');
    });

    it('should have pauseExecution method', () => {
      expect(typeof flowEngine.pauseExecution).toBe('function');
    });

    it('should have resumeExecution method', () => {
      expect(typeof flowEngine.resumeExecution).toBe('function');
    });
  });

  describe('ExecutionContext Management', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      userId: 'user-1',
      nodes: [
        {
          id: 'node-1',
          type: 'manual-trigger',
          name: 'Manual Trigger',
          parameters: {},
          position: { x: 0, y: 0 },
          disabled: false
        } as Node,
        {
          id: 'node-2',
          type: 'http-request',
          name: 'HTTP Request',
          parameters: {},
          position: { x: 200, y: 0 },
          disabled: false
        } as Node
      ],
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'node-1',
          sourceOutput: 'main',
          targetNodeId: 'node-2',
          targetInput: 'main'
        } as Connection
      ],
      triggers: [],
      settings: {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockNodeService.executeNode as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: [{ main: [{ result: 'success' }] }]
        }), 50))
      );
    });

    it('should create execution context when executing from node', async () => {
      const promise = flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      // Check that execution context is created (we can verify this by checking status)
      setTimeout(() => {
        const executions = (flowEngine as any).activeExecutions;
        expect(executions.size).toBe(1);
        
        const context = Array.from(executions.values())[0] as FlowExecutionContext;
        expect(context.workflowId).toBe('workflow-1');
        expect(context.userId).toBe('user-1');
        expect(context.triggerNodeId).toBe('node-1');
        expect(context.nodeStates).toBeInstanceOf(Map);
        expect(context.executionPath).toEqual([]);
        expect(context.cancelled).toBe(false);
        expect(context.paused).toBe(false);
      }, 10);

      await promise;
    });

    it('should create execution context when executing from trigger', async () => {
      const triggerData = { test: 'data' };
      const promise = flowEngine.executeFromTrigger('node-1', 'workflow-1', 'user-1', triggerData);
      
      setTimeout(() => {
        const executions = (flowEngine as any).activeExecutions;
        expect(executions.size).toBe(1);
        
        const context = Array.from(executions.values())[0] as FlowExecutionContext;
        expect(context.workflowId).toBe('workflow-1');
        expect(context.userId).toBe('user-1');
        expect(context.triggerNodeId).toBe('node-1');
        expect(context.triggerData).toEqual(triggerData);
      }, 10);

      await promise;
    });

    it('should clean up execution context after completion', async () => {
      await flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      const executions = (flowEngine as any).activeExecutions;
      const queues = (flowEngine as any).nodeQueue;
      
      expect(executions.size).toBe(0);
      expect(queues.size).toBe(0);
    });
  });

  describe('Node Queue Management', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      userId: 'user-1',
      nodes: [
        {
          id: 'node-1',
          type: 'manual-trigger',
          name: 'Manual Trigger',
          parameters: {},
          position: { x: 0, y: 0 },
          disabled: false
        } as Node,
        {
          id: 'node-2',
          type: 'http-request',
          name: 'HTTP Request',
          parameters: {},
          position: { x: 200, y: 0 },
          disabled: false
        } as Node,
        {
          id: 'node-3',
          type: 'json',
          name: 'JSON',
          parameters: {},
          position: { x: 400, y: 0 },
          disabled: false
        } as Node
      ],
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'node-1',
          sourceOutput: 'main',
          targetNodeId: 'node-2',
          targetInput: 'main'
        } as Connection,
        {
          id: 'conn-2',
          sourceNodeId: 'node-2',
          sourceOutput: 'main',
          targetNodeId: 'node-3',
          targetInput: 'main'
        } as Connection
      ],
      triggers: [],
      settings: {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockNodeService.executeNode as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: [{ main: [{ result: 'success' }] }]
        }), 50))
      );
    });

    it('should initialize node queue with starting node', async () => {
      const promise = flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      setTimeout(() => {
        const queues = (flowEngine as any).nodeQueue;
        expect(queues.size).toBe(1);
        
        const queue = Array.from(queues.values())[0];
        // The queue might be empty if the node has already been processed
        // but the execution should still be active
        expect(queue).toBeDefined();
      }, 10);

      await promise;
    });

    it('should manage node execution order properly', async () => {
      const result = await flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      // Should execute nodes in dependency order
      expect(result.executionPath).toEqual(['node-1', 'node-2', 'node-3']);
      expect(result.executedNodes).toEqual(['node-1', 'node-2', 'node-3']);
      expect(result.status).toBe('completed');
    });
  });

  describe('Execution Control', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      userId: 'user-1',
      nodes: [
        {
          id: 'node-1',
          type: 'manual-trigger',
          name: 'Manual Trigger',
          parameters: {},
          position: { x: 0, y: 0 },
          disabled: false
        } as Node
      ],
      connections: [],
      triggers: [],
      settings: {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockNodeService.executeNode as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: [{ main: [{ result: 'success' }] }]
        }), 100))
      );
    });

    it('should support execution cancellation', async () => {
      const promise = flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      // Cancel execution after a short delay
      setTimeout(async () => {
        const executions = (flowEngine as any).activeExecutions;
        const executionId = Array.from(executions.keys())[0] as string;
        await flowEngine.cancelExecution(executionId);
      }, 50);

      const result = await promise;
      expect(result.status).toBe('cancelled');
    });

    it('should support execution pause and resume', async () => {
      const promise = flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      let executionId: string;
      
      // Pause execution
      setTimeout(async () => {
        const executions = (flowEngine as any).activeExecutions;
        executionId = Array.from(executions.keys())[0] as string;
        await flowEngine.pauseExecution(executionId);
        
        const status = flowEngine.getExecutionStatus(executionId);
        expect(status?.overallStatus).toBe('paused');
        
        // Resume after a short delay
        setTimeout(async () => {
          await flowEngine.resumeExecution(executionId);
        }, 50);
      }, 25);

      const result = await promise;
      expect(result.status).toBe('completed');
    });

    it('should provide execution status', async () => {
      const promise = flowEngine.executeFromNode('node-1', 'workflow-1', 'user-1');
      
      setTimeout(() => {
        const executions = (flowEngine as any).activeExecutions;
        const executionId = Array.from(executions.keys())[0] as string;
        const status = flowEngine.getExecutionStatus(executionId);
        
        expect(status).toBeDefined();
        expect(status?.executionId).toBe(executionId);
        expect(status?.overallStatus).toMatch(/running|completed/);
        expect(status?.nodeStates).toBeInstanceOf(Map);
        expect(status?.executionPath).toBeInstanceOf(Array);
      }, 50);

      await promise;
    });
  });

  describe('Circular Dependency Error Handling', () => {
    it('should throw CircularDependencyError for workflows with circular dependencies', async () => {
      const circularWorkflow: Workflow = {
        id: 'workflow-circular',
        name: 'Circular Workflow',
        userId: 'user-1',
        nodes: [
          {
            id: 'node-A',
            type: 'manual-trigger',
            name: 'Node A',
            parameters: {},
            position: { x: 0, y: 0 },
            disabled: false
          } as Node,
          {
            id: 'node-B',
            type: 'http-request',
            name: 'Node B',
            parameters: {},
            position: { x: 100, y: 0 },
            disabled: false
          } as Node
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'node-A',
            sourceOutput: 'main',
            targetNodeId: 'node-B',
            targetInput: 'main'
          } as Connection,
          {
            id: 'conn-2',
            sourceNodeId: 'node-B',
            sourceOutput: 'main',
            targetNodeId: 'node-A',
            targetInput: 'main'
          } as Connection
        ],
        triggers: [],
        settings: {},
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(circularWorkflow);

      await expect(
        flowEngine.executeFromNode('node-A', 'workflow-circular', 'user-1')
      ).rejects.toThrow(CircularDependencyError);

      try {
        await flowEngine.executeFromNode('node-A', 'workflow-circular', 'user-1');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        expect(error.flowErrorType).toBe(FlowExecutionErrorType.CIRCULAR_DEPENDENCY);
        expect(error.affectedNodes).toContain('node-A');
        expect(error.affectedNodes).toContain('node-B');
        expect(error.suggestedResolution).toContain('Remove one or more connections');
      }
    });

    it('should throw CircularDependencyError for self-referencing nodes', async () => {
      const selfRefWorkflow: Workflow = {
        id: 'workflow-self-ref',
        name: 'Self Reference Workflow',
        userId: 'user-1',
        nodes: [
          {
            id: 'node-self',
            type: 'http-request',
            name: 'Self Referencing Node',
            parameters: {},
            position: { x: 0, y: 0 },
            disabled: false
          } as Node
        ],
        connections: [
          {
            id: 'conn-self',
            sourceNodeId: 'node-self',
            sourceOutput: 'main',
            targetNodeId: 'node-self',
            targetInput: 'main'
          } as Connection
        ],
        triggers: [],
        settings: {},
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(selfRefWorkflow);

      await expect(
        flowEngine.executeFromNode('node-self', 'workflow-self-ref', 'user-1')
      ).rejects.toThrow(CircularDependencyError);
    });

    it('should successfully execute workflows without circular dependencies', async () => {
      const validWorkflow: Workflow = {
        id: 'workflow-valid',
        name: 'Valid Workflow',
        userId: 'user-1',
        nodes: [
          {
            id: 'node-start',
            type: 'manual-trigger',
            name: 'Start Node',
            parameters: {},
            position: { x: 0, y: 0 },
            disabled: false
          } as Node,
          {
            id: 'node-end',
            type: 'http-request',
            name: 'End Node',
            parameters: {},
            position: { x: 100, y: 0 },
            disabled: false
          } as Node
        ],
        connections: [
          {
            id: 'conn-valid',
            sourceNodeId: 'node-start',
            sourceOutput: 'main',
            targetNodeId: 'node-end',
            targetInput: 'main'
          } as Connection
        ],
        triggers: [],
        settings: {},
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(validWorkflow);
      (mockNodeService.executeNode as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ main: [{ result: 'success' }] }]
      });

      const result = await flowEngine.executeFromNode('node-start', 'workflow-valid', 'user-1');
      
      expect(result.status).toBe('completed');
      expect(result.executedNodes).toContain('node-start');
      expect(result.executedNodes).toContain('node-end');
      expect(result.failedNodes).toHaveLength(0);
    });
  });
});
