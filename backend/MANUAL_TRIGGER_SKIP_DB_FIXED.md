# Manual Trigger - Skip Database Storage Fixed

## Problem
Manual trigger executions were still creating database records even when `saveExecutionToDatabase: false` was set in workflow settings.

## Root Cause
Manual trigger execution from the frontend goes through a **different execution path**:

```
Frontend → WebSocket → RealtimeExecutionEngine → Database ❌
```

Instead of:

```
Frontend → HTTP API → TriggerService → ExecutionService → Database ✅
```

The `RealtimeExecutionEngine` was **always creating database records** regardless of workflow settings.

## Solution

### 1. Frontend - Pass `saveToDatabase` Option
**File**: `frontend/src/stores/workflow.ts` (line ~1250)

```typescript
executionWebSocket.getSocket()?.emit(
  "start-workflow-execution",
  {
    workflowId: workflow.id,
    triggerData,
    triggerNodeId: nodeId,
    workflowData: {
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
    },
    options: {
      timeout: 300000,
      manual: true,
      saveToDatabase: workflow.settings?.saveExecutionToDatabase !== false, // ✅ Added
    },
  },
  // ...
);
```

### 2. Backend - SocketService Pass Options
**File**: `backend/src/services/SocketService.ts` (line ~670)

```typescript
const executionId = await globalAny.realtimeExecutionEngine.startExecution(
  data.workflowId,
  socket.userId,
  data.triggerNodeId,
  data.triggerData,
  data.workflowData.nodes,
  data.workflowData.connections,
  data.options // ✅ Pass options including saveToDatabase
);
```

### 3. Backend - RealtimeExecutionEngine Accept Options
**File**: `backend/src/services/RealtimeExecutionEngine.ts`

#### Updated Method Signature (line ~87)
```typescript
async startExecution(
    workflowId: string,
    userId: string,
    triggerNodeId: string,
    triggerData: any,
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    options?: { saveToDatabase?: boolean } // ✅ Added
): Promise<string>
```

#### Updated ExecutionContext Interface (line ~35)
```typescript
interface ExecutionContext {
    executionId: string;
    workflowId: string;
    userId: string;
    triggerData: any;
    nodeOutputs: Map<string, any>;
    connections: WorkflowConnection[];
    status: "running" | "completed" | "failed" | "cancelled";
    startTime: number;
    currentNodeId?: string;
    saveToDatabase?: boolean; // ✅ Added
}
```

#### Skip Database Operations (multiple locations)
```typescript
// Execution record
const saveToDatabase = options?.saveToDatabase !== false;
if (saveToDatabase) {
    await this.prisma.execution.create({ /* ... */ });
} else {
    console.log(`⏭️ Skipping database save for realtime execution ${executionId}`);
}

// Node execution records
let nodeExecution: any = null;
if (context.saveToDatabase !== false) {
    nodeExecution = await this.prisma.nodeExecution.create({ /* ... */ });
}

// Node execution updates
if (context.saveToDatabase !== false && nodeExecution) {
    await this.prisma.nodeExecution.update({ /* ... */ });
}

// Execution completion
if (context.saveToDatabase !== false) {
    await this.prisma.execution.update({ /* ... */ });
}
```

## Files Modified

1. **frontend/src/stores/workflow.ts**
   - Pass `saveToDatabase` option in WebSocket execution request

2. **backend/src/services/SocketService.ts**
   - Pass options to RealtimeExecutionEngine

3. **backend/src/services/RealtimeExecutionEngine.ts**
   - Accept `options` parameter in `startExecution()`
   - Store `saveToDatabase` in ExecutionContext
   - Conditionally skip all database operations:
     - Execution record creation
     - Node execution record creation
     - Node execution updates (success/error)
     - Execution completion/failure/cancellation updates

## Testing

### Test Case: Manual Trigger with saveExecutionToDatabase: false

```bash
# Setup
1. Open workflow in frontend
2. Go to Settings → Toggle "Save Execution History" OFF
3. Save workflow
4. Click "Execute" button

# Expected Result
✅ Execution runs successfully
✅ Real-time updates via WebSocket
✅ No database records created
✅ Log: "⏭️ Skipping database save for realtime execution {executionId}"

# Verification
SELECT COUNT(*) FROM "Execution" WHERE "workflowId" = 'your-workflow-id';
-- Should return 0

SELECT COUNT(*) FROM "NodeExecution" 
WHERE "executionId" IN (
  SELECT "id" FROM "Execution" WHERE "workflowId" = 'your-workflow-id'
);
-- Should return 0
```

## Execution Paths Comparison

### Before Fix

| Trigger Type | Execution Path | Respects Setting? |
|--------------|----------------|-------------------|
| Manual (Frontend) | WebSocket → RealtimeExecutionEngine | ❌ No |
| Webhook | HTTP → TriggerService → ExecutionService | ✅ Yes |
| Schedule | TriggerService → ExecutionService | ✅ Yes |

### After Fix

| Trigger Type | Execution Path | Respects Setting? |
|--------------|----------------|-------------------|
| Manual (Frontend) | WebSocket → RealtimeExecutionEngine | ✅ **Yes** |
| Webhook | HTTP → TriggerService → ExecutionService | ✅ Yes |
| Schedule | TriggerService → ExecutionService | ✅ Yes |

## Benefits

✅ **Consistent Behavior** - All trigger types now respect `saveExecutionToDatabase` setting

✅ **No Breaking Changes** - Default behavior unchanged (saves to database)

✅ **Performance** - Reduced database load for high-frequency manual executions

✅ **Real-time Updates** - WebSocket events still work regardless of database save

## Notes

- Real-time WebSocket updates continue to work even when database save is skipped
- Frontend still receives execution progress and node completion events
- Execution history UI won't show executions when `saveExecutionToDatabase: false`
- This is expected behavior - the setting is working as designed

## Status

✅ **Complete** - Manual trigger now fully supports `saveExecutionToDatabase: false`
