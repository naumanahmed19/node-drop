import { PrismaClient } from '@prisma/client';
import { ExecutionEngine } from '../../services/ExecutionEngine';
import { NodeService } from '../../services/NodeService';
import {
  ExecutionContext,
  ExecutionGraph,
  QueueConfig,
  ExecutionOptions
} from '../../types/execution.types';
import {
  Workflow,
  Node,
  Connection,
  ExecutionStatus,
  NodeExecutionStatus
} from '../../types/database';
import { NodeDefinition, NodeInputData, NodeOutputData } from '../../types/node.types';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('bull');
jest.mock('../../utils/logger');

const mockPrisma = {
  workflow: {
    findFirst: jest.fn(),
    findUnique: jest.fn()
  },
  execution: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn()
  },
  nodeExecution: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn()
  }
} as any;

const mockNodeService = {
  executeNode: jest.fn(),
  getNodeTypes: jest.fn(),
  validateNodeDefinition: jest.fn()
} as any;

const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  on: jest.fn(),
  close: jest.fn(),
  waiting: jest.fn().mockResolvedValue(0),
  getWaiting: jest.fn().mockResolvedValue([]),
  getJobs: jest.fn().mockResolvedValue([])
};

// Mock Bull constructor
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => mockQueue);
});

describe('ExecutionEngine', () => {
  let executionEngine: ExecutionEngine;
  let queueConfig: QueueConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    queueConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0
      },
      concurrency: 5,
      removeOnComplete: 100,
      removeOnFail: 50,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    executionEngine = new ExecutionEngine(mockPrisma, mockNodeService, queueConfig);
  });

  afterEach(async () => {
    await executionEngine.shutdown();
  });

  describe('executeWorkflow', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      description: 'Test workflow description',
      userId: 'user-1',
      nodes: [
        {
          id: 'node-1',
          type: 'http-request',
          name: 'HTTP Request',
          parameters: { url: 'https://api.example.com' },
          position: { x: 100, y: 100 },
          disabled: false
        },
        {
          id: 'node-2',
          type: 'json',
          name: 'JSON',
          parameters: { operation: 'parse' },
          position: { x: 300, y: 100 },
          disabled: false
        }
      ],
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'node-1',
          sourceOutput: 'main',
          targetNodeId: 'node-2',
          targetInput: 'main'
        }
      ],
      triggers: [],
      settings: {
        saveExecutionProgress: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 300000
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockExecution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      triggerData: { test: 'data' }
    };

    beforeEach(() => {
      mockPrisma.workflow.findFirst.mockResolvedValue({
        ...mockWorkflow,
        user: { id: 'user-1', email: 'test@example.com' }
      });
      mockPrisma.execution.create.mockResolvedValue(mockExecution);
      mockQueue.add.mockResolvedValue({ id: 'job-1' });
    });

    it('should start workflow execution successfully', async () => {
      const executionId = await executionEngine.executeWorkflow(
        'workflow-1',
        'user-1',
        { test: 'data' }
      );

      expect(executionId).toBe('execution-1');
      expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith({
        where: { id: 'workflow-1', userId: 'user-1' },
        include: { user: { select: { id: true, email: true } } }
      });
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: {
          workflowId: 'workflow-1',
          status: ExecutionStatus.RUNNING,
          startedAt: expect.any(Date),
          triggerData: { test: 'data' }
        }
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        {
          executionId: 'execution-1',
          workflowId: 'workflow-1',
          userId: 'user-1',
          triggerData: { test: 'data' },
          retryCount: 0
        },
        {
          timeout: 300000,
          attempts: 1
        }
      );
    });

    it('should throw error if workflow not found', async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue(null);

      await expect(
        executionEngine.executeWorkflow('nonexistent', 'user-1')
      ).rejects.toThrow('Workflow nonexistent not found');
    });

    it('should throw error if workflow is not active', async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue({
        ...mockWorkflow,
        active: false,
        user: { id: 'user-1', email: 'test@example.com' }
      });

      await expect(
        executionEngine.executeWorkflow('workflow-1', 'user-1')
      ).rejects.toThrow('Workflow workflow-1 is not active');
    });

    it('should use custom timeout from options', async () => {
      const options: ExecutionOptions = { timeout: 600000 };

      await executionEngine.executeWorkflow(
        'workflow-1',
        'user-1',
        { test: 'data' },
        options
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.any(Object),
        {
          timeout: 600000,
          attempts: 1
        }
      );
    });
  });

  describe('cancelExecution', () => {
    it('should cancel execution successfully', async () => {
      const executionId = 'execution-1';
      
      // Set up active execution
      const context: ExecutionContext = {
        executionId,
        workflowId: 'workflow-1',
        userId: 'user-1',
        startedAt: new Date(),
        nodeExecutions: new Map(),
        nodeOutputs: new Map(),
        cancelled: false
      };
      
      (executionEngine as any).activeExecutions.set(executionId, context);
      mockPrisma.execution.update.mockResolvedValue({});

      await executionEngine.cancelExecution(executionId);

      expect(context.cancelled).toBe(true);
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.CANCELLED,
          finishedAt: expect.any(Date)
        }
      });
    });

    it('should handle cancellation of non-existent execution', async () => {
      const executionId = 'nonexistent';
      mockPrisma.execution.update.mockResolvedValue({});

      await expect(
        executionEngine.cancelExecution(executionId)
      ).resolves.not.toThrow();
    });
  });

  describe('getExecutionProgress', () => {
    const mockExecutionWithProgress = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
      workflow: {
        nodes: [
          { id: 'node-1', type: 'http-request' },
          { id: 'node-2', type: 'json' }
        ]
      },
      nodeExecutions: [
        {
          id: 'ne-1',
          nodeId: 'node-1',
          executionId: 'execution-1',
          status: NodeExecutionStatus.SUCCESS,
          startedAt: new Date(),
          finishedAt: new Date()
        },
        {
          id: 'ne-2',
          nodeId: 'node-2',
          executionId: 'execution-1',
          status: NodeExecutionStatus.RUNNING,
          startedAt: new Date(),
          finishedAt: null
        }
      ]
    };

    it('should return execution progress', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(mockExecutionWithProgress);

      const progress = await executionEngine.getExecutionProgress('execution-1');

      expect(progress).toEqual({
        executionId: 'execution-1',
        totalNodes: 2,
        completedNodes: 1,
        failedNodes: 0,
        currentNode: 'node-2',
        status: 'running',
        startedAt: mockExecutionWithProgress.startedAt,
        finishedAt: undefined,
        error: undefined
      });
    });

    it('should return null for non-existent execution', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      const progress = await executionEngine.getExecutionProgress('nonexistent');

      expect(progress).toBeNull();
    });
  });

  describe('buildExecutionGraph', () => {
    const nodes: Node[] = [
      {
        id: 'node-1',
        type: 'trigger',
        name: 'Trigger',
        parameters: {},
        position: { x: 0, y: 0 },
        disabled: false
      },
      {
        id: 'node-2',
        type: 'http-request',
        name: 'HTTP Request',
        parameters: {},
        position: { x: 100, y: 0 },
        disabled: false
      },
      {
        id: 'node-3',
        type: 'json',
        name: 'JSON',
        parameters: {},
        position: { x: 200, y: 0 },
        disabled: false
      }
    ];

    const connections: Connection[] = [
      {
        id: 'conn-1',
        sourceNodeId: 'node-1',
        sourceOutput: 'main',
        targetNodeId: 'node-2',
        targetInput: 'main'
      },
      {
        id: 'conn-2',
        sourceNodeId: 'node-2',
        sourceOutput: 'main',
        targetNodeId: 'node-3',
        targetInput: 'main'
      }
    ];

    it('should build execution graph correctly', () => {
      const graph = (executionEngine as any).buildExecutionGraph(nodes, connections);

      expect(graph.nodes.size).toBe(3);
      expect(graph.executionOrder).toEqual(['node-1', 'node-2', 'node-3']);
      expect(graph.adjacencyList.get('node-1')).toEqual(['node-2']);
      expect(graph.adjacencyList.get('node-2')).toEqual(['node-3']);
      expect(graph.adjacencyList.get('node-3')).toEqual([]);
    });

    it('should detect cycles in workflow', () => {
      const cyclicConnections: Connection[] = [
        ...connections,
        {
          id: 'conn-3',
          sourceNodeId: 'node-3',
          sourceOutput: 'main',
          targetNodeId: 'node-1',
          targetInput: 'main'
        }
      ];

      expect(() => {
        (executionEngine as any).buildExecutionGraph(nodes, cyclicConnections);
      }).toThrow('Workflow contains cycles - cannot execute');
    });
  });

  describe('topologicalSort', () => {
    it('should sort nodes in correct execution order', () => {
      const adjacencyList = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []]
      ]);

      const inDegree = new Map([
        ['A', 0],
        ['B', 1],
        ['C', 1],
        ['D', 2]
      ]);

      const result = (executionEngine as any).topologicalSort(adjacencyList, inDegree);

      expect(result).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should handle single node', () => {
      const adjacencyList = new Map([['A', []]]);
      const inDegree = new Map([['A', 0]]);

      const result = (executionEngine as any).topologicalSort(adjacencyList, inDegree);

      expect(result).toEqual(['A']);
    });

    it('should handle parallel branches', () => {
      const adjacencyList = new Map([
        ['A', ['B', 'C']],
        ['B', []],
        ['C', []]
      ]);

      const inDegree = new Map([
        ['A', 0],
        ['B', 1],
        ['C', 1]
      ]);

      const result = (executionEngine as any).topologicalSort(adjacencyList, inDegree);

      expect(result[0]).toBe('A');
      expect(result.slice(1).sort()).toEqual(['B', 'C']);
    });
  });

  describe('prepareNodeInputData', () => {
    const mockContext: ExecutionContext = {
      executionId: 'execution-1',
      workflowId: 'workflow-1',
      userId: 'user-1',
      triggerData: { trigger: 'data' },
      startedAt: new Date(),
      nodeExecutions: new Map(),
      nodeOutputs: new Map([
        ['node-1', [{ main: [{ data: 'from-node-1' }] }]]
      ]),
      cancelled: false
    };

    const mockGraph: ExecutionGraph = {
      nodes: new Map(),
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'node-1',
          sourceOutput: 'main',
          targetNodeId: 'node-2',
          targetInput: 'main'
        }
      ],
      adjacencyList: new Map(),
      inDegree: new Map(),
      executionOrder: []
    };

    it('should prepare input data for trigger node', () => {
      const inputData = (executionEngine as any).prepareNodeInputData(
        'trigger-node',
        { ...mockGraph, connections: [] },
        mockContext
      );

      expect(inputData).toEqual({
        main: [[{ trigger: 'data' }]]
      });
    });

    it('should prepare input data for connected node', () => {
      const inputData = (executionEngine as any).prepareNodeInputData(
        'node-2',
        mockGraph,
        mockContext
      );

      expect(inputData).toEqual({
        main: [[{ data: 'from-node-1' }]]
      });
    });

    it('should handle node with no input data', () => {
      const contextWithoutOutput = {
        ...mockContext,
        nodeOutputs: new Map()
      };

      const inputData = (executionEngine as any).prepareNodeInputData(
        'node-2',
        mockGraph,
        contextWithoutOutput
      );

      expect(inputData).toEqual({
        main: [[]]
      });
    });
  });

  describe('getExecutionStats', () => {
    beforeEach(() => {
      mockPrisma.execution.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5)   // running
        .mockResolvedValueOnce(80)  // completed
        .mockResolvedValueOnce(10)  // failed
        .mockResolvedValueOnce(5);  // cancelled
      
      mockPrisma.execution.aggregate.mockResolvedValue({ _avg: {} });
      mockQueue.getWaiting.mockResolvedValue([{}, {}, {}]); // 3 jobs
    });

    it('should return execution statistics', async () => {
      const stats = await executionEngine.getExecutionStats();

      expect(stats).toEqual({
        totalExecutions: 100,
        runningExecutions: 5,
        completedExecutions: 80,
        failedExecutions: 10,
        cancelledExecutions: 5,
        averageExecutionTime: 0,
        queueSize: 3
      });
    });
  });

  describe('error handling', () => {
    it('should handle retryable errors', () => {
      const retryableError = new Error('TIMEOUT occurred');
      const isRetryable = (executionEngine as any).isRetryableError(retryableError);
      
      expect(isRetryable).toBe(true);
    });

    it('should handle non-retryable errors', () => {
      const nonRetryableError = new Error('Invalid configuration');
      const isRetryable = (executionEngine as any).isRetryableError(nonRetryableError);
      
      expect(isRetryable).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await executionEngine.shutdown();

      expect(mockQueue.close).toHaveBeenCalledTimes(2); // execution and node queues
    });
  });
});
