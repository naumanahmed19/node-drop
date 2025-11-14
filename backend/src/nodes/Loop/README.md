# Loop Node - Complete Documentation

**Version**: 1.0.0 (Workflow Loop Implementation)  
**Last Updated**: November 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [How It Works](#how-it-works)
4. [Configuration](#configuration)
5. [Examples](#examples)
6. [Real-time Visualization](#real-time-visualization)
7. [Implementation Details](#implementation-details)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The Loop node creates **true workflow loops** where each iteration flows through downstream nodes before moving to the next iteration. This enables building complex iterative workflows with conditions, API calls, and data processing.

### Key Features

- ✅ **Two Outputs**: "loop" (iterations) and "done" (completion)
- ✅ **Iteration Control**: Process one item at a time through downstream nodes
- ✅ **Real-time Updates**: See progress as each iteration completes
- ✅ **State Management**: Tracks position across iterations
- ✅ **Three Modes**: Repeat N times, Loop over items, Loop over field
- ✅ **Safety Limits**: Maximum 100,000 iterations
- ✅ **Batch Processing**: Group items for better performance

### Architecture

```
Loop Node → Outputs ONE item → Downstream nodes process → Loop continues
         ↓ [loop output]                                ↓ [done output]
    (per iteration)                              (on completion)
```

---

## Quick Start

### Minimal Test Workflow

**Nodes**: Manual Trigger → Loop → Code

**Loop Configuration**:
- Loop Over: "Repeat N Times"
- Number of Iterations: `3`
- Batch Size: `1`

**Code Node**:
```javascript
const data = items[0];
console.log(`Iteration ${data.iteration} of ${data.total}`);
return [data];
```

**Expected Output** (in console):
```
Iteration 1 of 3
Iteration 2 of 3
Iteration 3 of 3
```


---

## How It Works

### Two Outputs Explained

The Loop node has **two connection points**:

1. **Loop Output** (top/first output)
   - Outputs ONE item per iteration
   - Connect to nodes that process each iteration
   - Executes multiple times (once per iteration)
   - Output name: `"loop"`

2. **Done Output** (bottom/second output)
   - Outputs when all iterations complete
   - Connect to nodes that run after loop finishes
   - Executes once at the end
   - Output name: `"done"`

### Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│ Loop Node (Iteration 1)                                 │
│   State: { currentIndex: 0, totalItems: 3 }            │
└────────────────┬────────────────────────────────────────┘
                 │ [loop output]
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Downstream Nodes (If, Code, HTTP, etc.)                │
│   Process iteration 1 data                              │
└────────────────┬────────────────────────────────────────┘
                 │ (completes)
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Loop Node (Iteration 2)                                 │
│   State: { currentIndex: 1, totalItems: 3 }            │
└────────────────┬────────────────────────────────────────┘
                 │ [loop output]
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Downstream Nodes                                        │
│   Process iteration 2 data                              │
└────────────────┬────────────────────────────────────────┘
                 │ (completes)
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Loop Node (Iteration 3)                                 │
│   State: { currentIndex: 2, totalItems: 3 }            │
└────────────────┬────────────────────────────────────────┘
                 │ [loop output]
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Downstream Nodes                                        │
│   Process iteration 3 data                              │
└────────────────┬────────────────────────────────────────┘
                 │ (completes)
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Loop Node (Completion Check)                            │
│   State: { currentIndex: 3, totalItems: 3 }            │
│   currentIndex >= totalItems → DONE                     │
└────────────────┬────────────────────────────────────────┘
                 │ [done output]
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Final Nodes (Summary, Aggregation, etc.)               │
└─────────────────────────────────────────────────────────┘
```

### State Management

The Loop node uses **node state** to track progress:

```typescript
{
  itemsToLoop: any[],      // Array of items to iterate over
  currentIndex: number,    // Current position in array
  totalItems: number       // Total number of items
}
```

State persists across executions within the same workflow run and is automatically cleared on completion.


---

## Configuration

### Loop Over

Determines what to iterate over:

#### 1. Repeat N Times
- **Use Case**: Simple counting loops
- **Range**: 1 to 100,000
- **Input**: Ignores input data
- **Output**: Generates iteration objects

**Example Output**:
```json
{
  "iteration": 1,
  "index": 0,
  "total": 100
}
```

#### 2. All Input Items
- **Use Case**: Process items from previous node
- **Input**: Uses all items from input
- **Output**: Each item with metadata

**Example**:
```
Input: [{ "id": 1 }, { "id": 2 }]
Output (iteration 1): { "id": 1, "$index": 0, "$iteration": 1, "$total": 2 }
```

#### 3. Field Value
- **Use Case**: Extract array from nested object
- **Input**: Extracts array from specified field
- **Supports**: Nested paths (e.g., `data.users`)

**Example**:
```
Input: { "users": [{ "name": "Alice" }, { "name": "Bob" }] }
Field: "users"
Output (iteration 1): { "name": "Alice", "$index": 0, "$iteration": 1, "$total": 2 }
```

### Batch Size

Number of items to process in each iteration:
- **Default**: `1` (one item at a time)
- **Range**: 1 to total items
- **Use Case**: API rate limiting, bulk operations

**Example with Batch Size 2**:
```
Items: [1, 2, 3, 4, 5]
Iteration 1: [1, 2]
Iteration 2: [3, 4]
Iteration 3: [5]
```

### Iteration Metadata

Each iteration outputs rich metadata:

```json
{
  // Original item data (spread)
  "...itemData",
  
  // Metadata fields
  "$index": 0,           // 0-based index
  "$iteration": 1,       // 1-based iteration number
  "$total": 10,          // Total iterations
  "$isFirst": true,      // True on first iteration
  "$isLast": false,      // True on last iteration
  "$batchIndex": 0,      // Index within current batch
  "$batchSize": 1        // Size of current batch
}
```


---

## Examples

### Example 1: Simple Loop with Logging

**Workflow**:
```
Manual Trigger → Loop (Repeat 5) → Code (log) → [done] → Summary
```

**Loop Config**:
- Loop Over: Repeat N Times
- Number of Iterations: 5

**Code Node** (connected to loop output):
```javascript
const data = items[0];
console.log(`Iteration ${data.iteration} of ${data.total}`);
return [data];
```

**Summary Node** (connected to done output):
```javascript
const data = items[0];
console.log('Loop completed!', data);
return [{ status: 'completed', ...data }];
```

---

### Example 2: Loop with Condition

**Workflow**:
```
Manual Trigger → Loop (Repeat 10) → If (iteration == 7) → [true] Found!
                                                         → [false] Continue
                   ↓ [done]
                 Complete
```

**Loop Config**:
- Loop Over: Repeat N Times
- Number of Iterations: 10

**If Node Config**:
- Mode: Simple
- Condition:
  - Key: `{{$json.iteration}}`
  - Expression: equal
  - Value: `7`

**Code Node (True Branch)**:
```javascript
const data = items[0];
console.log('Found iteration 7!', data);
return [data];
```

**Code Node (False Branch)**:
```javascript
const data = items[0];
console.log('Iteration:', data.iteration);
return [data];
```

---

### Example 3: Process Array with Filtering

**Workflow**:
```
Manual Trigger (with users) → Loop (Field: "users") → If (active?) → Process
                                                                    → Skip
                                ↓ [done]
                              All Done
```

**Manual Trigger Config**:
- Allow Custom Data: true
- Default Data:
```json
{
  "users": [
    { "name": "Alice", "age": 30, "active": true },
    { "name": "Bob", "age": 25, "active": false },
    { "name": "Charlie", "age": 35, "active": true }
  ]
}
```

**Loop Config**:
- Loop Over: Field Value
- Field Name: `users`
- Batch Size: 1

**If Node**:
- Key: `{{$json.active}}`
- Expression: equal
- Value: `true`

**Process Active** (True Branch):
```javascript
const user = items[0];
console.log(`Processing active user: ${user.name}, age ${user.age}`);
return [{ ...user, processed: true, timestamp: new Date().toISOString() }];
```

**Skip Inactive** (False Branch):
```javascript
const user = items[0];
console.log(`Skipping inactive user: ${user.name}`);
return [{ ...user, skipped: true }];
```

---

### Example 4: API Pagination

**Workflow**:
```
Manual Trigger → Loop (Repeat 10) → HTTP Request (page={{$json.iteration}})
                                   → Process Data
                   ↓ [done]
                 Aggregate Results
```

**Loop Config**:
- Loop Over: Repeat N Times
- Number of Iterations: 10

**HTTP Request Node**:
- URL: `https://api.example.com/data?page={{$json.iteration}}`
- Method: GET

---

### Example 5: Batch Processing with Delay

**Workflow**:
```
Manual Trigger → Loop (Batch: 10) → HTTP Request (bulk)
                                   → Delay (1 second)
                   ↓ [done]
                 Complete
```

**Loop Config**:
- Loop Over: All Input Items
- Batch Size: 10

This processes 10 items at a time with a 1-second delay between batches.


---

## Real-time Visualization

### Data Preview Node Integration

The Loop node works seamlessly with the Data Preview node for real-time debugging.

**Setup**:
```
Loop → Data Preview (Append Mode: ON) → See iterations accumulate
```

**Data Preview Config**:
- Append Mode: `true`
- Max History Items: `10`
- Preview Format: `json`

**Result**: Each iteration appears in the preview as it completes, not all at once at the end.

### WebSocket Events

Each iteration emits real-time events:

```javascript
// Iteration starts
{
  type: "node-started",
  nodeId: "loop-node-id",
  iteration: 1
}

// Iteration completes
{
  type: "node-completed",
  nodeId: "loop-node-id",
  iteration: 1,
  loopDataLength: 1,
  doneDataLength: 0
}

// Loop completes
{
  type: "node-completed",
  nodeId: "loop-node-id",
  iteration: 4,
  loopDataLength: 0,
  doneDataLength: 1
}
```

### Progress Tracking

Monitor loop progress in real-time:
- UI shows current iteration
- WebSocket updates on each completion
- Data Preview shows accumulated results
- Console logs show iteration details


---

## Implementation Details

### File Structure

```
backend/src/nodes/Loop/
├── Loop.node.ts                 # Main node implementation
├── README.md                    # This file
├── index.ts                     # Export
└── __tests__/                   # Tests

backend/src/services/
├── ExecutionEngine.ts           # Queue-based execution with loop support
├── RealtimeExecutionEngine.ts   # WebSocket execution with loop support
├── NodeService.ts               # Node execution and output standardization
└── SecureExecutionService.ts    # Node state management

backend/src/types/
└── node.types.ts                # Node type definitions (outputNames, state methods)

frontend/src/components/workflow/nodes/
└── DataPreviewNode.tsx          # Real-time preview with append mode

frontend/src/stores/
└── workflow.ts                  # Workflow store with realTimeResults
```

### Key Components

#### 1. Loop Node (`Loop.node.ts`)

**Outputs**:
```typescript
outputs: ["loop", "done"]
outputNames: ["Loop", "Done"]
```

**State Management**:
```typescript
const loopState = this.getNodeState?.() || {};
// ... process iteration ...
this.setNodeState?.(loopState);
```

**Output Format**:
```typescript
return [
  { main: outputItems },  // loop output
  { main: [] }            // done output (empty during iteration)
];
```

#### 2. ExecutionEngine (`ExecutionEngine.ts`)

**Loop Detection**:
```typescript
if (node.type === "loop") {
  await this.executeLoopNode(nodeId, node, graph, context);
}
```

**Loop Execution**:
```typescript
private async executeLoopNode(
  nodeId: string,
  node: Node,
  graph: ExecutionGraph,
  context: ExecutionContext
): Promise<void> {
  // Find loop and done connections
  // Execute loop iterations
  // Execute done-connected nodes
}
```

#### 3. RealtimeExecutionEngine (`RealtimeExecutionEngine.ts`)

**Same loop logic** as ExecutionEngine but with WebSocket events:
```typescript
this.emit("node-completed", {
  executionId,
  nodeId,
  iteration: iterationCount,
  loopDataLength: loopData.length,
  doneDataLength: doneData.length
});
```

#### 4. NodeService (`NodeService.ts`)

**Output Standardization**:
```typescript
private standardizeNodeOutput(
  nodeType: string,
  outputs: NodeOutputData[],
  nodeDefinition?: NodeDefinition
): StandardizedNodeOutput {
  // Map array outputs to named branches
  if (hasMultipleOutputs && nodeDefinition) {
    outputs.forEach((output, index) => {
      const outputName = nodeDefinition.outputs[index];
      branches[outputName] = output.main || [];
    });
  }
}
```

#### 5. SecureExecutionService (`SecureExecutionService.ts`)

**State Storage**:
```typescript
private nodeStates: Map<string, Record<string, any>> = new Map();

// State key format
const stateKey = `${executionId}:${nodeId}`;
```

**Context Methods**:
```typescript
getNodeState: () => {
  return this.nodeStates.get(stateKey) || {};
},
setNodeState: (state: Record<string, any>) => {
  this.nodeStates.set(stateKey, state);
}
```

#### 6. DataPreview Node (`DataPreviewNode.tsx`)

**Real-time Updates**:
```typescript
const { realTimeResults } = useWorkflowStore();
const nodeResult = realTimeResults?.get(id);

// Update on each iteration
useEffect(() => {
  const execData = getDataFromExecution();
  if (execData) {
    const newHistoryCount = execData.previewHistory?.length || 0;
    const shouldUpdate = appendMode 
      ? newHistoryCount !== currentHistoryCount
      : true;
    
    if (shouldUpdate) {
      setPreviewData({ ...execData });
    }
  }
}, [realTimeResults, appendMode, id]);
```

### Critical Implementation Notes

1. **State Key Format**: `${executionId}:${nodeId}` - ensures isolation per execution
2. **Output Mapping**: Array index maps to output name (0 = "loop", 1 = "done")
3. **Branch Detection**: Check `result.data?.branches?.["loop"]` for loop data
4. **Iteration Control**: Loop continues while `loopData.length > 0`
5. **Completion**: Loop ends when `doneData.length > 0`


---

## Testing

### Manual Testing

#### Test 1: Simple Loop
```
Manual Trigger → Loop (Repeat 3) → Code (console.log)
```

**Expected**: See 3 console logs, one per iteration

#### Test 2: Loop with Condition
```
Manual Trigger → Loop (Repeat 10) → If (iteration == 7) → Branch
```

**Expected**: True branch executes once (iteration 7), false branch 9 times

#### Test 3: Array Processing
```
Manual Trigger (with data) → Loop (Field: "users") → Process
```

**Expected**: Each user processed individually

#### Test 4: Real-time Preview
```
Manual Trigger → Loop (Repeat 5) → Data Preview (Append Mode)
```

**Expected**: See 5 iterations appear one by one in preview

### Debugging Tips

1. **Open Browser Console** (F12) to see console.log outputs
2. **Watch WebSocket Events** in Network tab
3. **Check Execution History** in database
4. **Use Data Preview** with Append Mode for visual debugging
5. **Monitor Backend Logs** for iteration progress

### Common Test Scenarios

```javascript
// Test 1: Verify iteration data
const data = items[0];
console.log('Iteration data:', JSON.stringify(data, null, 2));
return [data];

// Test 2: Verify state persistence
const data = items[0];
console.log('Current index:', data.$index, 'Total:', data.$total);
return [data];

// Test 3: Verify completion
const data = items[0];
console.log('Loop completed!', data);
return [{ status: 'completed', totalIterations: data.totalIterations }];
```


---

## Troubleshooting

### Loop Never Completes

**Symptoms**: Loop keeps running indefinitely

**Possible Causes**:
- Done output not connected
- Infinite loop in workflow logic
- Error in downstream nodes

**Solutions**:
1. ✅ Verify done output is connected to a node
2. ✅ Check loop has finite iterations
3. ✅ Review downstream node errors in logs
4. ✅ Check for circular connections

### Loop Produces No Output

**Symptoms**: Error "Loop node produced no output - loop is stuck"

**Possible Causes**:
- Empty input array
- Invalid field name
- State management issue

**Solutions**:
1. ✅ Check input data format
2. ✅ Verify field name is correct (case-sensitive)
3. ✅ Ensure batch size > 0
4. ✅ Check loop mode configuration

### Iterations Skip or Duplicate

**Symptoms**: Some iterations missing or repeated

**Possible Causes**:
- State not persisting correctly
- Multiple executions interfering
- Race condition in execution engine

**Solutions**:
1. ✅ Check execution logs for state updates
2. ✅ Verify single execution running
3. ✅ Review state management in SecureExecutionService

### Performance Degradation

**Symptoms**: Loop slows down over time

**Possible Causes**:
- Memory leak in downstream nodes
- Too many WebSocket events
- Database connection pool exhausted

**Solutions**:
1. ✅ Increase batch size
2. ✅ Optimize downstream nodes
3. ✅ Add delays between iterations
4. ✅ Monitor memory usage

### Data Preview Not Updating

**Symptoms**: Preview shows all data at once after loop completes

**Possible Causes**:
- Append mode not enabled
- realTimeResults not updating
- Component not re-rendering

**Solutions**:
1. ✅ Enable "Append Mode" in Data Preview settings
2. ✅ Check WebSocket connection is active
3. ✅ Verify realTimeResults in workflow store
4. ✅ Check browser console for errors

### Code Node Errors

**Symptoms**: "Cannot read properties of undefined (reading 'iteration')"

**Cause**: Incorrect data access in Code node

**Solution**: Use `items[0]` not `items[0].json`
```javascript
// ✅ Correct
const data = items[0];
console.log(data.iteration);

// ❌ Wrong
const data = items[0].json;  // json is already extracted
```


---

## Future Enhancements

### Planned Features

1. **Loop Variables**
   - Accumulate data across iterations
   - Access previous iteration results
   - Build aggregated outputs

2. **Break/Continue Conditions**
   - Early exit based on conditions
   - Skip iterations conditionally
   - Dynamic iteration control

3. **Parallel Execution**
   - Execute multiple iterations simultaneously
   - Configurable concurrency limit
   - Better performance for independent iterations

4. **Nested Loop Support**
   - Loops within loops
   - Proper state isolation
   - Visual indicators for nesting level

5. **Loop Resume**
   - Resume from specific iteration after failure
   - Checkpoint mechanism
   - Retry failed iterations

6. **Performance Optimizations**
   - Reduce WebSocket event overhead
   - Optimize state storage
   - Batch state updates

### Files to Modify for Future Changes

#### Adding New Loop Modes

**File**: `backend/src/nodes/Loop/Loop.node.ts`
```typescript
// Add new option to loopOver property
options: [
  { name: "Repeat N Times", value: "repeat" },
  { name: "All Input Items", value: "items" },
  { name: "Field Value", value: "field" },
  { name: "NEW MODE", value: "newmode" }  // Add here
]

// Add handling in execute function
if (loopOver === "newmode") {
  // Implementation
}
```

#### Changing Output Names

**File**: `backend/src/nodes/Loop/Loop.node.ts`
```typescript
outputs: ["loop", "done"],
outputNames: ["Loop", "Done"],  // Change display names here
```

**Files to Update**:
- `backend/src/services/ExecutionEngine.ts` (connection checks)
- `backend/src/services/RealtimeExecutionEngine.ts` (connection checks)
- Documentation examples

#### Adding Loop Metadata

**File**: `backend/src/nodes/Loop/Loop.node.ts`
```typescript
// In outputItems mapping
return {
  json: {
    ...item,
    $index: globalIndex,
    $iteration: globalIndex + 1,
    $total: totalItems,
    // Add new metadata here
    $customField: value
  }
};
```

#### Modifying State Structure

**File**: `backend/src/nodes/Loop/Loop.node.ts`
```typescript
// Update state interface
const loopState = {
  itemsToLoop: any[],
  currentIndex: number,
  totalItems: number,
  // Add new state fields here
  customState: any
};
```

#### Changing Execution Logic

**Files**:
- `backend/src/services/ExecutionEngine.ts` - Queue-based execution
- `backend/src/services/RealtimeExecutionEngine.ts` - WebSocket execution

Both files have `executeLoopNode()` method that controls iteration logic.

#### Updating Data Preview Integration

**File**: `frontend/src/components/workflow/nodes/DataPreviewNode.tsx`
```typescript
// Modify real-time update logic
useEffect(() => {
  const execData = getDataFromExecution();
  // Update logic here
}, [realTimeResults, appendMode, id]);
```

**File**: `backend/src/nodes/DataPreview/DataPreview.node.ts`
```typescript
// Modify state management
const nodeState = this.getNodeState?.() || {};
// State handling here
```

---

## Version History

### v1.0.0 (November 2025)
- ✅ Initial workflow loop implementation
- ✅ Two outputs (loop, done)
- ✅ State management
- ✅ Real-time WebSocket updates
- ✅ Data Preview integration
- ✅ Three loop modes
- ✅ Batch processing support

---

## Support

### Getting Help

1. **Check Execution Logs**
   ```sql
   SELECT * FROM "NodeExecution" 
   WHERE "executionId" = 'your-execution-id'
   ORDER BY "startedAt";
   ```

2. **Monitor WebSocket Events**
   - Open browser DevTools → Network → WS
   - Watch for `node-completed` events

3. **Review State**
   - Check backend logs for state updates
   - Verify state key format: `${executionId}:${nodeId}`

4. **Test Incrementally**
   - Start with simple 3-iteration loop
   - Add complexity gradually
   - Test each component separately

### Reporting Issues

Include:
- Workflow JSON
- Execution logs
- Expected vs actual behavior
- Screenshots of UI
- Browser console errors
- Backend logs

---

## License

Part of the Node-Drop workflow automation platform.

---

**End of Documentation**
