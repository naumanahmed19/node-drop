import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socket';
import type { ExecutionEvent, ExecutionProgress, ExecutionLogEntry, NodeExecutionEvent } from '@/types/execution';

export interface ExecutionMonitoringState {
  isConnected: boolean;
  currentExecution: string | null;
  executionEvents: ExecutionEvent[];
  executionProgress: ExecutionProgress | null;
  executionLogs: ExecutionLogEntry[];
  nodeEvents: NodeExecutionEvent[];
  connectionStatus: {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  };
}

export interface ExecutionMonitoringActions {
  subscribeToExecution: (executionId: string) => Promise<void>;
  unsubscribeFromExecution: (executionId: string) => Promise<void>;
  subscribeToWorkflow: (workflowId: string) => Promise<void>;
  unsubscribeFromWorkflow: (workflowId: string) => Promise<void>;
  clearExecutionData: () => void;
  reconnect: () => Promise<void>;
}

export const useExecutionMonitoring = (): ExecutionMonitoringState & ExecutionMonitoringActions => {
  const [state, setState] = useState<ExecutionMonitoringState>({
    isConnected: false,
    currentExecution: null,
    executionEvents: [],
    executionProgress: null,
    executionLogs: [],
    nodeEvents: [],
    connectionStatus: {
      connected: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5
    }
  });

  // Update connection status
  const updateConnectionStatus = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: socketService.isConnected(),
      connectionStatus: socketService.getConnectionStatus()
    }));
  }, []);

  // Handle execution events
  const handleExecutionEvent = useCallback((event: ExecutionEvent) => {
    setState(prev => ({
      ...prev,
      executionEvents: [...prev.executionEvents, event].slice(-100) // Keep last 100 events
    }));
  }, []);

  // Handle execution progress
  const handleExecutionProgress = useCallback((progress: ExecutionProgress) => {
    setState(prev => ({
      ...prev,
      executionProgress: progress
    }));
  }, []);

  // Handle execution logs
  const handleExecutionLog = useCallback((log: ExecutionLogEntry) => {
    setState(prev => ({
      ...prev,
      executionLogs: [...prev.executionLogs, log].slice(-500) // Keep last 500 logs
    }));
  }, []);

  // Handle node execution events
  const handleNodeExecutionEvent = useCallback((nodeEvent: NodeExecutionEvent) => {
    setState(prev => ({
      ...prev,
      nodeEvents: [...prev.nodeEvents, nodeEvent].slice(-200) // Keep last 200 node events
    }));
  }, []);

  // Handle socket connection events
  const handleSocketConnected = useCallback(() => {
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  const handleSocketDisconnected = useCallback(() => {
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  const handleSocketError = useCallback(() => {
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  // Subscribe to execution
  const subscribeToExecution = useCallback(async (executionId: string) => {
    setState(prev => ({ ...prev, currentExecution: executionId }));
    await socketService.subscribeToExecution(executionId);
  }, []);

  // Unsubscribe from execution
  const unsubscribeFromExecution = useCallback(async (executionId: string) => {
    setState(prev => ({ 
      ...prev, 
      currentExecution: prev.currentExecution === executionId ? null : prev.currentExecution 
    }));
    await socketService.unsubscribeFromExecution(executionId);
  }, []);

  // Subscribe to workflow
  const subscribeToWorkflow = useCallback(async (workflowId: string) => {
    await socketService.subscribeToWorkflow(workflowId);
  }, []);

  // Unsubscribe from workflow
  const unsubscribeFromWorkflow = useCallback(async (workflowId: string) => {
    await socketService.unsubscribeFromWorkflow(workflowId);
  }, []);

  // Clear execution data
  const clearExecutionData = useCallback(() => {
    setState(prev => ({
      ...prev,
      executionEvents: [],
      executionProgress: null,
      executionLogs: [],
      nodeEvents: []
    }));
  }, []);

  // Reconnect
  const reconnect = useCallback(async () => {
    await socketService.reconnect();
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Socket connection events
    socketService.on('socket-connected', handleSocketConnected);
    socketService.on('socket-disconnected', handleSocketDisconnected);
    socketService.on('socket-error', handleSocketError);

    // Execution monitoring events
    socketService.on('execution-event', handleExecutionEvent);
    socketService.on('execution-progress', handleExecutionProgress);
    socketService.on('execution-log', handleExecutionLog);
    socketService.on('node-execution-event', handleNodeExecutionEvent);

    // Initial connection status
    updateConnectionStatus();

    return () => {
      // Cleanup event listeners
      socketService.off('socket-connected', handleSocketConnected);
      socketService.off('socket-disconnected', handleSocketDisconnected);
      socketService.off('socket-error', handleSocketError);
      socketService.off('execution-event', handleExecutionEvent);
      socketService.off('execution-progress', handleExecutionProgress);
      socketService.off('execution-log', handleExecutionLog);
      socketService.off('node-execution-event', handleNodeExecutionEvent);
    };
  }, [
    handleSocketConnected,
    handleSocketDisconnected,
    handleSocketError,
    handleExecutionEvent,
    handleExecutionProgress,
    handleExecutionLog,
    handleNodeExecutionEvent,
    updateConnectionStatus
  ]);

  return {
    ...state,
    subscribeToExecution,
    unsubscribeFromExecution,
    subscribeToWorkflow,
    unsubscribeFromWorkflow,
    clearExecutionData,
    reconnect
  };
};

// Hook for monitoring a specific execution
export const useExecutionMonitor = (executionId: string | null) => {
  const monitoring = useExecutionMonitoring();

  useEffect(() => {
    if (executionId && monitoring.isConnected) {
      monitoring.subscribeToExecution(executionId);
      
      return () => {
        monitoring.unsubscribeFromExecution(executionId);
      };
    }
  }, [executionId, monitoring.isConnected]);

  return {
    ...monitoring,
    isMonitoring: monitoring.currentExecution === executionId
  };
};

// Hook for monitoring workflow executions
export const useWorkflowMonitor = (workflowId: string | null) => {
  const monitoring = useExecutionMonitoring();

  useEffect(() => {
    if (workflowId && monitoring.isConnected) {
      monitoring.subscribeToWorkflow(workflowId);
      
      return () => {
        monitoring.unsubscribeFromWorkflow(workflowId);
      };
    }
  }, [workflowId, monitoring.isConnected]);

  return monitoring;
};
