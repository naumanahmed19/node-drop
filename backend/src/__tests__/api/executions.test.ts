import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../../index';

const prisma = new PrismaClient();

describe('Executions API', () => {
  let authToken: string;
  let userId: string;
  let workflowId: string;
  let executionId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.execution.deleteMany({});
    await prisma.workflow.deleteMany({
      where: {
        name: {
          contains: 'Execution Test'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'executions-test'
        }
      }
    });

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'executions-test@example.com',
        password: hashedPassword,
        name: 'Executions Test',
        role: 'USER'
      }
    });
    userId = user.id;

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'executions-test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        name: 'Execution Test Workflow',
        description: 'A workflow for testing executions',
        userId,
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
        connections: [],
        triggers: [],
        settings: {},
        active: true
      }
    });
    workflowId = workflow.id;

    // Create test execution
    const execution = await prisma.execution.create({
      data: {
        workflowId,
        status: 'SUCCESS',
        startedAt: new Date(),
        finishedAt: new Date(),
        triggerData: { test: 'data' }
      }
    });
    executionId = execution.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.execution.deleteMany({});
    await prisma.workflow.deleteMany({
      where: {
        name: {
          contains: 'Execution Test'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'executions-test'
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('GET /api/executions', () => {
    it('should return list of executions for authenticated user', async () => {
      const response = await request(app)
        .get('/api/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check execution structure
      const execution = response.body.data[0];
      expect(execution).toHaveProperty('id');
      expect(execution).toHaveProperty('workflowId');
      expect(execution).toHaveProperty('status');
      expect(execution).toHaveProperty('startedAt');
      expect(execution).toHaveProperty('workflow');
    });

    it('should filter executions by workflow ID', async () => {
      const response = await request(app)
        .get(`/api/executions?workflowId=${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((exec: any) => 
        exec.workflowId === workflowId
      )).toBe(true);
    });

    it('should filter executions by status', async () => {
      const response = await request(app)
        .get('/api/executions?status=SUCCESS')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((exec: any) => 
        exec.status === 'SUCCESS'
      )).toBe(true);
    });

    it('should paginate executions correctly', async () => {
      const response = await request(app)
        .get('/api/executions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/executions')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/executions/:id', () => {
    it('should return execution details by ID', async () => {
      const response = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(executionId);
      expect(response.body.data.workflowId).toBe(workflowId);
      expect(response.body.data.workflow).toBeDefined();
      expect(response.body.data.nodeExecutions).toBeDefined();
    });

    it('should return 404 for non-existent execution', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/executions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXECUTION_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/executions/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/executions/${executionId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/executions/:id/cancel', () => {
    let runningExecutionId: string;

    beforeAll(async () => {
      // Create a running execution for testing
      const runningExecution = await prisma.execution.create({
        data: {
          workflowId,
          status: 'RUNNING',
          startedAt: new Date(),
          triggerData: { test: 'data' }
        }
      });
      runningExecutionId = runningExecution.id;
    });

    it('should cancel running execution successfully', async () => {
      const response = await request(app)
        .post(`/api/executions/${runningExecutionId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
      expect(response.body.data.finishedAt).toBeDefined();
    });

    it('should return error when trying to cancel non-running execution', async () => {
      const response = await request(app)
        .post(`/api/executions/${executionId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXECUTION_NOT_RUNNING');
    });

    it('should return 404 for non-existent execution', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .post(`/api/executions/${fakeId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXECUTION_NOT_FOUND');
    });
  });

  describe('DELETE /api/executions/:id', () => {
    let deletableExecutionId: string;

    beforeAll(async () => {
      // Create an execution for deletion testing
      const deletableExecution = await prisma.execution.create({
        data: {
          workflowId,
          status: 'SUCCESS',
          startedAt: new Date(),
          finishedAt: new Date(),
          triggerData: { test: 'data' }
        }
      });
      deletableExecutionId = deletableExecution.id;
    });

    it('should delete execution successfully', async () => {
      const response = await request(app)
        .delete(`/api/executions/${deletableExecutionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Execution deleted successfully');
    });

    it('should return 404 when trying to delete already deleted execution', async () => {
      const response = await request(app)
        .delete(`/api/executions/${deletableExecutionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXECUTION_NOT_FOUND');
    });

    it('should return error when trying to delete running execution', async () => {
      // Create a running execution
      const runningExecution = await prisma.execution.create({
        data: {
          workflowId,
          status: 'RUNNING',
          startedAt: new Date(),
          triggerData: { test: 'data' }
        }
      });

      const response = await request(app)
        .delete(`/api/executions/${runningExecution.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXECUTION_RUNNING');
    });
  });
});
