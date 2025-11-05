# Loop Node - Workflow Loop Guide

## Overview

The Loop node now creates **true workflow loops** where each iteration flows through downstream nodes before moving to the next iteration. This allows you to build complex iterative workflows with conditions, API calls, and data processing.

## How It Works

### Two Outputs

The Loop node has **two outputs**:

1. **Loop Output** (first output) - Outputs ONE item at a time during iteration
2. **Done Output** (second output) - Outputs when all iterations complete

### Execution Flow

```
Loop Node (iteration 1) 
  ↓ [loop output]
  → Process nodes (If, HTTP, Set, etc.)
  → Loop Node (iteration 2)
  ↓ [loop output]
  → Process nodes again
  → ...
  → Loop Node (iteration N)
  ↓ [done output]
  → Final nodes (run after loop completes)
```

## Example 1: Loop with Condition

**Goal**: Loop 100 times but stop when iteration equals 7

### Workflow Setup

```
Manual Trigger
  ↓
Loop Node (Repeat 100 times)
  ↓ [loop output]
If Node ({{$json.iteration}} == 7)
  ↓ [true branch]
Stop Node / Log Node
  ↓ [false branch]
Continue processing
```

### Loop Node Configuration

- **Loop Over**: Repeat N Times
- **Number of Iterations**: 100
- **Batch Size**: 1 (process one at a time)

### If Node Configuration

- **Condition**: `{{$json.iteration}} == 7`
- Connect to different nodes based on true/false

### Available Variables in Loop

Each iteration outputs an object with:

```json
{
  "iteration": 7,        // Current iteration number (1-based)
  "index": 6,            // Current index (0-based)
  "total": 100,          // Total iterations
  "$iteration": 7,       // Same as iteration
  "$index": 6,           // Same as index
  "$total": 100,         // Same as total
  "$isFirst": false,     // True on first iteration
  "$isLast": false,      // True on last iteration
  "$batchIndex": 0,      // Index within current batch
  "$batchSize": 1        // Size of current batch
}
```

## Example 2: Process Array Items with Condition

**Goal**: Process each user, but skip inactive users

### Workflow Setup

```
Manual Trigger (with users array)
  ↓
Loop Node (Loop over field: "users")
  ↓ [loop output]
If Node ({{$json.status}} == "active")
  ↓ [true branch]
HTTP Request (send email to {{$json.email}})
  ↓ [false branch]
Log Node (skipped inactive user)
```

### Input Data

```json
{
  "users": [
    { "name": "John", "email": "john@example.com", "status": "active" },
    { "name": "Jane", "email": "jane@example.com", "status": "inactive" },
    { "name": "Bob", "email": "bob@example.com", "status": "active" }
  ]
}
```

### Loop Node Configuration

- **Loop Over**: Field Value
- **Field Name**: users
- **Batch Size**: 1

## Example 3: API Pagination

**Goal**: Fetch 10 pages of data from an API

### Workflow Setup

```
Manual Trigger
  ↓
Loop Node (Repeat 10 times)
  ↓ [loop output]
HTTP Request (GET /api/data?page={{$json.iteration}})
  ↓
Set Node (extract items from response)
  ↓
[Loop continues to next page]
  ↓ [done output after 10 pages]
Aggregate Node (combine all results)
```

### Loop Node Configuration

- **Loop Over**: Repeat N Times
- **Number of Iterations**: 10
- **Batch Size**: 1

## Example 4: Batch Processing

**Goal**: Process 1000 items in batches of 10

### Workflow Setup

```
Manual Trigger (with 1000 items)
  ↓
Loop Node (Loop over items, batch size 10)
  ↓ [loop output]
HTTP Request (bulk API call with 10 items)
  ↓
Delay Node (wait 1 second between batches)
  ↓
[Loop continues with next batch]
  ↓ [done output after all batches]
Summary Node
```

### Loop Node Configuration

- **Loop Over**: All Input Items
- **Batch Size**: 10

### Batch Output

Each iteration outputs:

```json
{
  "item1": { "id": 1, "$index": 0, "$batchIndex": 0 },
  "item2": { "id": 2, "$index": 1, "$batchIndex": 1 },
  ...
  "item10": { "id": 10, "$index": 9, "$batchIndex": 9 }
}
```

## Important Notes

### Realtime Execution

The Loop node works with both execution engines:
- **ExecutionEngine**: Queue-based execution with Bull
- **RealtimeExecutionEngine**: WebSocket-based real-time execution

Both engines support:
- Iteration-by-iteration execution
- Real-time progress updates via WebSocket
- Loop state management
- Early exit conditions

### Safety Limits

- Maximum iterations: 100,000
- The loop will throw an error if it exceeds this limit
- Use the "done" output to handle completion

### State Management

- Loop state is maintained per execution
- Each loop tracks its current position
- State is cleared when loop completes

### Performance

- Each iteration waits for downstream nodes to complete
- Use batch processing for better performance with large datasets
- Consider using delays between iterations for rate-limited APIs

### Debugging

- Use Data Preview nodes to see iteration data
- Check the `$iteration` and `$index` variables
- Monitor execution logs for loop progress

## Common Patterns

### Early Exit

```
Loop → If (condition met) → [true] → Done
                          → [false] → Continue
```

### Accumulation

```
Loop → Process → Store in variable → Next iteration uses accumulated data
```

### Conditional Processing

```
Loop → If (check condition) → [true] → Process
                            → [false] → Skip
```

### Rate Limiting

```
Loop → API Call → Delay (1 second) → Next iteration
```

## Troubleshooting

### Loop Never Completes

- Check that your loop has a finite number of iterations
- Verify the "done" output is connected
- Check for infinite loops in your workflow logic

### Loop Outputs Empty Data

- Verify input data format
- Check field names for "Field Value" mode
- Ensure batch size is appropriate

### Performance Issues

- Increase batch size to process multiple items at once
- Add delays between iterations for rate-limited APIs
- Consider splitting large loops into smaller workflows
