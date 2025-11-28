import { NodeExecutionStatus } from "@/types/execution";
import { io, Socket } from "socket.io-client";

export interface ExecutionEventData {
  type:
    | "node-status-update"
    | "execution-progress"
    | "execution-complete"
    | "execution-error"
    | "started"
    | "node-started"
    | "node-completed"
    | "node-failed"
    | "completed"
    | "failed"
    | "cancelled"
    | "execution-log";
  executionId: string;
  nodeId?: string;
  status?: NodeExecutionStatus;
  progress?: number;
  data?: any;
  error?: any;
  timestamp: number | string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  message?: string;
}

export class ExecutionWebSocket {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: ExecutionEventData) => void>> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private baseUrl: string = import.meta.env.VITE_API_URL ||
      "http://localhost:4000"
  ) {}

  /**
   * Connect to the WebSocket server
   */
  connect(token?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // Get authentication token
      if (!token) {
        try {
          const { useAuthStore } = await import("../stores/auth");
          const authStore = useAuthStore.getState();
          token = authStore.token || undefined;
        } catch (error) {
          console.error("Failed to get auth token:", error);
        }
      }

      if (!token) {
        reject(new Error("Authentication token required"));
        return;
      }

      this.socket = io(this.baseUrl, {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
        timeout: 45000,            // Match backend connectTimeout
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        forceNew: true,
      });

      this.socket.on("connect", () => {
        console.log("🟢 ExecutionWebSocket CONNECTED successfully");
        console.log("Socket ID:", this.socket?.id);
        console.log("Socket connected state:", this.socket?.connected);
        this.reconnectAttempts = 0;
        
        // Re-subscribe to all active executions after reconnect
        if (this.listeners.size > 0) {
          console.log("🔄 Re-subscribing to active executions after reconnect");
          this.listeners.forEach((_, executionId) => {
            this.subscribeToExecution(executionId).catch(err => {
              console.error(`Failed to re-subscribe to execution ${executionId}:`, err);
            });
          });
        }
        
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("🔴 ExecutionWebSocket connection error:", error);
        console.log("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        this.handleReconnect();
        reject(error);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("WebSocket disconnected:", reason);
        if (reason === "io server disconnect") {
          // Server initiated disconnect, try to reconnect
          this.handleReconnect();
        }
      });

      // Listen for execution events
      this.socket.on("execution-event", (data: ExecutionEventData) => {
        console.log("🟡 ExecutionWebSocket received execution-event:", data);
        this.handleExecutionEvent(data);
      });

      this.socket.on("node-execution-event", (data: ExecutionEventData) => {
        console.log(
          "🟡 ExecutionWebSocket received node-execution-event:",
          data
        );
        this.handleExecutionEvent(data);
      });

      this.socket.on("execution-progress", (data: ExecutionEventData) => {
        console.log("🟡 ExecutionWebSocket received execution-progress:", data);
        this.handleExecutionEvent(data);
      });

      // Listen for execution logs (tool calls, service calls, etc.)
      this.socket.on("execution-log", (data: any) => {
        console.log("📝 ExecutionWebSocket received execution-log:", data);
        this.handleExecutionEvent({
          ...data,
          type: "execution-log",
        });
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Subscribe to execution updates for a specific execution
   */
  subscribeToExecution(executionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error(
          "🔴 Cannot subscribe to execution - WebSocket not connected"
        );
        console.log("Socket state:", {
          exists: !!this.socket,
          connected: this.socket?.connected,
          id: this.socket?.id,
        });
        reject(new Error("WebSocket not connected"));
        return;
      }

      console.log("🟠 Subscribing to execution:", executionId);
      console.log("Socket state before subscribe:", {
        connected: this.socket.connected,
        id: this.socket.id,
      });

      this.socket.emit("subscribe-execution", executionId, (response: any) => {
        console.log("🟠 Subscribe response:", response);
        if (response?.success !== false) {
          console.log(`✅ Successfully subscribed to execution ${executionId}`);
          resolve();
        } else {
          console.error(
            `❌ Failed to subscribe to execution ${executionId}:`,
            response?.error
          );
          reject(new Error(response?.error || "Subscription failed"));
        }
      });
    });
  }

  /**
   * Unsubscribe from execution updates
   */
  unsubscribeFromExecution(executionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        resolve(); // If not connected, consider it unsubscribed
        return;
      }

      this.socket.emit(
        "unsubscribe-execution",
        executionId,
        (response: any) => {
          if (response?.success !== false) {
            console.log(`Unsubscribed from execution ${executionId}`);
            resolve();
          } else {
            console.error(
              `Failed to unsubscribe from execution ${executionId}:`,
              response?.error
            );
            reject(new Error(response?.error || "Unsubscription failed"));
          }
        }
      );
    });
  }

  /**
   * Add event listener for execution events
   */
  addEventListener(
    executionId: string,
    listener: (data: ExecutionEventData) => void
  ): () => void {
    if (!this.listeners.has(executionId)) {
      this.listeners.set(executionId, new Set());
    }

    this.listeners.get(executionId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const executionListeners = this.listeners.get(executionId);
      if (executionListeners) {
        executionListeners.delete(listener);
        if (executionListeners.size === 0) {
          this.listeners.delete(executionId);
        }
      }
    };
  }

  /**
   * Remove all listeners for an execution
   */
  removeExecutionListeners(executionId: string): void {
    this.listeners.delete(executionId);
  }

  /**
   * Handle incoming execution events
   */
  private handleExecutionEvent(data: ExecutionEventData): void {
    const executionListeners = this.listeners.get(data.executionId);
    if (executionListeners) {
      executionListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error("Error in execution event listener:", error);
        }
      });
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): "connected" | "connecting" | "disconnected" | "error" {
    if (!this.socket) return "disconnected";
    if (this.socket.connected) return "connected";
    if (this.socket.disconnected && !this.socket.connected) return "connecting";
    return "error";
  }

  /**
   * Get the socket instance (for direct emit calls)
   */
  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
export const executionWebSocket = new ExecutionWebSocket();
