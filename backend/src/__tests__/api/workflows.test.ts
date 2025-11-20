import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../../index';

const prisma = new PrismaClient();

describe('Workflows API', () => {
  let authToken: string;
  let userId: string;
  let workflowId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.workflow.deleteMany({
      where: {
        name: {
          contains: 'Test'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'workflow-test'
        }
      }
    });

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'workflow-test@example.com',
        password: hashedPassword,
        name: 'Workflow Test',
        role: 'USER'
      }
    });
    userId = user.id;

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'workflow-test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.workflow.deleteMany({
      where: {
        name: {
          contains: 'Test'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'workflow-test'
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/workflows', () => {
    it('should create a new workflow successfully', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'A test workflow',
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
        active: false
      };

      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(workflowData.name);
      expect(response.body.data.description).toBe(workflowData.description);
      expect(response.body.data.userId).toBe(userId);
      expect(response.body.data.nodes).toHaveLength(1);

      workflowId = response.body.data.id;
    });

    it('should return error without authentication', async () => {
      const workflowData = {
        name: 'Test Workflow 2',
        description: 'Another test workflow'
      };

      const response = await request(app)
        .post('/api/workflows')
        .send(workflowData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error for missing name', async () => {
      const workflowData = {
        description: 'A workflow without name'
      };

      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/workflows', () => {
    it('should list workflows for authenticated user', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter workflows by search term', async () => {
      const response = await request(app)
        .get('/api/workflows?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((w: any) => 
        w.name.includes('Test') || (w.description && w.description.includes('Test'))
      )).toBe(true);
    });

    it('should paginate workflows correctly', async () => {
      const response = await request(app)
        .get('/api/workflows?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('should get workflow by ID', async () => {
      const response = await request(app)
        .get(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(workflowId);
      expect(response.body.data.name).toBe('Test Workflow');
    });

    it('should return 404 for non-existent workflow', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/workflows/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/workflows/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow successfully', async () => {
      const updateData = {
        name: 'Updated Test Workflow',
        description: 'Updated description',
        active: true
      };

      const response = await request(app)
        .put(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.active).toBe(updateData.active);
    });

    it('should return 404 for non-existent workflow', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/workflows/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('POST /api/workflows/:id/duplicate', () => {
    it('should duplicate workflow successfully', async () => {
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Duplicated Workflow' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Duplicated Workflow');
      expect(response.body.data.id).not.toBe(workflowId);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe('POST /api/workflows/:id/validate', () => {
    it('should validate workflow successfully', async () => {
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBeDefined();
      expect(response.body.data.errors).toBeDefined();
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow successfully', async () => {
      const response = await request(app)
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Workflow deleted successfully');
    });

    it('should return 404 when trying to delete already deleted workflow', async () => {
      const response = await request(app)
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });
});
