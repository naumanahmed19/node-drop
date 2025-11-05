# Loop Node Test Workflows

This directory contains sample workflows to test the Loop node functionality.

## Test Workflows

### 1. Simple Loop Test (`sample-simple-loop.json`)

**Purpose**: Basic loop functionality test

**What it does**:
- Loops 5 times
- Logs each iteration number
- Completes with a summary

**Expected Output**:
```
Iteration 1 of 5
Iteration 2 of 5
Iteration 3 of 5
Iteration 4 of 5
Iteration 5 of 5
Loop finished! { completed: true, totalIterations: 5 }
```

**Workflow Structure**:
```
Manual Trigger
  ↓
Loop (5 times)
  ↓ [loop output]
Log Iteration
  ↓ [done output]
Complete
```

---

### 2. Loop with Condition (`sample-loop-workflow.json`)

**Purpose**: Test loop with conditional branching

**What it does**:
- Loops 10 times
- Checks if iteration equals 7
- Takes different actions based on condition
- Completes after all iterations

**Expected Output**:
```
Iteration: 1
Iteration: 2
Iteration: 3
Iteration: 4
Iteration: 5
Iteration: 6
Found iteration 7!
Iteration: 8
Iteration: 9
Iteration: 10
Loop completed! { completed: true, totalIterations: 10 }
```

**Workflow Structure**:
```
Manual Trigger
  ↓
Loop (10 times)
  ↓ [loop output]
If (iteration == 7)
  ↓ [true]           ↓ [false]
Log "Found 7!"    Log "Continue"
  ↓ [done output]
Loop Complete
```

---

### 3. Array Loop Test (`sample-array-loop.json`)

**Purpose**: Test looping over array data with filtering

**What it does**:
- Starts with array of users
- Loops over each user
- Processes active users
- Skips inactive users
- Completes with summary

**Input Data**:
```json
{
  "users": [
    { "name": "Alice", "age": 30, "active": true },
    { "name": "Bob", "age": 25, "active": false },
    { "name": "Charlie", "age": 35, "active": true }
  ]
}
```

**Expected Output**:
```
Processing active user: Alice, age 30
Skipping inactive user: Bob
Processing active user: Charlie, age 35
All users processed! { totalIterations: 3 }
```

**Workflow Structure**:
```
Manual Trigger (with user data)
  ↓
Loop (over users field)
  ↓ [loop output]
If (user.active == true)
  ↓ [true]              ↓ [false]
Process Active User   Skip Inactive User
  ↓ [done output]
All Users Processed
```

---

## How to Import and Test

### Method 1: Via API

```bash
# Import workflow
curl -X POST http://localhost:3000/api/workflows/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @sample-simple-loop.json

# Execute workflow
curl -X POST http://localhost:3000/api/workflows/{workflowId}/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Method 2: Via Frontend

1. Open your workflow builder
2. Click "Import Workflow"
3. Select one of the JSON files
4. Click "Execute" to run the workflow
5. Watch the real-time execution in the UI

### Method 3: Via Database

```sql
-- Insert workflow directly into database
INSERT INTO "Workflow" (id, name, description, nodes, connections, active, "userId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Simple Loop Test',
  'Test workflow for loop functionality',
  '[...]'::jsonb,  -- paste nodes from JSON
  '[...]'::jsonb,  -- paste connections from JSON
  true,
  'your-user-id',
  NOW(),
  NOW()
);
```

---

## Testing Checklist

### Basic Functionality
- [ ] Loop executes correct number of iterations
- [ ] Each iteration receives correct data
- [ ] Loop completes and triggers "done" output
- [ ] Iteration metadata is correct ($iteration, $index, $total)

### Conditional Logic
- [ ] If node correctly evaluates iteration data
- [ ] True branch executes when condition met
- [ ] False branch executes when condition not met
- [ ] Loop continues after conditional branches

### Array Processing
- [ ] Loop correctly extracts array from field
- [ ] Each array item processed individually
- [ ] Item data preserved and accessible
- [ ] Loop completes after all items

### Real-time Updates
- [ ] WebSocket events emitted for each iteration
- [ ] Frontend shows iteration progress
- [ ] Node status updates in real-time
- [ ] Execution can be cancelled mid-loop

### Error Handling
- [ ] Invalid iteration count rejected
- [ ] Missing field name handled
- [ ] Empty arrays handled gracefully
- [ ] Errors in downstream nodes stop loop

### Performance
- [ ] 100 iterations complete in reasonable time
- [ ] Memory usage stays stable
- [ ] No memory leaks after completion
- [ ] State properly cleaned up

---

## Debugging Tips

### Check Loop State

Add a Code node after the loop output:
```javascript
const data = $input.first().json;
console.log('Loop state:', {
  iteration: data.$iteration,
  index: data.$index,
  total: data.$total,
  isFirst: data.$isFirst,
  isLast: data.$isLast
});
return $input.all();
```

### Monitor WebSocket Events

Open browser console and watch for:
```javascript
// Listen to execution events
socket.on('node-completed', (data) => {
  console.log('Node completed:', data);
});
```

### Check Database State

```sql
-- View execution progress
SELECT 
  e.id,
  e.status,
  e."startedAt",
  e."finishedAt",
  COUNT(ne.id) as node_executions
FROM "Execution" e
LEFT JOIN "NodeExecution" ne ON ne."executionId" = e.id
WHERE e."workflowId" = 'your-workflow-id'
GROUP BY e.id
ORDER BY e."startedAt" DESC;

-- View node execution details
SELECT 
  ne."nodeId",
  ne.status,
  ne."startedAt",
  ne."finishedAt",
  ne."outputData"
FROM "NodeExecution" ne
WHERE ne."executionId" = 'your-execution-id'
ORDER BY ne."startedAt";
```

---

## Common Issues

### Loop Never Completes

**Symptom**: Loop keeps running indefinitely

**Possible Causes**:
- Loop output not connected to downstream nodes
- Done output not connected
- Infinite loop in workflow logic

**Solution**: Check connections and ensure loop has finite iterations

### Loop Produces No Output

**Symptom**: Error "Loop node produced no output - loop is stuck"

**Possible Causes**:
- Empty input array
- Invalid field name
- State management issue

**Solution**: Check input data and field configuration

### Iterations Skip or Duplicate

**Symptom**: Some iterations missing or repeated

**Possible Causes**:
- State not persisting correctly
- Multiple executions interfering
- Race condition in execution engine

**Solution**: Check execution logs and state management

### Performance Degradation

**Symptom**: Loop slows down over time

**Possible Causes**:
- Memory leak in downstream nodes
- Too many WebSocket events
- Database connection pool exhausted

**Solution**: Increase batch size, optimize downstream nodes

---

## Advanced Testing

### Stress Test

Create a loop with 1000 iterations:
```json
{
  "loopOver": "repeat",
  "repeatTimes": 1000,
  "batchSize": 10
}
```

### Nested Loops

Create a workflow with loop inside loop:
```
Loop (outer, 5 times)
  ↓
  Loop (inner, 3 times)
    ↓
    Process
```

### Loop with API Calls

Test rate limiting and delays:
```
Loop (10 times)
  ↓
  HTTP Request (API call)
  ↓
  Delay (1 second)
```

### Loop with Error Handling

Test error recovery:
```
Loop (10 times)
  ↓
  If (iteration == 5)
    ↓ [true]
    Error Node (throw error)
```

---

## Performance Benchmarks

Expected performance on standard hardware:

| Iterations | Batch Size | Time (approx) | Memory |
|-----------|-----------|---------------|---------|
| 10        | 1         | < 1s          | < 10MB  |
| 100       | 1         | < 5s          | < 20MB  |
| 1000      | 10        | < 30s         | < 50MB  |
| 10000     | 100       | < 5min        | < 100MB |

---

## Support

If you encounter issues:

1. Check execution logs in database
2. Monitor WebSocket events in browser console
3. Review node execution records
4. Check state management in SecureExecutionService
5. Verify connections between nodes

For bugs or feature requests, create an issue with:
- Workflow JSON
- Execution logs
- Expected vs actual behavior
- Screenshots if applicable
