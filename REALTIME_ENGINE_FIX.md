# RealtimeExecutionEngine IfElse Branch Fix

## Discovery
You're using **WebSocket execution** which uses `RealtimeExecutionEngine`, not `ExecutionEngine` or `FlowExecutionEngine`!

## The Problem
RealtimeExecutionEngine was executing ALL downstream nodes without checking if they had data from their incoming branch connections.

## The Fix

### 1. Store Connections in Context
Added `connections` to `ExecutionContext` so we can check which branch each connection uses:

```typescript
interface ExecutionContext {
  connections: WorkflowConnection[]; // NEW: Store for branch checking
  nodeOutputs: Map<string, any>;
  // ... other fields
}
```

### 2. Check Branch Data Before Executing Downstream Nodes
Added `willNodeHaveData()` method:

```typescript
private willNodeHaveData(
  sourceNodeId: string,
  targetNodeId: string,
  context: ExecutionContext
): boolean {
  // Find connection to get the branch name (sourceOutput)
  const connection = context.connections.find(
    (conn) => conn.sourceNodeId === sourceNodeId && 
              conn.targetNodeId === targetNodeId
  );
  
  const sourceOutput = context.nodeOutputs.get(sourceNodeId);
  const outputBranch = connection.sourceOutput || "main";
  
  // For branching nodes (IfElse), check if the specific branch has data
  if (sourceOutput.branches) {
    const branchData = sourceOutput.branches[outputBranch];
    return Array.isArray(branchData) && branchData.length > 0;
  }
  
  // Non-branching nodes always have data
  return true;
}
```

### 3. Skip Downstream Nodes Without Data
Modified the downstream execution loop:

```typescript
const downstreamNodes = graph.get(nodeId) || [];

for (const downstreamNodeId of downstreamNodes) {
  // NEW: Check if downstream node will have data
  const willHaveData = this.willNodeHaveData(
    nodeId,
    downstreamNodeId,
    context
  );
  
  if (!willHaveData) {
    logger.info(`Skipping downstream node ${downstreamNodeId} - no data from branch`);
    continue; // SKIP this node
  }
  
  await this.executeNode(...); // Only execute if has data
}
```

### 4. Fixed Input Data Collection
Modified `getNodeInputData()` to use branch data:

```typescript
// Find connections (not just upstream nodes)
const incomingConnections = context.connections.filter(
  (conn) => conn.targetNodeId === nodeId
);

for (const connection of incomingConnections) {
  const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
  const outputBranch = connection.sourceOutput || "main";
  
  // Check branches first for branching nodes
  if (sourceOutput.branches) {
    const branchData = sourceOutput.branches[outputBranch];
    if (Array.isArray(branchData) && branchData.length > 0) {
      inputs.push(...branchData); // Only data from this specific branch
    }
  }
}
```

## How It Works

1. **IfElse Node Executes**
   - Condition: `{{json.test}}` ("go") === "xxxxx" → FALSE
   - Returns: `{ branches: { true: [], false: [{json: {...}}] } }`
   - Stored in `context.nodeOutputs`

2. **Check HTTP Request Node (connected to "true" branch)**
   - `willNodeHaveData()` finds connection with `sourceOutput: "true"`
   - Checks: `branches.true.length` → 0
   - Result: **SKIPPED** (not executed)

3. **Check Anthropic Node (connected to "false" branch)**
   - `willNodeHaveData()` finds connection with `sourceOutput: "false"`
   - Checks: `branches.false.length` → 1
   - Result: **EXECUTED**

## Restart Required

**You MUST restart your backend** for these changes to take effect:

```bash
# Stop backend (Ctrl+C in terminal)
# Start backend
cd backend
npm run dev
```

## Expected Behavior

After restart, when you run your workflow:

✅ Manual Trigger → Executes
✅ JSON Node → Executes  
✅ IfElse Node → Executes (condition evaluates to FALSE)
❌ HTTP Request Node → **SKIPPED** (true branch is empty)
✅ Anthropic Node → **EXECUTES** (false branch has data)

## Logs to Look For

```
[RealtimeExecution] Node node-1762345385129 has 2 downstream nodes
[RealtimeExecution] Checking if node node-1762292488960 will have data...
[RealtimeExecution] Branch 'true' has 0 items
[RealtimeExecution] Skipping downstream node node-1762292488960 - no data from branch
[RealtimeExecution] Branch 'false' has 1 items
[RealtimeExecution] Executing node node-1762294168092 (Anthropic (Claude))
```

## Files Modified

- `backend/src/services/RealtimeExecutionEngine.ts`
  - Added `connections` to `ExecutionContext`
  - Added `willNodeHaveData()` method
  - Modified downstream node execution to skip nodes without data
  - Fixed `getNodeInputData()` to use branch-specific data
