import { io, Socket } from 'socket.io-client';
import type {
  ExecutionEvent,
  ExecutionProgress,
  ExecutionLogEntry,
  NodeExecutionEvent,
} from '@/types/execution';

// Re-export types for convenience
export type {
  ExecutionEvent,
  ExecutionProgress,
  ExecutionLogEntry,
  NodeExecutionEvent,
};

export type SocketEventHandler<T = any> = (data: T) => void;

export class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<SocketEventHandler>> = new Map();
  private isConnecting = false;

  constructor() {
    // Don't auto-connect in constructor to avoid circular dependency
    // Connection will be initiated when needed
  }

  /**
   * Connect to Socket.io server
   */
  private async connect(token?: string): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Dynamically import to avoid circular dependency
      if (!token) {
        const { useAuthStore } = await import('../stores/auth');
        const authStore = useAuthStore.getState();
        token = authStore.token || undefined;
      }

      if (!token) {
        console.warn('No authentication token available for Socket.io connection');
        return;
      }

      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      this.socket = io(serverUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 45000,            // Match backend connectTimeout
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });

      this.setupEventHandlers();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.emit('socket-connected', { timestamp: new Date() });
    });

    this.socket.on('disconnect', (reason) => {
      this.emit('socket-disconnected', { reason, timestamp: new Date() });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket.io connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🚫 Max reconnection attempts reached');
        this.emit('socket-error', { error: error.message, timestamp: new Date() });
      }
    });

    // Server confirmation events
    this.socket.on('connected', (data) => {
      // Connection confirmed
    });

    // Execution events
    this.socket.on('execution-event', (data: ExecutionEvent) => {
      this.emit('execution-event', data);
    });

    this.socket.on('execution-progress', (data: ExecutionProgress) => {
      this.emit('execution-progress', data);
    });

    this.socket.on('execution-log', (data: ExecutionLogEntry) => {
      this.emit('execution-log', data);
    });

    this.socket.on('node-execution-event', (data: NodeExecutionEvent) => {
      this.emit('node-execution-event', data);
    });

    this.socket.on('execution-status', (data: any) => {
      this.emit('execution-status', data);
    });

    // Subscription confirmation events
    this.socket.on('execution-subscribed', (data) => {
      this.emit('execution-subscribed', data);
    });

    this.socket.on('execution-unsubscribed', (data) => {
      this.emit('execution-unsubscribed', data);
    });

    this.socket.on('workflow-subscribed', (data) => {
      this.emit('workflow-subscribed', data);
    });

    this.socket.on('workflow-unsubscribed', (data) => {
      this.emit('workflow-unsubscribed', data);
    });

    // Webhook test mode event
    this.socket.on('webhook-test-triggered', (data) => {
      this.emit('webhook-test-triggered', data);
    });
  }

  /**
   * Subscribe to execution updates
   */
  public async subscribeToExecution(executionId: string): Promise<void> {
    await this.ensureConnected();
    
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot subscribe to execution');
      return;
    }

    this.socket.emit('subscribe-execution', executionId);
  }

  /**
   * Unsubscribe from execution updates
   */
  public async unsubscribeFromExecution(executionId: string): Promise<void> {
    // Don't wait for connection when unsubscribing - just check if connected
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot unsubscribe from execution');
      return;
    }

    this.socket.emit('unsubscribe-execution', executionId);
  }

  /**
   * Subscribe to workflow updates (all executions of a workflow)
   */
  public async subscribeToWorkflow(workflowId: string): Promise<void> {
    await this.ensureConnected();
    
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot subscribe to workflow');
      return;
    }

    this.socket.emit('subscribe-workflow', workflowId);
  }

  /**
   * Unsubscribe from workflow updates
   */
  public async unsubscribeFromWorkflow(workflowId: string): Promise<void> {
    // Don't wait for connection when unsubscribing - just check if connected
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot unsubscribe from workflow');
      return;
    }

    this.socket.emit('unsubscribe-workflow', workflowId);
  }

  /**
   * Add event listener
   */
  public on<T = any>(event: string, handler: SocketEventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  public off<T = any>(event: string, handler: SocketEventHandler<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Emit event to local handlers
   */
  private emit<T = any>(event: string, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  /**
   * Ensure socket is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.socket || (!this.socket.connected && !this.isConnecting)) {
      await this.connect();
      // Wait for the socket to be initialized after connect() completes
      if (this.socket) {
        await this.waitForConnection();
      }
    } else if (this.socket && !this.socket.connected) {
      // Socket exists but not connected, wait for connection
      await this.waitForConnection();
    }
  }

  /**
   * Wait for socket connection to be established
   */
  private async waitForConnection(timeout: number = 5000): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const onConnect = () => {
        clearTimeout(timeoutId);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeoutId);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        reject(error);
      };

      this.socket.on('connect', onConnect);
      this.socket.on('connect_error', onError);

      // If already connected, resolve immediately
      if (this.socket.connected) {
        clearTimeout(timeoutId);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
        resolve();
      }
    });
  }

  /**
   * Manually reconnect
   */
  public async reconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    } else {
      await this.connect();
    }
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
  }

  /**
   * Update authentication token
   */
  public async updateAuth(token: string): Promise<void> {
    if (this.socket) {
      this.socket.auth = { token };
      await this.reconnect();
    } else {
      await this.connect(token);
    }
  }

  /**
   * Initialize connection with token
   */
  public async initialize(token?: string): Promise<void> {
    if (!this.socket) {
      await this.connect(token);
    }
  }
}

// Create singleton instance
export const socketService = new SocketService();

// React hook for using socket service
export const useSocket = () => {
  return socketService;
};
