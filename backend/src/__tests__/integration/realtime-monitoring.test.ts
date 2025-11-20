import { PrismaClient } from '@prisma/client';
import { Server as HTTPServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { SocketService } from '../../services/SocketService';
import { ExecutionService } from '../../services/ExecutionService';
import { NodeService } from '../../services/NodeService';

describe('Real-time Execution Monitoring Integration', () => {
  let httpServer: HTTPServer;
  let socketService: SocketService;
  let executionService: ExecutionService;
  let nodeService: NodeService;
  let prisma: PrismaClient;
  let clientSocket: ClientSocket;
  let serverPort: number;
  let authToken: string;

  beforeAll(async () => {
    // Setup test environment
    process.env.JWT_SECRET = 'test-secret';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    
    // Create HTTP server and Socket service
    httpServer = new HTTPServer();
    socketService = new SocketService(httpServer);
    
    // Setup database and services
    prisma = new PrismaClient();
    nodeService = new NodeService(prisma);
    executionService = new ExecutionService(prisma, nodeService);
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const address = httpServer.address();
        serverPort = typeof address === 'object' && address ? address.port : 3001;
        resolve();
      });
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: 'test-user', email: 'test@example.com' },
      'test-secret'
    );
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    await socketService.shutdown();
    httpServer.close();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Connect client socket
    clientSocket = Client(`http://localhost:${serverPort}`, {
      auth: { token: authToken }
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Socket Authentication and Connection', () => {
    it('should authenticate and connect successfully', (done) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connected', (data) => {
        expect(data.userId).toBe('test-user');
        expect(data.message).toContain('Successfully connected');
      });
    });

    it('should track connected users', (done) => {
      clientSocket.on('connect', () => {
        const connectedUsers = socketService.getConnectedUsersCount();
        expect(connectedUsers).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('Execution Subscription', () => {
    it('should handle execution subscription and unsubscription', (done) => {
      const executionId = 'test-execution-id';
      let subscribed = false;

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', (data) => {
        expect(data.executionId).toBe(executionId);
        subscribed = true;
        
        // Test unsubscription
        clientSocket.emit('unsubscribe-execution', executionId);
      });

      clientSocket.on('execution-unsubscribed', (data) => {
        expect(data.executionId).toBe(executionId);
        expect(subscribed).toBe(true);
        done();
      });
    });

    it('should track execution subscribers', (done) => {
      const executionId = 'test-execution-id';

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', () => {
        const subscribersCount = socketService.getExecutionSubscribersCount(executionId);
        expect(subscribersCount).toBe(1);
        done();
      });
    });
  });

  describe('Real-time Event Broadcasting', () => {
    it('should broadcast execution events to subscribers', (done) => {
      const executionId = 'test-execution-id';
      const eventData = {
        executionId,
        type: 'started' as const,
        timestamp: new Date()
      };

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', () => {
        // Simulate broadcasting an event
        socketService.broadcastExecutionEvent(executionId, eventData);
      });

      clientSocket.on('execution-event', (data) => {
        expect(data.executionId).toBe(executionId);
        expect(data.type).toBe('started');
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should broadcast execution progress updates', (done) => {
      const executionId = 'test-execution-id';
      const progressData = {
        executionId,
        totalNodes: 5,
        completedNodes: 2,
        failedNodes: 0,
        status: 'running' as const,
        startedAt: new Date()
      };

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', () => {
        socketService.broadcastExecutionProgress(executionId, progressData);
      });

      clientSocket.on('execution-progress', (data) => {
        expect(data.executionId).toBe(executionId);
        expect(data.totalNodes).toBe(5);
        expect(data.completedNodes).toBe(2);
        expect(data.status).toBe('running');
        done();
      });
    });

    it('should broadcast node execution events', (done) => {
      const executionId = 'test-execution-id';
      const nodeId = 'test-node-id';

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', () => {
        socketService.broadcastNodeExecutionEvent(executionId, nodeId, 'completed', { result: 'success' });
      });

      clientSocket.on('node-execution-event', (data) => {
        expect(data.executionId).toBe(executionId);
        expect(data.nodeId).toBe(nodeId);
        expect(data.type).toBe('completed');
        expect(data.data).toEqual({ result: 'success' });
        done();
      });
    });

    it('should broadcast execution logs', (done) => {
      const executionId = 'test-execution-id';
      const logEntry = {
        level: 'info' as const,
        message: 'Test log message',
        nodeId: 'test-node',
        timestamp: new Date()
      };

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-subscribed', () => {
        socketService.broadcastExecutionLog(executionId, logEntry);
      });

      clientSocket.on('execution-log', (data) => {
        expect(data.executionId).toBe(executionId);
        expect(data.level).toBe('info');
        expect(data.message).toBe('Test log message');
        expect(data.nodeId).toBe('test-node');
        done();
      });
    });
  });

  describe('Workflow Subscription', () => {
    it('should handle workflow subscription', (done) => {
      const workflowId = 'test-workflow-id';

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe-workflow', workflowId);
      });

      clientSocket.on('workflow-subscribed', (data) => {
        expect(data.workflowId).toBe(workflowId);
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid subscription requests gracefully', (done) => {
      clientSocket.on('connect', () => {
        // Subscribe with invalid data
        clientSocket.emit('subscribe-execution', null);
        
        // Should still be connected
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });
  });

  describe('Multiple Clients', () => {
    it('should handle multiple clients subscribing to same execution', (done) => {
      const executionId = 'test-execution-id';
      let client1Connected = false;
      let client2Connected = false;
      let eventsReceived = 0;

      // First client
      clientSocket.on('connect', () => {
        client1Connected = true;
        clientSocket.emit('subscribe-execution', executionId);
      });

      clientSocket.on('execution-event', () => {
        eventsReceived++;
        checkCompletion();
      });

      // Second client
      const client2 = Client(`http://localhost:${serverPort}`, {
        auth: { token: authToken }
      });

      client2.on('connect', () => {
        client2Connected = true;
        client2.emit('subscribe-execution', executionId);
      });

      client2.on('execution-event', () => {
        eventsReceived++;
        checkCompletion();
      });

      // Wait for both clients to subscribe, then broadcast event
      setTimeout(() => {
        if (client1Connected && client2Connected) {
          socketService.broadcastExecutionEvent(executionId, {
            executionId,
            type: 'started',
            timestamp: new Date()
          });
        }
      }, 100);

      function checkCompletion() {
        if (eventsReceived === 2) {
          client2.disconnect();
          done();
        }
      }
    });
  });
});
