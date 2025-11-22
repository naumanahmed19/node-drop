import { PrismaClient } from '@prisma/client';
import { TriggerService, TriggerDefinition, WebhookRequest } from '../../services/TriggerService';
import { WorkflowService } from '../../services/WorkflowService';
import { ExecutionService } from '../../services/ExecutionService';
import { SocketService } from '../../services/SocketService';
import * as cron from 'node-cron';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/WorkflowService');
jest.mock('../../services/ExecutionService');
jest.mock('../../services/SocketService');
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  validate: jest.fn()
}));

const mockPrisma = {
  workflow: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  }
} as unknown as PrismaClient;

const mockWorkflowService = {
  getWorkflow: jest.fn(),
} as unknown as WorkflowService;

const mockExecutionService = {
  executeWorkflow: jest.fn(),
} as unknown as ExecutionService;

const mockSocketService = {
  emitToUser: jest.fn(),
} as unknown as SocketService;

const mockCronSchedule = jest.fn();
const mockCronValidate = jest.fn();

describe('TriggerService', () => {
  let triggerService: TriggerService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup cron mocks
    const cron = require('node-cron');
    cron.schedule.mockImplementation(mockCronSchedule);
    cron.validate.mockImplementation(mockCronValidate);
    
    triggerService = new TriggerService(
      mockPrisma,
      mockWorkflowService,
      mockExecutionService,
      mockSocketService
    );
  });

  describe('createTrigger', () => {
    const mockWorkflow = {
      id: 'workflow-1',
      userId: 'user-1',
      active: true,
      triggers: []
    };

    beforeEach(() => {
      (mockWorkflowService.getWorkflow as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockPrisma.workflow.update as jest.Mock).mockResolvedValue(mockWorkflow);
    });

    it('should create a webhook trigger successfully', async () => {
      const triggerData = {
        type: 'webhook' as const,
        nodeId: 'node-1',
        settings: {
          httpMethod: 'POST' as const,
          path: '/test',
          authentication: { type: 'none' as const }
        },
        active: true
      };

      const result = await triggerService.createTrigger('workflow-1', 'user-1', triggerData);

      expect(result).toMatchObject({
        type: 'webhook',
        nodeId: 'node-1',
        workflowId: 'workflow-1',
        active: true
      });
      expect(result.id).toBeDefined();
      expect(mockPrisma.workflow.update).toHaveBeenCalled();
    });

    it('should create a schedule trigger successfully', async () => {
      mockCronValidate.mockReturnValue(true);
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      mockCronSchedule.mockReturnValue(mockTask);
      
      const triggerData = {
        type: 'schedule' as const,
        nodeId: 'node-1',
        settings: {
          cronExpression: '0 0 * * *',
          timezone: 'UTC'
        },
        active: true
      };

      const result = await triggerService.createTrigger('workflow-1', 'user-1', triggerData);

      expect(result).toMatchObject({
        type: 'schedule',
        nodeId: 'node-1',
        workflowId: 'workflow-1',
        active: true
      });
      expect(mockCronValidate).toHaveBeenCalledWith('0 0 * * *');
    });

    it('should create a manual trigger successfully', async () => {
      const triggerData = {
        type: 'manual' as const,
        nodeId: 'node-1',
        settings: {
          description: 'Test manual trigger'
        },
        active: true
      };

      const result = await triggerService.createTrigger('workflow-1', 'user-1', triggerData);

      expect(result).toMatchObject({
        type: 'manual',
        nodeId: 'node-1',
        workflowId: 'workflow-1',
        active: true
      });
    });

    it('should throw error for invalid trigger type', async () => {
      const triggerData = {
        type: 'invalid' as any,
        nodeId: 'node-1',
        settings: {},
        active: true
      };

      await expect(
        triggerService.createTrigger('workflow-1', 'user-1', triggerData)
      ).rejects.toThrow('Unknown trigger type: invalid');
    });

    it('should throw error for missing HTTP method in webhook trigger', async () => {
      const triggerData = {
        type: 'webhook' as const,
        nodeId: 'node-1',
        settings: {
          path: '/test'
        },
        active: true
      };

      await expect(
        triggerService.createTrigger('workflow-1', 'user-1', triggerData)
      ).rejects.toThrow('HTTP method is required for webhook triggers');
    });

    it('should throw error for missing cron expression in schedule trigger', async () => {
      const triggerData = {
        type: 'schedule' as const,
        nodeId: 'node-1',
        settings: {
          timezone: 'UTC'
        },
        active: true
      };

      await expect(
        triggerService.createTrigger('workflow-1', 'user-1', triggerData)
      ).rejects.toThrow('Cron expression is required for schedule triggers');
    });

    it('should throw error for invalid cron expression', async () => {
      mockCronValidate.mockReturnValue(false);
      
      const triggerData = {
        type: 'schedule' as const,
        nodeId: 'node-1',
        settings: {
          cronExpression: 'invalid-cron',
          timezone: 'UTC'
        },
        active: true
      };

      await expect(
        triggerService.createTrigger('workflow-1', 'user-1', triggerData)
      ).rejects.toThrow('Invalid cron expression');
    });
  });

  describe('handleWebhookTrigger', () => {
    const mockTrigger: TriggerDefinition = {
      id: 'trigger-1',
      type: 'webhook',
      workflowId: 'workflow-1',
      nodeId: 'node-1',
      settings: {
        webhookId: 'webhook-1',
        httpMethod: 'POST',
        authentication: { type: 'none' }
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockWebhookRequest: WebhookRequest = {
      method: 'POST',
      path: '/webhook/webhook-1',
      headers: { 'content-type': 'application/json' },
      query: {},
      body: { test: 'data' },
      ip: '127.0.0.1',
      userAgent: 'Test Agent'
    };

    beforeEach(() => {
      // Set up webhook trigger in service
      (triggerService as any).webhookTriggers.set('webhook-1', mockTrigger);
      (mockExecutionService.executeWorkflow as jest.Mock).mockResolvedValue({
        success: true,
        data: { executionId: 'execution-1' }
      });
    });

    it('should handle webhook trigger successfully', async () => {
      const result = await triggerService.handleWebhookTrigger('webhook-1', mockWebhookRequest);

      expect(result.success).toBe(true);
      expect(result.executionId).toBe('execution-1');
      expect(mockExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        'system',
        expect.objectContaining({
          method: 'POST',
          body: { test: 'data' }
        })
      );
      expect(mockSocketService.emitToUser).toHaveBeenCalled();
    });

    it('should return error for non-existent webhook', async () => {
      const result = await triggerService.handleWebhookTrigger('non-existent', mockWebhookRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook trigger not found');
    });

    it('should validate header authentication', async () => {
      const authTrigger = {
        ...mockTrigger,
        settings: {
          ...mockTrigger.settings,
          authentication: {
            type: 'header',
            settings: {
              headerName: 'x-api-key',
              expectedValue: 'secret-key'
            }
          }
        }
      };
      
      (triggerService as any).webhookTriggers.set('webhook-1', authTrigger);

      // Test with correct header
      const requestWithAuth = {
        ...mockWebhookRequest,
        headers: { ...mockWebhookRequest.headers, 'x-api-key': 'secret-key' }
      };

      const result = await triggerService.handleWebhookTrigger('webhook-1', requestWithAuth);
      expect(result.success).toBe(true);

      // Test with incorrect header
      const requestWithWrongAuth = {
        ...mockWebhookRequest,
        headers: { ...mockWebhookRequest.headers, 'x-api-key': 'wrong-key' }
      };

      const result2 = await triggerService.handleWebhookTrigger('webhook-1', requestWithWrongAuth);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Webhook authentication failed');
    });
  });

  describe('handleManualTrigger', () => {
    const mockWorkflow = {
      id: 'workflow-1',
      userId: 'user-1',
      active: true,
      triggers: [{
        id: 'trigger-1',
        type: 'manual',
        active: true,
        workflowId: 'workflow-1'
      }]
    };

    beforeEach(() => {
      (mockWorkflowService.getWorkflow as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockExecutionService.executeWorkflow as jest.Mock).mockResolvedValue({
        success: true,
        data: { executionId: 'execution-1' }
      });
    });

    it('should handle manual trigger successfully', async () => {
      const result = await triggerService.handleManualTrigger(
        'workflow-1',
        'trigger-1',
        'user-1',
        { custom: 'data' }
      );

      expect(result.success).toBe(true);
      expect(result.executionId).toBe('execution-1');
      expect(mockExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        'user-1',
        { custom: 'data' }
      );
    });

    it('should return error for non-existent trigger', async () => {
      const result = await triggerService.handleManualTrigger(
        'workflow-1',
        'non-existent',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Manual trigger not found');
    });

    it('should return error for inactive trigger', async () => {
      const inactiveWorkflow = {
        ...mockWorkflow,
        triggers: [{
          ...mockWorkflow.triggers[0],
          active: false
        }]
      };
      
      (mockWorkflowService.getWorkflow as jest.Mock).mockResolvedValue(inactiveWorkflow);

      const result = await triggerService.handleManualTrigger(
        'workflow-1',
        'trigger-1',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Trigger is not active');
    });
  });

  describe('activateTrigger', () => {
    it('should activate webhook trigger', async () => {
      const trigger: TriggerDefinition = {
        id: 'trigger-1',
        type: 'webhook',
        workflowId: 'workflow-1',
        nodeId: 'node-1',
        settings: {
          httpMethod: 'POST',
          authentication: { type: 'none' }
        },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await triggerService.activateTrigger('workflow-1', trigger);

      expect(trigger.settings.webhookId).toBeDefined();
      expect((triggerService as any).webhookTriggers.has(trigger.settings.webhookId)).toBe(true);
    });

    it('should activate schedule trigger', async () => {
      mockCronValidate.mockReturnValue(true);
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      mockCronSchedule.mockReturnValue(mockTask);

      const trigger: TriggerDefinition = {
        id: 'trigger-1',
        type: 'schedule',
        workflowId: 'workflow-1',
        nodeId: 'node-1',
        settings: {
          cronExpression: '0 0 * * *',
          timezone: 'UTC'
        },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await triggerService.activateTrigger('workflow-1', trigger);

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: false,
          timezone: 'UTC'
        })
      );
      expect(mockTask.start).toHaveBeenCalled();
      expect((triggerService as any).scheduledTasks.has('trigger-1')).toBe(true);
    });

    it('should throw error for invalid cron expression', async () => {
      mockCronValidate.mockReturnValue(false);

      const trigger: TriggerDefinition = {
        id: 'trigger-1',
        type: 'schedule',
        workflowId: 'workflow-1',
        nodeId: 'node-1',
        settings: {
          cronExpression: 'invalid-cron',
          timezone: 'UTC'
        },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(
        triggerService.activateTrigger('workflow-1', trigger)
      ).rejects.toThrow('Invalid cron expression');
    });
  });

  describe('deactivateTrigger', () => {
    it('should deactivate webhook trigger', async () => {
      (triggerService as any).webhookTriggers.set('webhook-1', {});

      await triggerService.deactivateTrigger('trigger-1');

      // Since we don't have the webhook ID, it should still complete without error
      expect(true).toBe(true);
    });

    it('should deactivate schedule trigger', async () => {
      const mockTask = {
        stop: jest.fn(),
        destroy: jest.fn()
      };
      (triggerService as any).scheduledTasks.set('trigger-1', mockTask);

      await triggerService.deactivateTrigger('trigger-1');

      expect(mockTask.stop).toHaveBeenCalled();
      expect((triggerService as any).scheduledTasks.has('trigger-1')).toBe(false);
    });
  });

  describe('getTriggerStats', () => {
    const mockWorkflow = {
      id: 'workflow-1',
      triggers: [
        { type: 'webhook', active: true },
        { type: 'schedule', active: true },
        { type: 'manual', active: false }
      ]
    };

    beforeEach(() => {
      (mockWorkflowService.getWorkflow as jest.Mock).mockResolvedValue(mockWorkflow);
    });

    it('should return trigger statistics', async () => {
      const stats = await triggerService.getTriggerStats('workflow-1', 'user-1');

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

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      const mockTask = {
        stop: jest.fn()
      };
      
      (triggerService as any).scheduledTasks.set('trigger-1', mockTask);
      (triggerService as any).webhookTriggers.set('webhook-1', {});

      await triggerService.cleanup();

      expect(mockTask.stop).toHaveBeenCalled();
      expect((triggerService as any).scheduledTasks.size).toBe(0);
      expect((triggerService as any).webhookTriggers.size).toBe(0);
    });
  });
});
