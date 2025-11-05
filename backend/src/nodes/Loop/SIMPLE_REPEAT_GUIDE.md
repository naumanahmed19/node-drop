# Simple Repeat Guide - Loop N Times

## The Easiest Way to Loop!

You asked for a simple option like a for loop - and now you have it! 🎉

## Quick Start

### 1. Add Loop Node to Your Workflow
```
Manual Trigger → Loop Node → Your Processing Node
```

### 2. Configure Loop Node
- **Loop Over**: Select "Repeat N Times"
- **Number of Iterations**: Enter how many times to loop (e.g., 100)
- **Mode**: Select "Process Each Item"

### 3. Done!
That's it! No Code node needed. The Loop node will automatically generate iterations for you.

---

## Example: Loop 100 Times

### Configuration
```json
{
  "loopOver": "repeat",
  "repeatTimes": 100,
  "mode": "each"
}
```

### Output
Each iteration gets:
```json
{
  "iteration": 1,    // Current iteration (1-based)
  "index": 0,        // Array index (0-based)
  "total": 100       // Total number of iterations
}
```

---

## Complete Workflow Examples

### Example 1: Simple 100 Iterations

**Workflow**:
```
Manual Trigger → Loop (Repeat 100) → Set Node
```

**Loop Configuration**:
- Loop Over: Repeat N Times
- Number of Iterations: 100
- Mode: Process Each Item

**Set Node** (access iteration data):
```json
{
  "values": [
    {
      "keyValue": {
        "key": "message",
        "value": "Processing iteration {{$json.iteration}} of {{$json.total}}"
      }
    }
  ]
}
```

---

### Example 2: Batch Processing

**Workflow**:
```
Manual Trigger → Loop (Repeat 100, Batch 10) → HTTP Request
```

**Loop Configuration**:
- Loop Over: Repeat N Times
- Number of Iterations: 100
- Mode: Batch Processing
- Batch Size: 10

**Result**: 10 batches, each containing 10 iterations

---

### Example 3: API Calls with Iteration Number

**Workflow**:
```
Manual Trigger → Loop (Repeat 50) → HTTP Request
```

**Loop Configuration**:
- Loop Over: Repeat N Times
- Number of Iterations: 50
- Mode: Process Each Item

**HTTP Request** (use iteration in URL):
```
URL: https://api.example.com/items/{{$json.iteration}}
```

---

### Example 4: Generate Test Data

**Workflow**:
```
Manual Trigger → Loop (Repeat 1000) → Set → PostgreSQL
```

**Loop Configuration**:
- Loop Over: Repeat N Times
- Number of Iterations: 1000
- Mode: Process Each Item

**Set Node** (create test user):
```json
{
  "values": [
    {
      "keyValue": {
        "key": "email",
        "value": "user{{$json.iteration}}@example.com"
      }
    },
    {
      "keyValue": {
        "key": "name",
        "value": "User {{$json.iteration}}"
      }
    }
  ]
}
```

---

## Accessing Iteration Data

In any node after the Loop, you can access:

| Field | Description | Example |
|-------|-------------|---------|
| `{{$json.iteration}}` | Current iteration (1-based) | 1, 2, 3, ..., 100 |
| `{{$json.index}}` | Array index (0-based) | 0, 1, 2, ..., 99 |
| `{{$json.total}}` | Total iterations | 100 |

---

## Comparison: Old Way vs New Way

### ❌ Old Way (Required Code Node)
```
Manual Trigger → Code Node → Loop → Process
                 (Generate array)
```

**Code Node Required**:
```javascript
return Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
```

### ✅ New Way (Built-in!)
```
Manual Trigger → Loop → Process
                 (Repeat 100)
```

**No Code Needed!** Just configure:
- Loop Over: Repeat N Times
- Number of Iterations: 100

---

## Configuration Options

### Loop Over Options
1. **All Input Items** - Loop over items from previous node
2. **Field Value** - Extract array from a field
3. **Repeat N Times** ⭐ NEW! - Simple repeat like a for loop

### Number of Iterations
- Minimum: 1
- Maximum: 100,000 (safety limit)
- Default: 10

### Mode
- **Process Each Item**: Iterate one by one
- **Batch Processing**: Group into batches

---

## Use Cases

### 1. API Pagination
Loop through pages:
```
Loop (Repeat 10) → HTTP Request (page={{$json.iteration}})
```

### 2. Bulk Data Generation
Create test records:
```
Loop (Repeat 1000) → Set (generate data) → Database Insert
```

### 3. Retry Logic
Retry failed operations:
```
Loop (Repeat 3) → HTTP Request → If (check success)
```

### 4. Scheduled Tasks
Run task N times:
```
Schedule Trigger → Loop (Repeat 5) → Process Task
```

### 5. Rate-Limited Processing
Process in controlled batches:
```
Loop (Repeat 100, Batch 10) → Delay → API Call
```

---

## Tips & Best Practices

### ✅ DO
- Use "Repeat N Times" for simple counting loops
- Use batch mode for large iteration counts (>100)
- Access `{{$json.iteration}}` for 1-based counting
- Access `{{$json.index}}` for 0-based indexing

### ❌ DON'T
- Don't exceed 100,000 iterations (safety limit)
- Don't use repeat mode if you need to loop over actual data
- Don't forget to use batch mode for large counts

---

## Safety Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Minimum iterations | 1 | Must loop at least once |
| Maximum iterations | 100,000 | Prevent memory issues |
| Recommended batch size | 10-100 | Optimal performance |

---

## Troubleshooting

### Problem: "Number of iterations must be greater than 0"
**Solution**: Enter a positive number (1 or more)

### Problem: "Number of iterations cannot exceed 100,000"
**Solution**: Use a smaller number or split into multiple workflows

### Problem: Can't access iteration number
**Solution**: Use `{{$json.iteration}}` in subsequent nodes

---

## Quick Reference

### Simple Loop (10 times)
```json
{
  "loopOver": "repeat",
  "repeatTimes": 10,
  "mode": "each"
}
```

### Batch Loop (100 times, batches of 10)
```json
{
  "loopOver": "repeat",
  "repeatTimes": 100,
  "mode": "batch",
  "batchSize": 10
}
```

### Access Iteration Data
```
Current iteration: {{$json.iteration}}
Array index: {{$json.index}}
Total count: {{$json.total}}
```

---

## Summary

The new "Repeat N Times" option makes looping simple:
- ✅ No Code node required
- ✅ Just enter the number of iterations
- ✅ Works like a traditional for loop
- ✅ Perfect for counting, pagination, retries, and more!

**It's that simple!** 🚀
