# IfElse Node Branch Execution Fix

## Problem
The IfElse node was executing both the "true" and "false" branches simultaneously after condition evaluation, instead of executing only one branch based on the condition result.

## Root Causes
There were THREE critical issues causing both branches to execute:

### Issue 1: Branch Data Lost When Storing Node Outputs (CRITICAL)
The execution engine was storing only `[{ main: result.data.main }]` in the context, which **completely lost the branch information**. This meant the `branches` property containing the separate "true" and "false" data was discarded.

```typescript
// BEFORE (WRONG) - Lost branch data
const outputData = result.data ? [{ main: result.data.main }] : [];
context.nodeOutputs.set(nodeId, outputData);

// AFTER (CORRECT) - Preserves branch data
if (result.data) {
  context.nodeOutputs.set(nodeId, result.data as any);
}
```

### Issue 2: Topological Execution Without Branch Awareness
The execution engine used topological sort to determine ALL nodes to execute upfront, then executed them sequentially without checking if they should actually run based on branch conditions.

### Issue 3: Branch Data Not Respected in Input Preparation
When collecting input data for a node from its source nodes, the code was:

1. Collecting data from ALL incoming connections
2. Not respecting the specific output branch (sourceOutput) specified in the connection
3. For branching nodes like IfElse, this meant both "true" and "false" branch data were being passed to downstream nodes

## Solution

### Fix 1: Preserve Branch Data in Context (CRITICAL FIX)
Changed how node outputs are stored in the execution context to preserve the full standardized output including branches:

```typescript
// OLD CODE - Lost branch information
const outputData = result.data ? [{ main: result.data.main }] : [];
context.nodeOutputs.set(nodeId, outputData);

// NEW CODE - Preserves full output including branches
if (result.data) {
  context.nodeOutputs.set(nodeId, result.data as any);
}
```

This ensures that when an IfElse node returns:
```typescript
{
  main: [...],
  branches: {
    true: [...],
    false: [...]
  },
  metadata: { hasMultipleBranches: true }
}
```

The entire structure is preserved in the context, not just the `main` array.

### Fix 2: Added Branch-Aware Node Execution Check
Added a new `shouldExecuteNode` method that checks if a node should execute based on whether its incoming branch connections have data:

```typescript
private shouldExecuteNode(
  nodeId: string,
  graph: ExecutionGraph,
  context: ExecutionContext
): boolean {
  const incomingConnections = graph.connections.filter(
    (conn) => conn.targetNodeId === nodeId
  );

  // Trigger nodes always execute
  if (incomingConnections.length === 0) {
    return true;
  }

  // Check if any incoming connection has data
  for (const connection of incomingConnections) {
    const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
    if (!sourceOutput) continue;

    const hasBranches = (sourceOutput as any).branches;

    if (hasBranches) {
      // For branching nodes, check if the specific branch has data
      const branchName = connection.sourceOutput || "main";
      const branchData = (sourceOutput as any).branches?.[branchName] || [];
      if (branchData.length > 0) return true;
    } else {
      // For standard nodes, check if main output has data
      const outputItems = (sourceOutput as any).main || [];
      if (outputItems.length > 0) return true;
    }
  }

  return false; // No data from any incoming connection
}
```

This method is called in `executeNodesInOrder` before executing each node, allowing nodes to be skipped if their incoming branches have no data.

### Fix 3: Modified Input Data Preparation
Modified the `prepareNodeInputData` method in `backend/src/services/ExecutionEngine.ts` to:

1. **Check if the source node has branches**: Look for the `branches` property in the source output
2. **Use branch-specific data**: When branches exist, extract data only from the specific branch indicated by `connection.sourceOutput`
3. **Log branch selection**: Added debug logging to track which branch data is being used

### Code Changes

```typescript
// OLD CODE - collected all data without checking branches
for (const connection of incomingConnections) {
  const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
  if (sourceOutput) {
    const outputItems = (sourceOutput as any).main || [];
    sourceData.push(...outputItems);
  }
}

// NEW CODE - respects branch outputs
for (const connection of incomingConnections) {
  const sourceOutput = context.nodeOutputs.get(connection.sourceNodeId);
  
  if (sourceOutput) {
    // Check if this is a branching node (has branches property)
    const hasBranches = (sourceOutput as any).branches;
    
    if (hasBranches) {
      // For branching nodes (like IfElse), only use data from the specific output branch
      const branchName = connection.sourceOutput || "main";
      const branchData = (sourceOutput as any).branches?.[branchName] || [];
      
      logger.debug(`Using branch data from ${connection.sourceNodeId}`, {
        branchName,
        itemCount: branchData.length,
        availableBranches: Object.keys((sourceOutput as any).branches || {}),
      });
      
      sourceData.push(...branchData);
    } else {
      // For standard nodes, use main output
      const outputItems = (sourceOutput as any).main || [];
      sourceData.push(...outputItems);
    }
  }
}
```

## How It Works

1. **IfElse Node Execution**: The IfElse node evaluates conditions and returns:
   - `[{ true: [items] }, { false: [] }]` when condition is true
   - `[{ true: [] }, { false: [items] }]` when condition is false

2. **Output Standardization**: NodeService's `standardizeNodeOutput` method converts this to:
   ```typescript
   {
     main: [...], // Combined for backward compatibility
     branches: {
       true: [...],
       false: [...]
     },
     metadata: { hasMultipleBranches: true }
   }
   ```

3. **Connection Routing**: Each connection has a `sourceOutput` field that specifies which branch to use:
   - Connection from IfElse "true" output → `sourceOutput: "true"`
   - Connection from IfElse "false" output → `sourceOutput: "false"`

4. **Input Preparation**: When preparing input for the next node, the engine now:
   - Checks if source has branches
   - Uses only the data from the specified branch
   - Ignores data from other branches

## Result
Now when an IfElse node evaluates a condition:
- Only the "true" branch executes if condition is true
- Only the "false" branch executes if condition is false
- Never both branches at the same time

## Testing
To test this fix:
1. Create a workflow with an IfElse node
2. Connect different nodes to the "true" and "false" outputs
3. Execute the workflow
4. Verify that only one branch executes based on the condition

## Common Issues

### Condition Expression Syntax
When using the IfElse node, make sure your condition key references the correct data structure:

**Incorrect:**
```json
{
  "key": "{{json[2].test}}"  // Trying to access array index when data is an object
}
```

**Correct:**
```json
{
  "key": "{{json.test}}"  // Access object property directly
}
```

Or if you have an array of items:
```json
{
  "key": "{{json[0].test}}"  // Access first item in array
}
```

## Files Modified

### `backend/src/services/FlowExecutionEngine.ts` (PRIMARY FIX - This is the engine actually used!)
- **Added `willNodeHaveInputData()` method** to check if nodes will have data from incoming branches before queuing them
- **Modified `queueDependentNodes()`** to skip nodes connected to empty branches (marks them as SKIPPED)
- **Fixed `collectNodeInputData()`** to check `outputData.branches[sourceOutput]` first for branching nodes
- **Added extensive logging** to trace branch data flow

### `backend/src/services/ExecutionEngine.ts` (Secondary - for queue-based execution)
- Added `shouldExecuteNode` method to check if nodes should execute based on branch data
- Modified `executeNodesInOrder` to skip nodes without incoming data
- Fixed `prepareNodeInputData` method to respect branch outputs
- Fixed node output storage to preserve branch data
