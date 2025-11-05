# How to Loop 100 Times - Quick Guide

## The Problem
The Loop node needs an array to iterate over. To loop 100 times, you need to create an array with 100 items first.

## The Solution

### Simple 3-Step Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Manual Trigger │────▶│   Code Node     │────▶│   Loop Node     │
│                 │     │ (Generate Array)│     │   (Iterate)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              Creates              Loops through
                            100 items              each item
```

---

## Step-by-Step Instructions

### Step 1: Add Manual Trigger Node
- Drag "Manual Trigger" to canvas
- Configure (optional):
  ```json
  {
    "allowCustomData": true,
    "defaultData": "{\"count\": 100}"
  }
  ```

### Step 2: Add Code Node
- Drag "Code" node to canvas
- Connect Manual Trigger → Code
- Paste this code:

```javascript
// Simple: Loop 100 times
const count = 100;

const result = Array.from({ length: count }, (_, i) => ({
  iteration: i + 1
}));

return result;
```

**What this does**: Creates an array with 100 objects: `[{iteration: 1}, {iteration: 2}, ..., {iteration: 100}]`

### Step 3: Add Loop Node
- Drag "Loop" node to canvas
- Connect Code → Loop
- Configure:
  ```json
  {
    "loopOver": "items",
    "mode": "each"
  }
  ```

### Step 4: Add Your Processing Node
- Add any node (Set, HTTP Request, Code, etc.)
- Connect Loop → Your Node
- This node will execute 100 times!

---

## Quick Copy-Paste Solutions

### Option 1: Simple Counter (1 to 100)
```javascript
return Array.from({ length: 100 }, (_, i) => ({ count: i + 1 }));
```

### Option 2: With More Data
```javascript
return Array.from({ length: 100 }, (_, i) => ({
  iteration: i + 1,
  timestamp: new Date().toISOString(),
  message: `Processing ${i + 1} of 100`
}));
```

### Option 3: Custom Range (e.g., 50 to 150)
```javascript
const start = 50;
const end = 150;
return Array.from({ length: end - start + 1 }, (_, i) => ({
  value: start + i
}));
```

### Option 4: Dynamic Count from Trigger
```javascript
// Get count from Manual Trigger custom data
const count = items[0]?.customData?.count || 100;

return Array.from({ length: count }, (_, i) => ({
  iteration: i + 1
}));
```

---

## Common Use Cases

### Use Case 1: Send 100 API Requests
```
Manual Trigger → Code (generate 100 items) → Loop → HTTP Request
```

### Use Case 2: Create 100 Database Records
```
Manual Trigger → Code (generate 100 items) → Loop → PostgreSQL
```

### Use Case 3: Process in Batches of 10
```
Manual Trigger → Code (generate 100 items) → Loop (batch: 10) → Process
```
Result: 10 batches, each with 10 items

### Use Case 4: Loop with Condition
```
Manual Trigger → Code (generate 100 items) → Loop → If → Process
```
Result: Only processes items that meet condition

---

## Batch Processing (Recommended for Large Counts)

If you're looping 100+ times, use batch mode for better performance:

### Code Node
```javascript
return Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
```

### Loop Node Configuration
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 10
}
```

**Result**: 10 batches of 10 items each
- Batch 1: items 1-10
- Batch 2: items 11-20
- ...
- Batch 10: items 91-100

---

## Complete Working Example

### Workflow: Loop 100 Times and Log Each Iteration

**Node 1: Manual Trigger**
```json
{
  "description": "Start loop workflow"
}
```

**Node 2: Code (Generate Array)**
```javascript
// Generate 100 items
const result = Array.from({ length: 100 }, (_, i) => ({
  iteration: i + 1,
  timestamp: Date.now(),
  data: `Item ${i + 1}`
}));

console.log(`Generated ${result.length} items`);
return result;
```

**Node 3: Loop**
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Node 4: Set (Process Each)**
```json
{
  "values": [
    {
      "keyValue": {
        "key": "processed",
        "value": true
      }
    },
    {
      "keyValue": {
        "key": "processedAt",
        "value": "{{new Date().toISOString()}}"
      }
    }
  ]
}
```

**Result**: Each of the 100 items is processed with `processed: true` and a timestamp.

---

## Troubleshooting

### Problem: Loop doesn't iterate
**Solution**: Make sure Code node returns an array:
```javascript
// ✅ Correct
return [{ id: 1 }, { id: 2 }];

// ❌ Wrong
return { id: 1 };
```

### Problem: Loop only runs once
**Solution**: Check that you're generating multiple items:
```javascript
// ✅ Correct - generates 100 items
return Array.from({ length: 100 }, (_, i) => ({ id: i }));

// ❌ Wrong - generates 1 item
return [{ count: 100 }];
```

### Problem: Out of memory
**Solution**: Use batch mode:
```json
{
  "mode": "batch",
  "batchSize": 10
}
```

---

## Advanced: Variable Loop Count

### Make count configurable via Manual Trigger:

**Manual Trigger**
```json
{
  "allowCustomData": true,
  "defaultData": "{\"loopCount\": 100}"
}
```

**Code Node**
```javascript
// Get count from trigger data
const loopCount = items[0]?.customData?.loopCount || 100;

// Validate
if (loopCount < 1 || loopCount > 10000) {
  throw new Error('Loop count must be between 1 and 10000');
}

// Generate array
return Array.from({ length: loopCount }, (_, i) => ({
  iteration: i + 1,
  total: loopCount,
  percentage: ((i + 1) / loopCount * 100).toFixed(2)
}));
```

**Loop Node**
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

Now you can change the loop count without editing the workflow!

---

## Performance Tips

| Loop Count | Recommended Mode | Batch Size | Notes |
|------------|------------------|------------|-------|
| 1-50       | Each             | N/A        | Fast, no batching needed |
| 51-500     | Each or Batch    | 10-50      | Consider batching for API calls |
| 501-5000   | Batch            | 50-100     | Batching recommended |
| 5001+      | Batch            | 100-500    | Always use batching |

---

## Summary

To loop 100 times:
1. ✅ Use Code node to generate array with 100 items
2. ✅ Use Loop node to iterate over the array
3. ✅ Add processing nodes after Loop
4. ✅ Consider batch mode for better performance

**Key Point**: The Loop node doesn't create items - it iterates over existing items. You must create the array first!
