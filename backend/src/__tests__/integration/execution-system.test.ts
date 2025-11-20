import { PrismaClient } from '@prisma/client';
import { ExecutionService } from '../../services/ExecutionService';
import { NodeService } from '../../services/NodeService';
import { WorkflowService } from '../../services/WorkflowService';
import {
  ExecutionStatus,
  NodeExecutionStatus,
  UserRole
} from '../../types/database';
import { NodeDefinition, BuiltInNodeTypes } from '../../types/node.types';

// This test requires a test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/node_drop_test'
    }
  }
});

describe('Execution System Integration', () => {
  let executionService: ExecutionService;
  let nodeService: NodeService;
  let workflowService: WorkflowService;
  let testUserId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    // Initialize services
    nodeService = new NodeService(prisma);
    executionService = new ExecutionService(prisma, nodeService);
    workflowService = new WorkflowService(prisma);

    // Register built-in nodes for testing
    await registerTestNodes();

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: UserRole.USER,
        active: true
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.nodeExecution.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.user.deleteMany();
    await executionService.shutdown();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test workflow
    const workflow = await workflowService.createWorkflow(testUserId, {
      name: 'Test Execution Workflow',
      description: 'Integration test workflow',
      nodes: [
        {
          id: 'trigger-node',
          type: 'manual-trigger',
          name: 'Manual Trigger',
          parameters: {},
          position: { x: 100, y: 100 },
          disabled: false
        },
        {
          id: 'set-node',
          type: BuiltInNodeTypes.SET,
          name: 'Set Data',
          parameters: {
            values: {
              string: [
                {
                  name: 'message',
                  value: 'Hello from execution test'
                }
              ]
            }
          },
          position: { x: 300, y: 100 },
          disabled: false
        },
        {
          id: 'json-node',
          type: BuiltInNodeTypes.JSON,
          name: 'JSON Transform',
          parameters: {
            operation: 'parse'
          },
          position: { x: 500, y: 100 },
          disabled: false
        }
      ],
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'trigger-node',
          sourceOutput: 'main',
          targetNodeId: 'set-node',
          targetInput: 'main'
        },
        {
          id: 'conn-2',
          sourceNodeId: 'set-node',
          sourceOutput: 'main',
          targetNodeId: 'json-node',
          targetInput: 'main'
        }
      ],
      triggers: [
        {
          id: 'trigger-1',
          type: 'manual',
          settings: {},
          active: true
        }
      ],
      settings: {
        saveExecutionProgress: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 60000
      },
      active: true
    });

    testWorkflowId = workflow.id;
  });

  afterEach(async () => {
    // Clean up executions and workflows after each test
    await prisma.nodeExecution.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.workflow.deleteMany({
      where: { userId: testUserId }
    });
  });

  describe('Workflow Execution Flow', () => {
    it('should execute a simple workflow successfully', async () => {
      // Start execution
      const executionResult = await executionService.executeWorkflow(
        testWorkflowId,
        testUserId,
        { trigger: 'manual', data: 'test' }
      );

      expect(executionResult.success).toBe(true);
      expect(executionResult.data?.executionId).toBeDefined();

      const executionId = executionResult.data!.executionId;

      // Wait for execution to complete (in a real scenario, this would be event-driven)
      await waitForExecutionCompletion(executionId, 30000);

      // Verify execution completed successfully
      const execution = await executionService.getExecution(executionId, testUserId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe(ExecutionStatus.SUCCESS);
      expect(execution!.finishedAt).toBeDefined();

      // Verify node executions
      expect(execution!.nodeExecutions).toHaveLength(3);
      
      const nodeExecutions = execution!.nodeExecutions;
      expect(nodeExecutions.every(ne => ne.status === NodeExecutionStatus.SUCCESS)).toBe(true);
      expect(nodeExecutions.every(ne => ne.finishedAt !== null)).toBe(true);

      // Verify execution order (trigger -> set -> json)
      const sortedNodeExecutions = nodeExecutions.sort(
        (a, b) => a.startedAt!.getTime() - b.startedAt!.getTime()
      );
      
      expect(sortedNodeExecutions[0].nodeId).toBe('trigger-node');
      expect(sortedNodeExecutions[1].nodeId).toBe('set-node');
      expect(sortedNodeExecutions[2].nodeId).toBe('json-node');
    }, 35000);

    it('should handle workflow execution with node failure', async () => {
      // Create workflow with a failing node
      const failingWorkflow = await workflowService.createWorkflow(testUserId, {
        name: 'Failing Workflow',
        description: 'Workflow with failing node',
        nodes: [
          {
            id: 'trigger-node',
            type: 'manual-trigger',
            name: 'Manual Trigger',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'failing-node',
            type: 'failing-test-node',
            name: 'Failing Node',
            parameters: {},
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-node',
            sourceOutput: 'main',
            targetNodeId: 'failing-node',
            targetInput: 'main'
          }
        ],
        triggers: [],
        settings: {
          saveExecutionProgress: true,
          saveDataErrorExecution: 'all',
          saveDataSuccessExecution: 'all'
        },
        active: true
      });

      // Start execution
      const executionResult = await executionService.executeWorkflow(
        failingWorkflow.id,
        testUserId,
        { trigger: 'manual' }
      );

      expect(executionResult.success).toBe(true);
      const executionId = executionResult.data!.executionId;

      // Wait for execution to fail
      await waitForExecutionCompletion(executionId, 30000);

      // Verify execution failed
      const execution = await executionService.getExecution(executionId, testUserId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe(ExecutionStatus.ERROR);
      expect(execution!.error).toBeDefined();
      expect(execution!.finishedAt).toBeDefined();

      // Verify node executions
      const failedNodeExecution = execution!.nodeExecutions.find(
        ne => ne.nodeId === 'failing-node'
      );
      expect(failedNodeExecution).toBeDefined();
      expect(failedNodeExecution!.status).toBe(NodeExecutionStatus.ERROR);
      expect(failedNodeExecution!.error).toBeDefined();
    }, 35000);

    it('should cancel running execution', async () => {
      // Create workflow with a slow node
      const slowWorkflow = await workflowService.createWorkflow(testUserId, {
        name: 'Slow Workflow',
        description: 'Workflow with slow node',
        nodes: [
          {
            id: 'trigger-node',
            type: 'manual-trigger',
            name: 'Manual Trigger',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'slow-node',
            type: 'slow-test-node',
            name: 'Slow Node',
            parameters: { delay: 10000 },
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-node',
            sourceOutput: 'main',
            targetNodeId: 'slow-node',
            targetInput: 'main'
          }
        ],
        triggers: [],
        settings: {
          saveExecutionProgress: true
        },
        active: true
      });

      // Start execution
      const executionResult = await executionService.executeWorkflow(
        slowWorkflow.id,
        testUserId,
        { trigger: 'manual' }
      );

      expect(executionResult.success).toBe(true);
      const executionId = executionResult.data!.executionId;

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Cancel execution
      const cancelResult = await executionService.cancelExecution(executionId, testUserId);
      expect(cancelResult.success).toBe(true);

      // Wait for cancellation to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify execution was cancelled
      const execution = await executionService.getExecution(executionId, testUserId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe(ExecutionStatus.CANCELLED);
      expect(execution!.finishedAt).toBeDefined();
    }, 20000);

    it('should retry failed execution', async () => {
      // Create a workflow that will fail initially
      const retryWorkflow = await workflowService.createWorkflow(testUserId, {
        name: 'Retry Workflow',
        description: 'Workflow for retry testing',
        nodes: [
          {
            id: 'trigger-node',
            type: 'manual-trigger',
            name: 'Manual Trigger',
            parameters: {},
            position: { x: 100, y: 100 },
            disabled: false
          },
          {
            id: 'flaky-node',
            type: 'flaky-test-node',
            name: 'Flaky Node',
            parameters: { failureRate: 1.0 }, // Always fail initially
            position: { x: 300, y: 100 },
            disabled: false
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-node',
            sourceOutput: 'main',
            targetNodeId: 'flaky-node',
            targetInput: 'main'
          }
        ],
        triggers: [],
        settings: {
          saveExecutionProgress: true,
          saveDataErrorExecution: 'all'
        },
        active: true
      });

      // Start execution (will fail)
      const executionResult = await executionService.executeWorkflow(
        retryWorkflow.id,
        testUserId,
        { trigger: 'manual' }
      );

      const originalExecutionId = executionResult.data!.executionId;

      // Wait for execution to fail
      await waitForExecutionCompletion(originalExecutionId, 30000);

      // Verify execution failed
      const failedExecution = await executionService.getExecution(originalExecutionId, testUserId);
      expect(failedExecution!.status).toBe(ExecutionStatus.ERROR);

      // Retry execution
      const retryResult = await executionService.retryExecution(originalExecutionId, testUserId);
      expect(retryResult.success).toBe(true);

      const newExecutionId = retryResult.data!.executionId;
      expect(newExecutionId).not.toBe(originalExecutionId);

      // The retry should create a new execution with the same trigger data
      const retriedExecution = await executionService.getExecution(newExecutionId, testUserId);
      expect(retriedExecution).toBeDefined();
      expect(retriedExecution!.triggerData).toEqual({ trigger: 'manual' });
    }, 35000);
  });

  describe('Execution Progress Tracking', () => {
    it('should track execution progress in real-time', async () => {
      // Start execution
      const executionResult = await executionService.executeWorkflow(
        testWorkflowId,
        testUserId,
        { trigger: 'manual' }
      );

      const executionId = executionResult.data!.executionId;

      // Check initial progress
      let progress = await executionService.getExecutionProgress(executionId, testUserId);
      expect(progress).toBeDefined();
      expect(progress!.executionId).toBe(executionId);
      expect(progress!.totalNodes).toBe(3);
      expect(progress!.status).toBe('running');

      // Wait for execution to complete
      await waitForExecutionCompletion(executionId, 30000);

      // Check final progress
      progress = await executionService.getExecutionProgress(executionId, testUserId);
      expect(progress!.status).toBe('success');
      expect(progress!.completedNodes).toBe(3);
      expect(progress!.failedNodes).toBe(0);
      expect(progress!.finishedAt).toBeDefined();
    }, 35000);
  });

  describe('Execution Statistics', () => {
    it('should provide accurate execution statistics', async () => {
      // Execute multiple workflows
      const executions = [];
      for (let i = 0; i < 3; i++) {
        const result = await executionService.executeWorkflow(
          testWorkflowId,
          testUserId,
          { trigger: 'manual', iteration: i }
        );
        executions.push(result.data!.executionId);
      }

      // Wait for all executions to complete
      await Promise.all(
        executions.map(id => waitForExecutionCompletion(id, 30000))
      );

      // Get user-specific stats
      const userStats = await executionService.getExecutionStats(testUserId);
      expect(userStats.totalExecutions).toBeGreaterThanOrEqual(3);
      expect(userStats.completedExecutions).toBeGreaterThanOrEqual(3);
      expect(userStats.runningExecutions).toBe(0);

      // Get global stats
      const globalStats = await executionService.getExecutionStats();
      expect(globalStats.totalExecutions).toBeGreaterThanOrEqual(userStats.totalExecutions);
    }, 45000);
  });

  describe('Node Execution Details', () => {
    it('should provide detailed node execution information', async () => {
      // Start execution
      const executionResult = await executionService.executeWorkflow(
        testWorkflowId,
        testUserId,
        { trigger: 'manual', data: { test: 'value' } }
      );

      const executionId = executionResult.data!.executionId;

      // Wait for execution to complete
      await waitForExecutionCompletion(executionId, 30000);

      // Get node execution details
      const nodeExecution = await executionService.getNodeExecution(
        executionId,
        'set-node',
        testUserId
      );

      expect(nodeExecution).toBeDefined();
      expect(nodeExecution!.nodeId).toBe('set-node');
      expect(nodeExecution!.status).toBe(NodeExecutionStatus.SUCCESS);
      expect(nodeExecution!.inputData).toBeDefined();
      expect(nodeExecution!.outputData).toBeDefined();
      expect(nodeExecution!.startedAt).toBeDefined();
      expect(nodeExecution!.finishedAt).toBeDefined();
    }, 35000);
  });

  // Helper function to wait for execution completion
  async function waitForExecutionCompletion(
    executionId: string,
    timeoutMs: number = 30000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const execution = await executionService.getExecution(executionId, testUserId);
      
      if (execution && execution.status !== ExecutionStatus.RUNNING) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Execution ${executionId} did not complete within ${timeoutMs}ms`);
  }

  // Register test nodes for integration testing
  async function registerTestNodes(): Promise<void> {
    // Manual trigger node
    const manualTriggerNode: NodeDefinition = {
      type: 'manual-trigger',
      displayName: 'Manual Trigger',
      name: 'manualTrigger',
      group: ['trigger'],
      version: 1,
      description: 'Manually trigger workflow execution',
      defaults: {},
      inputs: [],
      outputs: ['main'],
      properties: [],
      execute: async function(inputData) {
        return [{ main: [this.getNodeParameter('triggerData', 0) || {}] }];
      }
    };

    // Failing test node
    const failingTestNode: NodeDefinition = {
      type: 'failing-test-node',
      displayName: 'Failing Test Node',
      name: 'failingTestNode',
      group: ['test'],
      version: 1,
      description: 'Node that always fails for testing',
      defaults: {},
      inputs: ['main'],
      outputs: ['main'],
      properties: [],
      execute: async function(inputData) {
        throw new Error('Test node failure');
      }
    };

    // Slow test node
    const slowTestNode: NodeDefinition = {
      type: 'slow-test-node',
      displayName: 'Slow Test Node',
      name: 'slowTestNode',
      group: ['test'],
      version: 1,
      description: 'Node that takes time to execute',
      defaults: { delay: 5000 },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Delay (ms)',
          name: 'delay',
          type: 'number',
          default: 5000,
          description: 'Delay in milliseconds'
        }
      ],
      execute: async function(inputData) {
        const delay = this.getNodeParameter('delay', 0) as number;
        await new Promise(resolve => setTimeout(resolve, delay));
        return [{ main: inputData.main || [[]] }];
      }
    };

    // Flaky test node
    const flakyTestNode: NodeDefinition = {
      type: 'flaky-test-node',
      displayName: 'Flaky Test Node',
      name: 'flakyTestNode',
      group: ['test'],
      version: 1,
      description: 'Node that randomly fails',
      defaults: { failureRate: 0.5 },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Failure Rate',
          name: 'failureRate',
          type: 'number',
          default: 0.5,
          description: 'Probability of failure (0-1)'
        }
      ],
      execute: async function(inputData) {
        const failureRate = this.getNodeParameter('failureRate', 0) as number;
        if (Math.random() < failureRate) {
          throw new Error('Flaky node failure');
        }
        return [{ main: inputData.main || [[]] }];
      }
    };

    // Register all test nodes
    await nodeService.registerNode(manualTriggerNode);
    await nodeService.registerNode(failingTestNode);
    await nodeService.registerNode(slowTestNode);
    await nodeService.registerNode(flakyTestNode);
  }
});
