# Memory Leak Analysis - Socket & Webhook Connections

## Executive Summary

After analyzing your codebase, I've identified **several potential memory leaks** that could cause "Out of Memory" errors in Chrome when socket connections are active for webhook handling. The issues are primarily related to:

1. **Event buffer accumulation in SocketService**
2. **Unbounded execution context storage**
3. **Missing event listener cleanup**
4. **Large binary data handling in webhooks**

---

## Critical Issues Found

### 🔴 **CRITICAL: Event Buffer Memory Leak in SocketService**

**Location:** `backend/src/services/SocketService.ts`

**Problem:**
```typescript
private executionEventBuffer: Map<string, ExecutionEventData[]> = new Map();
private bufferRetentionMs = 60000; // Keep events for 60 seconds
```

The event buffer stores execution events for late subscribers, but:
- **Buffer grows unbounded** during high webhook traffic
- Each execution can store up to **50 events** (line 598)
- Events are only cleaned up every **5 seconds** (line 63)
- With many concurrent webhook executions, this can accumulate **thousands of events in memory**

**Impact:** High webhook traffic → thousands of buffered events → memory exhaustion

**Fix Required:**
```typescript
// Add maximum buffer size limit
private readonly MAX_BUFFERED_EXECUTIONS = 100; // Limit total executions buffered
private readonly MAX_EVENTS_PER_EXECUTION = 20; // Reduce from 50 to 20

private bufferExecutionEvent(executionId: string, eventData: ExecutionEventData): void {
    // Limit total number of buffered executions
    if (this.executionEventBuffer.size >= this.MAX_BUFFERED_EXECUTIONS) {
        // Remove oldest execution buffer
        const oldestKey = this.executionEventBuffer.keys().next().value;
        this.executionEventBuffer.delete(oldestKey);
        logger.warn(`Event buffer limit reached, removed oldest execution: ${oldestKey}`);
    }

    if (!this.executionEventBuffer.has(executionId)) {
        this.executionEventBuffer.set(executionId, []);
    }

    const buffer = this.executionEventBuffer.get(executionId)!;
    buffer.push(eventData);

    // Reduce max events per execution
    if (buffer.length > this.MAX_EVENTS_PER_EXECUTION) {
        buffer.splice(0, buffer.length - this.MAX_EVENTS_PER_EXECUTION);
    }
}
```

---

### 🔴 **CRITICAL: Unbounded Active Executions Map**

**Location:** `backend/src/services/RealtimeExecutionEngine.ts`

**Problem:**
```typescript
private activeExecutions: Map<string, ExecutionContext> = new Map();

// Cleanup only happens 60 seconds AFTER completion
setTimeout(() => {
    this.activeExecutions.delete(executionId);
}, 60000); // Keep for 1 minute
```

**Issues:**
- No maximum limit on concurrent executions
- Failed executions may not be cleaned up properly
- 60-second delay means high webhook traffic accumulates contexts
- Each context stores `nodeOutputs: Map<string, any>` which can be large

**Impact:** 100 webhook requests/minute → 100+ execution contexts in memory → OOM

**Fix Required:**
```typescript
private readonly MAX_ACTIVE_EXECUTIONS = 50;

async startExecution(...): Promise<string> {
    // Check limit before creating new execution
    if (this.activeExecutions.size >= this.MAX_ACTIVE_EXECUTIONS) {
        // Clean up oldest completed/failed executions
        const toDelete: string[] = [];
        for (const [id, ctx] of this.activeExecutions.entries()) {
            if (ctx.status !== 'running') {
                toDelete.push(id);
                if (toDelete.length >= 10) break; // Remove 10 at a time
            }
        }
        toDelete.forEach(id => this.activeExecutions.delete(id));
        
        if (this.activeExecutions.size >= this.MAX_ACTIVE_EXECUTIONS) {
            throw new Error('Too many concurrent executions. Please try again later.');
        }
    }
    
    // ... rest of code
}

// Reduce cleanup delay
private async completeExecution(executionId: string): Promise<void> {
    // ... existing code ...
    
    // Cleanup immediately for non-test executions
    setTimeout(() => {
        this.activeExecutions.delete(executionId);
    }, 5000); // Reduce from 60s to 5s
}
```

---

### 🟡 **HIGH: Binary Data Memory Issues in Webhooks**

**Location:** `backend/src/routes/webhook.ts`

**Problem:**
```typescript
function buildWebhookRequest(req: Request): any {
    if ((req as any).binaryData) {
        const binaryFiles = (req as any).binaryData;
        if (Array.isArray(binaryFiles)) {
            webhookRequest.binary = {};
            binaryFiles.forEach((file: any) => {
                // Convert buffer to base64 - DOUBLES memory usage!
                const base64Data = Buffer.isBuffer(file.data) 
                    ? file.data.toString('base64')
                    : file.data;
                
                webhookRequest.binary[file.fieldName] = {
                    data: base64Data, // Large base64 strings stored in memory
                    mimeType: file.mimeType,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                };
            });
        }
    }
}
```

**Issues:**
- Binary files are converted to base64 (increases size by ~33%)
- Large files stored entirely in memory
- No size limits enforced
- Data passed through entire execution pipeline

**Impact:** Large file uploads → memory spikes → potential OOM

**Fix Required:**
```typescript
// Add file size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

function buildWebhookRequest(req: Request): any {
    const webhookRequest: any = { /* ... */ };

    if ((req as any).binaryData) {
        const binaryFiles = (req as any).binaryData;
        let totalSize = 0;
        
        if (Array.isArray(binaryFiles)) {
            webhookRequest.binary = {};
            for (const file of binaryFiles) {
                // Check file size
                if (file.fileSize > MAX_FILE_SIZE) {
                    throw new Error(`File ${file.fileName} exceeds maximum size of 10MB`);
                }
                
                totalSize += file.fileSize;
                if (totalSize > MAX_TOTAL_SIZE) {
                    throw new Error('Total upload size exceeds 50MB limit');
                }
                
                // For large files, consider streaming or storing reference instead
                const base64Data = Buffer.isBuffer(file.data) 
                    ? file.data.toString('base64')
                    : file.data;
                
                webhookRequest.binary[file.fieldName] = {
                    data: base64Data,
                    mimeType: file.mimeType,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                };
            }
        }
    }
    
    return webhookRequest;
}
```

---

### 🟡 **HIGH: Missing Event Listener Cleanup**

**Location:** `backend/src/index.ts`

**Problem:**
```typescript
// Event listeners are added but never removed
realtimeExecutionEngine.on("execution-started", (data) => { /* ... */ });
realtimeExecutionEngine.on("node-started", (data) => { /* ... */ });
realtimeExecutionEngine.on("node-completed", (data) => { /* ... */ });
// ... 6 more listeners
```

**Issues:**
- EventEmitter listeners accumulate if services are reinitialized
- No cleanup on shutdown
- Potential memory leak if hot-reloading or service restarts occur

**Fix Required:**
```typescript
// In shutdown handlers
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully...");
    
    // Remove all event listeners
    realtimeExecutionEngine.removeAllListeners();
    
    await nodeLoader.cleanup();
    await socketService.shutdown();
    await scheduleJobManager.shutdown();
    await prisma.$disconnect();
    
    httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
```

---

### 🟡 **MEDIUM: Socket.IO Room Accumulation**

**Location:** `backend/src/services/SocketService.ts`

**Problem:**
- Clients join rooms: `execution:${executionId}`, `workflow:${workflowId}`, `user:${userId}`
- Rooms are not explicitly cleaned up after execution completes
- Socket.IO keeps room metadata in memory

**Fix Required:**
```typescript
// Add method to cleanup execution rooms
public cleanupExecutionRoom(executionId: string): void {
    const room = `execution:${executionId}`;
    
    // Get all sockets in the room
    const socketsInRoom = this.io.sockets.adapter.rooms.get(room);
    
    if (socketsInRoom) {
        // Make all sockets leave the room
        socketsInRoom.forEach(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.leave(room);
            }
        });
        
        logger.debug(`Cleaned up room: ${room}`);
    }
}

// Call this after execution completes
private async completeExecution(executionId: string): Promise<void> {
    // ... existing code ...
    
    // Cleanup room after a short delay
    setTimeout(() => {
        this.activeExecutions.delete(executionId);
        global.socketService?.cleanupExecutionRoom(executionId);
    }, 5000);
}
```

---

## Additional Recommendations

### 1. **Add Memory Monitoring**

```typescript
// Add to backend/src/index.ts
setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    console.log(`📊 Memory: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    
    // Alert if memory usage is high
    if (heapUsedMB > 1024) { // 1GB threshold
        console.warn(`⚠️  High memory usage detected: ${heapUsedMB}MB`);
        
        // Log active resources
        console.log(`Active executions: ${realtimeExecutionEngine.activeExecutions?.size || 0}`);
        console.log(`Connected sockets: ${socketService.getConnectedUsersCount()}`);
        console.log(`Event buffer size: ${socketService.executionEventBuffer?.size || 0}`);
    }
}, 30000); // Every 30 seconds
```

### 2. **Implement Request Rate Limiting**

```typescript
// Add to webhook routes
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each webhook to 100 requests per minute
    message: 'Too many webhook requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

router.all("/:webhookId", webhookLimiter, asyncHandler(async (req, res) => {
    // ... existing code
}));
```

### 3. **Add Execution Queue with Concurrency Limit**

Instead of executing all webhooks immediately, queue them:

```typescript
// Use Bull queue (already in dependencies)
import Queue from 'bull';

const webhookQueue = new Queue('webhook-executions', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    },
});

// Process with concurrency limit
webhookQueue.process(10, async (job) => {
    // Execute webhook
    return await triggerService.handleWebhookTrigger(
        job.data.path,
        job.data.request,
        job.data.testMode
    );
});
```

---

## Testing Recommendations

1. **Load Test Webhooks:**
   ```bash
   # Use Apache Bench or similar
   ab -n 1000 -c 50 http://localhost:4000/webhook/test-webhook
   ```

2. **Monitor Memory During Test:**
   ```bash
   # Watch Node.js memory
   watch -n 1 'ps aux | grep node'
   ```

3. **Check for Memory Leaks:**
   ```bash
   # Use Node.js built-in profiler
   node --inspect backend/dist/index.js
   # Then use Chrome DevTools Memory Profiler
   ```

---

## Priority Implementation Order

1. ✅ **Immediate (Critical):**
   - Add MAX_BUFFERED_EXECUTIONS limit to SocketService
   - Add MAX_ACTIVE_EXECUTIONS limit to RealtimeExecutionEngine
   - Reduce cleanup delays from 60s to 5s

2. ✅ **Short-term (High):**
   - Add file size limits to webhook binary handling
   - Implement proper event listener cleanup
   - Add memory monitoring

3. ✅ **Medium-term (Medium):**
   - Implement webhook rate limiting
   - Add execution room cleanup
   - Consider execution queue with concurrency control

---

## Conclusion

The "Out of Memory" errors are likely caused by **unbounded accumulation** of:
- Event buffers in SocketService
- Active execution contexts in RealtimeExecutionEngine  
- Binary data from webhook file uploads
- Socket.IO rooms that aren't cleaned up

Implementing the critical fixes above should significantly reduce memory usage and prevent OOM errors during high webhook traffic.
