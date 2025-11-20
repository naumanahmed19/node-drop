import { PrismaClient } from '@prisma/client';
import { TriggerService } from '../../services/TriggerService';
import { WorkflowService } from '../../services/WorkflowService';
import { ExecutionService } from '../../services/ExecutionService';
import { SocketService } from '../../services/SocketService';
import { NodeService } from '../../services/NodeService';
import * as cron from 'node-cron';

// Mock external dependencies
jest.mock('node-cron');
jest.mock('socket.io');

const mockCronSchedule = jest.fn();
const mockCronValidate = jest.fn();
(cron.schedule as jest.Mock) = mockCronSchedule;
(cron.validate as jest.Mock) = mockCronValidate;

describe('Trigger System Integration Tests', () => {
  let prisma: PrismaClient;
  let triggerService: TriggerService;
  let workflowService: WorkflowService;
  let executionService: ExecutionService;
  let socketService: SocketService;
  let nodeService: NodeService;

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
        }
      }
    });

    // Initialize services
    workflowService = new WorkflowService(prisma);
    nodeService = new NodeService(prisma);
    executionService = new ExecutionService(prisma, nodeService);
    socketService = new SocketService({} as any); // Mock HTTP server
    triggerService = new TriggerService(prisma, workflowService, executionService, socketService);

    // Setup mocks
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn()
    });
  });

  afterAll(async () => {
    await triggerService.cleanup();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.execution.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.user.deleteMany();
    
    jest.clearAllMocks();
  });

  describe('End-to-End Trigger Workflow', () => {
    let testUser: any;
    let testWorkflow: any;

    beforeEach(async () => {
      // Create test user
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          name: 'Test User',
          role: 'USER'
        }
      });

      // Create test workflow with trigger nodes
      testWorkflow = await prisma.workflow.create({
        data: {
          name: 'Test Trigger Workflow',
          description: 'Workflow for testing triggers',
          userId: testUser.id,
          nodes: [
            {
              id: 'trigger-node',
              type: 'webhook-trigger',
              name: 'Webhook Trigger',
              parameters: {
                httpMethod: 'POST',
                authentication: { type: 'none' }
              },
              position: { x: 100, y: 100 },
              disabled: false
            },
            {
              id: 'action-node',
              type: 'json',
              name: 'JSON Node',
              parameters: {
                jsonData: '{"processed": true}'
              },
              position: { x: 300, y: 100 },
              disabled: false
            }
          ],
          connections: [
            {
              id: 'conn-1',
              sourceNodeId: 'trigger-node',
              sourceOutput: 'main',
              targetNodeId: 'action-node',
              targetInput: 'main'
            }
          ],
          triggers: [],
          settings: {},
          active: true
        }
      });
    });

    it('should create and activate webhook trigger', async () => {
      const triggerData = {
        type: 'webhook' as const,
        nodeId: 'trigger-node',
        settings: {
          httpMethod: 'POST' as const,
          path: '/test-webhook',
          authentication: { type: 'none' as const }
        },
        active: true
      };

      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        triggerData
      );

      expect(trigger).toMatchObject({
        type: 'webhook',
        nodeId: 'trigger-node',
        workflowId: testWorkflow.id,
        active: true
      });

      expect(trigger.settings.webhookId).toBeDefined();

      // Verify trigger was stored in database
      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: testWorkflow.id }
      });

      const triggers = updatedWorkflow?.triggers as any[];
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toMatchObject({
        type: 'webhook',
        nodeId: 'trigger-node',
        active: true
      });
    });

    it('should create and activate schedule trigger', async () => {
      const triggerData = {
        type: 'schedule' as const,
        nodeId: 'trigger-node',
        settings: {
          cronExpression: '0 0 * * *',
          timezone: 'UTC'
        },
        active: true
      };

      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        triggerData
      );

      expect(trigger).toMatchObject({
        type: 'schedule',
        nodeId: 'trigger-node',
        workflowId: testWorkflow.id,
        active: true
      });

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: false,
          timezone: 'UTC'
        })
      );
    });

    it('should handle webhook trigger execution', async () => {
      // Create webhook trigger
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'trigger-node',
          settings: {
            httpMethod: 'POST',
            authentication: { type: 'none' }
          },
          active: true
        }
      );

      // Mock execution service
      const mockExecution = {
        id: 'execution-1',
        workflowId: testWorkflow.id,
        status: 'RUNNING'
      };
      jest.spyOn(executionService, 'executeWorkflow').mockResolvedValue(mockExecution as any);

      // Simulate webhook request
      const webhookRequest = {
        method: 'POST',
        path: '/webhook',
        headers: { 'content-type': 'application/json' },
        query: { param: 'value' },
        body: { test: 'data' },
        ip: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      const result = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        webhookRequest
      );

      expect(result.success).toBe(true);
      expect(result.executionId).toBe('execution-1');
      expect(executionService.executeWorkflow).toHaveBeenCalledWith(
        testWorkflow.id,
        expect.objectContaining({
          method: 'POST',
          body: { test: 'data' }
        })
      );
    });

    it('should handle manual trigger execution', async () => {
      // Create manual trigger
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'manual',
          nodeId: 'trigger-node',
          settings: {
            description: 'Test manual trigger'
          },
          active: true
        }
      );

      // Mock execution service
      const mockExecution = {
        id: 'execution-2',
        workflowId: testWorkflow.id,
        status: 'RUNNING'
      };
      jest.spyOn(executionService, 'executeWorkflow').mockResolvedValue(mockExecution as any);

      const result = await triggerService.handleManualTrigger(
        testWorkflow.id,
        trigger.id,
        testUser.id,
        { custom: 'data' }
      );

      expect(result.success).toBe(true);
      expect(result.executionId).toBe('execution-2');
      expect(executionService.executeWorkflow).toHaveBeenCalledWith(
        testWorkflow.id,
        { custom: 'data' }
      );
    });

    it('should update trigger settings', async () => {
      // Create initial trigger
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'trigger-node',
          settings: {
            httpMethod: 'POST',
            authentication: { type: 'none' }
          },
          active: true
        }
      );

      // Update trigger
      const updatedTrigger = await triggerService.updateTrigger(
        testWorkflow.id,
        trigger.id,
        testUser.id,
        {
          settings: {
            httpMethod: 'GET',
            authentication: { type: 'header' }
          },
          active: false
        }
      );

      expect(updatedTrigger.settings.httpMethod).toBe('GET');
      expect(updatedTrigger.settings.authentication?.type).toBe('header');
      expect(updatedTrigger.active).toBe(false);
    });

    it('should delete trigger', async () => {
      // Create trigger
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'trigger-node',
          settings: {
            httpMethod: 'POST',
            authentication: { type: 'none' }
          },
          active: true
        }
      );

      // Delete trigger
      await triggerService.deleteTrigger(testWorkflow.id, trigger.id, testUser.id);

      // Verify trigger was removed from database
      const updatedWorkflow = await prisma.workflow.findUnique({
        where: { id: testWorkflow.id }
      });

      const triggers = updatedWorkflow?.triggers as any[];
      expect(triggers).toHaveLength(0);
    });

    it('should get trigger statistics', async () => {
      // Create multiple triggers
      await triggerService.createTrigger(testWorkflow.id, testUser.id, {
        type: 'webhook',
        nodeId: 'trigger-node',
        settings: { httpMethod: 'POST', authentication: { type: 'none' } },
        active: true
      });

      await triggerService.createTrigger(testWorkflow.id, testUser.id, {
        type: 'schedule',
        nodeId: 'trigger-node',
        settings: { cronExpression: '0 0 * * *', timezone: 'UTC' },
        active: true
      });

      await triggerService.createTrigger(testWorkflow.id, testUser.id, {
        type: 'manual',
        nodeId: 'trigger-node',
        settings: { description: 'Manual trigger' },
        active: false
      });

      const stats = await triggerService.getTriggerStats(testWorkflow.id, testUser.id);

      expect(stats).toEqual({
        totalTriggers: 3,
        activeTriggers: 2,
        triggersByType: {
          webhook: 1,
          schedule: 1,
          manual: 1
        },
        recentEvents: 0
      });
    });
  });

  describe('Trigger Authentication', () => {
    let testUser: any;
    let testWorkflow: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          name: 'Test User',
          role: 'USER'
        }
      });

      testWorkflow = await prisma.workflow.create({
        data: {
          name: 'Test Workflow',
          userId: testUser.id,
          nodes: [],
          connections: [],
          triggers: [],
          settings: {},
          active: true
        }
      });
    });

    it('should validate header authentication', async () => {
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'node-1',
          settings: {
            httpMethod: 'POST',
            authentication: {
              type: 'header',
              settings: {
                headerName: 'x-api-key',
                expectedValue: 'secret-key'
              }
            }
          },
          active: true
        }
      );

      // Mock execution service
      jest.spyOn(executionService, 'executeWorkflow').mockResolvedValue({
        id: 'execution-1'
      } as any);

      // Test with correct header
      const validRequest = {
        method: 'POST',
        path: '/webhook',
        headers: { 'x-api-key': 'secret-key' },
        query: {},
        body: {},
        ip: '127.0.0.1'
      };

      const validResult = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        validRequest
      );

      expect(validResult.success).toBe(true);

      // Test with incorrect header
      const invalidRequest = {
        ...validRequest,
        headers: { 'x-api-key': 'wrong-key' }
      };

      const invalidResult = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        invalidRequest
      );

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBe('Webhook authentication failed');
    });

    it('should validate query parameter authentication', async () => {
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'node-1',
          settings: {
            httpMethod: 'POST',
            authentication: {
              type: 'query',
              settings: {
                queryParam: 'token',
                expectedValue: 'secret-token'
              }
            }
          },
          active: true
        }
      );

      // Mock execution service
      jest.spyOn(executionService, 'executeWorkflow').mockResolvedValue({
        id: 'execution-1'
      } as any);

      // Test with correct query parameter
      const validRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {},
        query: { token: 'secret-token' },
        body: {},
        ip: '127.0.0.1'
      };

      const validResult = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        validRequest
      );

      expect(validResult.success).toBe(true);

      // Test with incorrect query parameter
      const invalidRequest = {
        ...validRequest,
        query: { token: 'wrong-token' }
      };

      const invalidResult = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        invalidRequest
      );

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBe('Webhook authentication failed');
    });
  });

  describe('Error Handling', () => {
    let testUser: any;
    let testWorkflow: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          name: 'Test User',
          role: 'USER'
        }
      });

      testWorkflow = await prisma.workflow.create({
        data: {
          name: 'Test Workflow',
          userId: testUser.id,
          nodes: [],
          connections: [],
          triggers: [],
          settings: {},
          active: true
        }
      });
    });

    it('should handle execution service errors gracefully', async () => {
      const trigger = await triggerService.createTrigger(
        testWorkflow.id,
        testUser.id,
        {
          type: 'webhook',
          nodeId: 'node-1',
          settings: {
            httpMethod: 'POST',
            authentication: { type: 'none' }
          },
          active: true
        }
      );

      // Mock execution service to throw error
      jest.spyOn(executionService, 'executeWorkflow').mockRejectedValue(
        new Error('Execution failed')
      );

      const webhookRequest = {
        method: 'POST',
        path: '/webhook',
        headers: {},
        query: {},
        body: {},
        ip: '127.0.0.1'
      };

      const result = await triggerService.handleWebhookTrigger(
        trigger.settings.webhookId!,
        webhookRequest
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle invalid cron expressions', async () => {
      mockCronValidate.mockReturnValue(false);

      await expect(
        triggerService.createTrigger(testWorkflow.id, testUser.id, {
          type: 'schedule',
          nodeId: 'node-1',
          settings: {
            cronExpression: 'invalid-cron',
            timezone: 'UTC'
          },
          active: true
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should handle non-existent workflow', async () => {
      jest.spyOn(workflowService, 'getWorkflow').mockRejectedValue(
        new Error('Workflow not found')
      );

      await expect(
        triggerService.createTrigger('non-existent', testUser.id, {
          type: 'webhook',
          nodeId: 'node-1',
          settings: {
            httpMethod: 'POST',
            authentication: { type: 'none' }
          },
          active: true
        })
      ).rejects.toThrow('Workflow not found');
    });
  });
});
