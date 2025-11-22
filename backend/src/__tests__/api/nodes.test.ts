import * as request from 'supertest';
import { app } from '../../index';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Mock user for authentication
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'USER'
};

const authToken = jwt.sign(mockUser, process.env.JWT_SECRET || 'test-secret');

describe('Node API Endpoints', () => {
  beforeAll(async () => {
    // Mock Prisma methods for testing
    jest.spyOn(prisma.nodeType, 'findMany').mockResolvedValue([
      {
        id: '1',
        type: 'http-request',
        displayName: 'HTTP Request',
        name: 'httpRequest',
        group: ['transform'],
        version: 1,
        description: 'Make HTTP requests to any URL',
        defaults: { method: 'GET' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            required: true,
            default: 'GET',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' }
            ]
          }
        ],
        icon: 'fa:globe',
        color: '#2196F3',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    jest.spyOn(prisma.nodeType, 'findUnique').mockResolvedValue({
      id: '1',
      type: 'http-request',
      displayName: 'HTTP Request',
      name: 'httpRequest',
      group: ['transform'],
      version: 1,
      description: 'Make HTTP requests to any URL',
      defaults: { method: 'GET' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Method',
          name: 'method',
          type: 'options',
          required: true,
          default: 'GET',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' }
          ]
        }
      ],
      icon: 'fa:globe',
      color: '#2196F3',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.$disconnect();
  });

  describe('GET /api/nodes', () => {
    it('should return list of node types', async () => {
      const response = await request(app)
        .get('/api/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('type');
      expect(response.body.data[0]).toHaveProperty('displayName');
      expect(response.body.data[0]).toHaveProperty('description');
    });

    it('should filter nodes by category', async () => {
      const response = await request(app)
        .get('/api/nodes?category=transform')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should search nodes by term', async () => {
      const response = await request(app)
        .get('/api/nodes?search=HTTP')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/nodes?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/nodes')
        .expect(401);
    });
  });

  describe('GET /api/nodes/categories', () => {
    it('should return node categories', async () => {
      const response = await request(app)
        .get('/api/nodes/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('displayName');
      expect(response.body.data[0]).toHaveProperty('count');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/nodes/categories')
        .expect(401);
    });
  });

  describe('GET /api/nodes/:type', () => {
    it('should return node schema for existing type', async () => {
      const response = await request(app)
        .get('/api/nodes/http-request')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('type', 'http-request');
      expect(response.body.data).toHaveProperty('displayName');
      expect(response.body.data).toHaveProperty('properties');
      expect(response.body.data.properties).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent node type', async () => {
      jest.spyOn(prisma.nodeType, 'findUnique').mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/nodes/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NODE_TYPE_NOT_FOUND');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/nodes/http-request')
        .expect(401);
    });
  });

  describe('POST /api/nodes/:type/execute', () => {
    it('should execute node with valid parameters', async () => {
      const response = await request(app)
        .post('/api/nodes/json/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parameters: {
            jsonData: '{"test": "value"}'
          },
          inputData: {
            main: [[]]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return error for invalid node execution', async () => {
      const response = await request(app)
        .post('/api/nodes/json/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parameters: {
            jsonData: 'invalid json'
          },
          inputData: {
            main: [[]]
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/nodes/json/execute')
        .send({
          parameters: {},
          inputData: { main: [[]] }
        })
        .expect(401);
    });
  });
});
