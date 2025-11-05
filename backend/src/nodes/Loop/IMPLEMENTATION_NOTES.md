# Loop Node Implementation Notes

## Overview

The Loop node has been upgraded from a simple "output all items" node to a **true workflow loop engine** that supports iteration-by-iteration execution with real-time progress updates.

## Architecture Changes

### 1. Loop Node (`Loop.node.ts`)

**Key Changes:**
- Two outputs: "loop" (iteration data) and "done" (completion signal)
- State management using `getNodeState()` and `setNodeState()`
- Outputs one batch at a time instead of all items at once
- Tracks current iteration position across executions

**Output Format:**
```typescript
// During iteration (loop output)
[
  { main: [{ json: { iteration: 1, $index: 0, ... } }] },  // loop output
  { main: [] }                                               // done output (empty)
]

// When complete (done output)
[
  { main: [] },                                              // loop output (empty)
  { main: [{ json: { completed: true, totalIterations: N } }] } // done output
]
```

### 2. ExecutionEngine (`ExecutionEngine.ts`)

**Key Changes:**
- Detects loop nodes via `node.type === "loop"`
- Special `executeLoopNode()` method handles iteration logic
- Executes downstream nodes for each iteration
- Waits for completion before next iteration
- Supports loop-back connections

**Loop Execution Flow:**
```
1. Execute loop node → get iteration data
2. Check "loop" output → has data?
   YES → Execute downstream nodes → back to step 1
   NO → Check "done" output → execute done-connected nodes
```

### 3. RealtimeExecutionEngine (`RealtimeExecutionEngine.ts`)

**Key Changes:**
- Same loop detection and execution logic as ExecutionEngine
- Real-time WebSocket events for each iteration
- Emits `node-completed` with iteration metadata
- Supports cancellation mid-loop

**WebSocket Events:**
```typescript
// Each iteration emits:
{
  type: "node-completed",
  nodeId: "loop-node-id",
  iteration: 5,
  loopDataLength: 1,
  doneDataLength: 0,
  ...
}
```

### 4. Node Type System (`node.types.ts`)

**Key Changes:**
- Added `outputNames?: string[]` to NodeDefinition
- Added state management methods to NodeExecutionContext:
  - `getNodeState?: () => Record<string, any>`
  - `setNodeState?: (state: Record<string, any>) => void`

### 5. SecureExecutionService (`SecureExecutionService.ts`)

**Key Changes:**
- Added `nodeStates: Map<string, Record<string, any>>` for state storage
- State key format: `${executionId}:${nodeId}`
- State persists across node executions within same workflow run
- Automatically cleaned up after execution

**State Management:**
```typescript
// State is stored per node per execution
const stateKey = `${executionId}:${nodeId}`;
this.nodeStates.set(stateKey, { currentIndex: 5, itemsToLoop: [...] });
```

### 6. NodeService (`NodeService.ts`)

**Key Changes:**
- Passes `nodeId` in execution options for state management
- State is accessible to node execution context

## Execution Flow Example

### Simple Loop (Repeat 3 times)

```
Manual Trigger
  ↓
Loop Node (Repeat 3)
  ↓ [loop output]
Log Node (logs each iteration)
  ↓ [loop continues]
Loop Node (next iteration)
  ↓ [done output after 3 iterations]
Summary Node
```

**Execution Sequence:**
1. Manual Trigger executes → outputs trigger data
2. Loop Node executes (iteration 1)
   - State: `{ currentIndex: 0, totalItems: 3 }`
   - Loop output: `[{ iteration: 1, index: 0, total: 3 }]`
   - Done output: `[]`
3. Log Node executes → logs iteration 1
4. Loop Node executes (iteration 2)
   - State: `{ currentIndex: 1, totalItems: 3 }`
   - Loop output: `[{ iteration: 2, index: 1, total: 3 }]`
   - Done output: `[]`
5. Log Node executes → logs iteration 2
6. Loop Node executes (iteration 3)
   - State: `{ currentIndex: 2, totalItems: 3 }`
   - Loop output: `[{ iteration: 3, index: 2, total: 3 }]`
   - Done output: `[]`
7. Log Node executes → logs iteration 3
8. Loop Node executes (completion check)
   - State: `{ currentIndex: 3, totalItems: 3 }`
   - Loop output: `[]`
   - Done output: `[{ completed: true, totalIterations: 3 }]`
   - State cleared: `{}`
9. Summary Node executes

## State Management Details

### State Lifecycle

1. **Initialization**: First execution of loop node creates state
2. **Iteration**: Each execution updates `currentIndex`
3. **Completion**: State is cleared when loop finishes
4. **Cleanup**: State is removed when execution completes

### State Structure

```typescript
{
  itemsToLoop: any[],      // Array of items to iterate over
  currentIndex: number,    // Current position in array
  totalItems: number       // Total number of items
}
```

### State Persistence

- State persists across node executions within the same workflow run
- State is isolated per execution (different executions don't share state)
- State is automatically cleaned up after execution completes

## Safety Features

### Maximum Iterations
- Hard limit: 100,000 iterations
- Prevents infinite loops
- Throws error if exceeded

### Cancellation Support
- Both engines check `context.cancelled` or `context.status === "cancelled"`
- Loop stops immediately on cancellation
- Partial results are preserved

### Error Handling
- Node execution errors stop the loop
- Error is propagated to execution engine
- Execution marked as failed
- State is preserved for debugging

## Performance Considerations

### Batch Processing
- Default batch size: 1 (one item at a time)
- Can be increased for better performance
- Trade-off: granularity vs. throughput

### WebSocket Updates
- Each iteration emits events
- High iteration counts = many events
- Consider batch size for large datasets

### State Storage
- State stored in memory (Map)
- Cleaned up after execution
- No database overhead during iteration

## Testing Recommendations

### Unit Tests
- Test loop node with different batch sizes
- Test state management (get/set)
- Test completion detection
- Test error handling

### Integration Tests
- Test loop with downstream nodes
- Test loop with branching (If node)
- Test loop cancellation
- Test loop with API calls

### Performance Tests
- Test with 1,000+ iterations
- Test with large batch sizes
- Test WebSocket event throughput
- Test memory usage

## Future Enhancements

### Potential Features
1. **Loop Variables**: Access to accumulated data across iterations
2. **Break Conditions**: Early exit based on conditions
3. **Parallel Execution**: Execute multiple iterations in parallel
4. **Loop Metrics**: Track iteration timing and performance
5. **Nested Loops**: Support for loops within loops
6. **Loop Resume**: Resume from specific iteration after failure

### Backward Compatibility
- Old workflows with loop nodes will need migration
- Consider adding a "legacy mode" option
- Provide migration guide for existing users

## Known Limitations

1. **No Parallel Execution**: Iterations run sequentially
2. **No Loop Variables**: Can't accumulate data across iterations (yet)
3. **No Conditional Break**: Must complete all iterations or error
4. **State in Memory**: State not persisted to database
5. **Single Loop Output**: Can't output to multiple branches simultaneously

## Migration Guide

### For Existing Workflows

**Before (Old Loop Node):**
```
Loop (outputs all 100 items at once)
  ↓
Process Node (receives all 100 items)
```

**After (New Loop Node):**
```
Loop (outputs 1 item at a time)
  ↓ [loop output]
Process Node (receives 1 item, processes, repeats)
  ↓ [done output]
Summary Node (runs after all iterations)
```

### Code Changes Required

1. Update node connections to use "loop" and "done" outputs
2. Adjust downstream nodes to handle single items
3. Add summary/aggregation nodes after "done" output
4. Test with small iteration counts first

## Debugging Tips

### Check Loop State
- Add Data Preview node after loop output
- Inspect `$iteration`, `$index`, `$total` variables
- Monitor WebSocket events for iteration progress

### Common Issues
1. **Loop never completes**: Check done output is connected
2. **Loop outputs empty**: Verify input data format
3. **Loop too slow**: Increase batch size
4. **Loop stuck**: Check for errors in downstream nodes

## References

- Loop Node: `backend/src/nodes/Loop/Loop.node.ts`
- Execution Engine: `backend/src/services/ExecutionEngine.ts`
- Realtime Engine: `backend/src/services/RealtimeExecutionEngine.ts`
- User Guide: `backend/src/nodes/Loop/LOOP_WORKFLOW_GUIDE.md`
