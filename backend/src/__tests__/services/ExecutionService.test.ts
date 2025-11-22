import { PrismaClient } from '@prisma/client';
import { ExecutionService } from '../../services/ExecutionService';
import { NodeService } from '../../services/NodeService';
import { ExecutionEngine } from '../../services/ExecutionEngine';
import {
  ExecutionStatus,
  NodeExecutionStatus,
  ExecutionFilters
} from '../../types/database';
import { ExecutionOptions } from '../../types/execution.types';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/ExecutionEngine');
jest.mock('../../services/NodeService');
jest.mock('../../utils/logger');

const mockPrisma = {
  execution: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn()
  },
  nodeExecution: {
    findFirst: jest.fn()
  }
} as any;

const mockNodeService = {
  executeNode: jest.fn()
} as any;

const mockExecutionEngine = {
  executeWorkflow: jest.fn(),
  cancelExecution: jest.fn(),
  getExecutionProgress: jest.fn(),
  getExecutionStats: jest.fn(),
  on: jest.fn(),
  shutdown: jest.fn()
} as any;

// Mock ExecutionEngine constructor
(ExecutionEngine as jest.MockedClass<typeof ExecutionEngine>).mockImplementation(() => mockExecutionEngine);

describe('ExecutionService', () => {
  let executionService: ExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    executionService = new ExecutionService(mockPrisma, mockNodeService);
  });

  afterEach(async () => {
    await executionService.shutdown();
  });

  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      const executionId = 'execution-1';
      mockExecutionEngine.executeWorkflow.mockResolvedValue(executionId);

      const result = await executionService.executeWorkflow(
        'workflow-1',
        'user-1',
        { test: 'data' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ executionId });
      expect(mockExecutionEngine.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        'user-1',
        { test: 'data' },
        {}
      );
    });

    it('should handle execution failure', async () => {
      const error = new Error('Workflow execution failed');
      mockExecutionEngine.executeWorkflow.mockRejectedValue(error);

      const result = await executionService.executeWorkflow(
        'workflow-1',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        message: 'Workflow execution failed',
        timestamp: expect.any(Date)
      });
    });

    it('should pass execution options to engine', async () => {
      const options: ExecutionOptions = {
        timeout: 600000,
        maxRetries: 5,
        saveProgress: true
      };

      mockExecutionEngine.executeWorkflow.mockResolvedValue('execution-1');

      await executionService.executeWorkflow(
        'workflow-1',
        'user-1',
        { test: 'data' },
        options
      );

      expect(mockExecutionEngine.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        'user-1',
        { test: 'data' },
        options
      );
    });
  });

  describe('getExecution', () => {
    const mockExecution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.SUCCESS,
      startedAt: new Date(),
      finishedAt: new Date(),
      workflow: {
        id: 'workflow-1',
        name: 'Test Workflow',
        description: 'Test description'
      },
      nodeExecutions: [
        {
          id: 'ne-1',
          nodeId: 'node-1',
          status: NodeExecutionStatus.SUCCESS,
          startedAt: new Date()
        }
      ]
    };

    it('should return execution by ID', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(mockExecution);

      const result = await executionService.getExecution('execution-1', 'user-1');

      expect(result).toEqual(mockExecution);
      expect(mockPrisma.execution.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'execution-1',
          workflow: { userId: 'user-1' }
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          nodeExecutions: {
            orderBy: { startedAt: 'asc' }
          }
        }
      });
    });

    it('should return null for non-existent execution', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(null);

      const result = await executionService.getExecution('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrisma.execution.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await executionService.getExecution('execution-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('listExecutions', () => {
    const mockExecutions = [
      {
        id: 'execution-1',
        workflowId: 'workflow-1',
        status: ExecutionStatus.SUCCESS,
        startedAt: new Date(),
        workflow: { id: 'workflow-1', name: 'Workflow 1' },
        _count: { nodeExecutions: 3 }
      },
      {
        id: 'execution-2',
        workflowId: 'workflow-2',
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
        workflow: { id: 'workflow-2', name: 'Workflow 2' },
        _count: { nodeExecutions: 1 }
      }
    ];

    beforeEach(() => {
      mockPrisma.execution.findMany.mockResolvedValue(mockExecutions);
      mockPrisma.execution.count.mockResolvedValue(2);
    });

    it('should list executions with default pagination', async () => {
      const result = await executionService.listExecutions('user-1');

      expect(result).toEqual({
        executions: mockExecutions,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      expect(mockPrisma.execution.findMany).toHaveBeenCalledWith({
        where: { workflow: { userId: 'user-1' } },
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          _count: {
            select: {
              nodeExecutions: true
            }
          }
        }
      });
    });

    it('should apply filters correctly', async () => {
      const filters: ExecutionFilters = {
        status: ExecutionStatus.SUCCESS,
        workflowId: 'workflow-1',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        limit: 10,
        offset: 20
      };

      await executionService.listExecutions('user-1', filters);

      expect(mockPrisma.execution.findMany).toHaveBeenCalledWith({
        where: {
          workflow: { userId: 'user-1' },
          status: ExecutionStatus.SUCCESS,
          workflowId: 'workflow-1',
          startedAt: {
            gte: new Date('2023-01-01'),
            lte: new Date('2023-12-31')
          }
        },
        skip: 20,
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: expect.any(Object)
      });
    });

    it('should calculate pagination correctly', async () => {
      mockPrisma.execution.count.mockResolvedValue(45);

      const result = await executionService.listExecutions('user-1', {
        limit: 10,
        offset: 20
      });

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);
    });
  });

  describe('cancelExecution', () => {
    const mockExecution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.RUNNING,
      startedAt: new Date()
    };

    it('should cancel running execution successfully', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(mockExecution);
      mockExecutionEngine.cancelExecution.mockResolvedValue(undefined);

      const result = await executionService.cancelExecution('execution-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Execution cancelled successfully' });
      expect(mockExecutionEngine.cancelExecution).toHaveBeenCalledWith('execution-1');
    });

    it('should fail if execution not found', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(null);

      const result = await executionService.cancelExecution('nonexistent', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution not found');
    });

    it('should fail if execution is not running', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue({
        ...mockExecution,
        status: ExecutionStatus.SUCCESS
      });

      const result = await executionService.cancelExecution('execution-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Can only cancel running executions');
    });

    it('should handle cancellation errors', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(mockExecution);
      mockExecutionEngine.cancelExecution.mockRejectedValue(new Error('Cancellation failed'));

      const result = await executionService.cancelExecution('execution-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Cancellation failed');
    });
  });

  describe('retryExecution', () => {
    const mockExecution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.ERROR,
      startedAt: new Date(),
      triggerData: { test: 'data' },
      workflow: {
        id: 'workflow-1',
        name: 'Test Workflow'
      }
    };

    it('should retry failed execution successfully', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(mockExecution);
      mockExecutionEngine.executeWorkflow.mockResolvedValue('execution-2');

      const result = await executionService.retryExecution('execution-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ executionId: 'execution-2' });
      expect(mockExecutionEngine.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        'user-1',
        { test: 'data' }
      );
    });

    it('should fail if execution not found', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(null);

      const result = await executionService.retryExecution('nonexistent', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution not found');
    });

    it('should fail if execution is running', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue({
        ...mockExecution,
        status: ExecutionStatus.RUNNING
      });

      const result = await executionService.retryExecution('execution-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Cannot retry running execution');
    });
  });

  describe('deleteExecution', () => {
    const mockExecution = {
      id: 'execution-1',
      workflowId: 'workflow-1',
      status: ExecutionStatus.SUCCESS,
      startedAt: new Date()
    };

    it('should delete execution successfully', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(mockExecution);
      mockPrisma.execution.delete.mockResolvedValue(mockExecution);

      const result = await executionService.deleteExecution('execution-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Execution deleted successfully' });
      expect(mockPrisma.execution.delete).toHaveBeenCalledWith({
        where: { id: 'execution-1' }
      });
    });

    it('should fail if execution not found', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(null);

      const result = await executionService.deleteExecution('nonexistent', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execution not found');
    });

    it('should fail if execution is running', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue({
        ...mockExecution,
        status: ExecutionStatus.RUNNING
      });

      const result = await executionService.deleteExecution('execution-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Cannot delete running execution');
    });
  });

  describe('getExecutionProgress', () => {
    const mockProgress = {
      executionId: 'execution-1',
      totalNodes: 3,
      completedNodes: 2,
      failedNodes: 0,
      currentNode: 'node-3',
      status: 'running' as const,
      startedAt: new Date(),
      finishedAt: undefined,
      error: undefined
    };

    it('should return execution progress', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue({ id: 'execution-1' });
      mockExecutionEngine.getExecutionProgress.mockResolvedValue(mockProgress);

      const result = await executionService.getExecutionProgress('execution-1', 'user-1');

      expect(result).toEqual(mockProgress);
      expect(mockExecutionEngine.getExecutionProgress).toHaveBeenCalledWith('execution-1');
    });

    it('should return null if execution not found', async () => {
      mockPrisma.execution.findFirst.mockResolvedValue(null);

      const result = await executionService.getExecutionProgress('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('getExecutionStats', () => {
    it('should return user-specific stats', async () => {
      mockPrisma.execution.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(2)   // running
        .mockResolvedValueOnce(40)  // completed
        .mockResolvedValueOnce(5)   // failed
        .mockResolvedValueOnce(3);  // cancelled

      const result = await executionService.getExecutionStats('user-1');

      expect(result).toEqual({
        totalExecutions: 50,
        runningExecutions: 2,
        completedExecutions: 40,
        failedExecutions: 5,
        cancelledExecutions: 3,
        averageExecutionTime: 0,
        queueSize: 0
      });
    });

    it('should return global stats when no user specified', async () => {
      const globalStats = {
        totalExecutions: 1000,
        runningExecutions: 10,
        completedExecutions: 800,
        failedExecutions: 150,
        cancelledExecutions: 40,
        averageExecutionTime: 5000,
        queueSize: 5
      };

      mockExecutionEngine.getExecutionStats.mockResolvedValue(globalStats);

      const result = await executionService.getExecutionStats();

      expect(result).toEqual(globalStats);
      expect(mockExecutionEngine.getExecutionStats).toHaveBeenCalled();
    });
  });

  describe('getNodeExecution', () => {
    const mockNodeExecution = {
      id: 'ne-1',
      nodeId: 'node-1',
      executionId: 'execution-1',
      status: NodeExecutionStatus.SUCCESS,
      inputData: { test: 'input' },
      outputData: { test: 'output' },
      startedAt: new Date(),
      finishedAt: new Date()
    };

    it('should return node execution details', async () => {
      mockPrisma.nodeExecution.findFirst.mockResolvedValue(mockNodeExecution);

      const result = await executionService.getNodeExecution(
        'execution-1',
        'node-1',
        'user-1'
      );

      expect(result).toEqual(mockNodeExecution);
      expect(mockPrisma.nodeExecution.findFirst).toHaveBeenCalledWith({
        where: {
          executionId: 'execution-1',
          nodeId: 'node-1',
          execution: {
            workflow: { userId: 'user-1' }
          }
        }
      });
    });

    it('should return null for non-existent node execution', async () => {
      mockPrisma.nodeExecution.findFirst.mockResolvedValue(null);

      const result = await executionService.getNodeExecution(
        'execution-1',
        'nonexistent',
        'user-1'
      );

      expect(result).toBeNull();
    });
  });

  describe('getExecutionEngine', () => {
    it('should return execution engine instance', () => {
      const engine = executionService.getExecutionEngine();
      expect(engine).toBe(mockExecutionEngine);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await executionService.shutdown();
      expect(mockExecutionEngine.shutdown).toHaveBeenCalled();
    });
  });
});
