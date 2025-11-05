# Using Loop Node with Manual Trigger

## Example 1: Loop 100 Times (Simple Counter)

**Workflow**:
```
Manual Trigger → Code Node → Loop Node → Set Node
```

### Step 1: Manual Trigger
Configure with custom data enabled:
```json
{
  "allowCustomData": true,
  "defaultData": "{\"count\": 100}"
}
```

### Step 2: Code Node (Generate Array)
Create an array with 100 items:
```javascript
// Get the count from trigger data
const count = items[0]?.customData?.count || 100;

// Generate array of numbers from 1 to count
const result = Array.from({ length: count }, (_, i) => ({
  index: i + 1,
  iteration: i + 1
}));

return result;
```

### Step 3: Loop Node
Configure to iterate over items:
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

### Step 4: Set Node (Process Each Iteration)
Do something with each iteration:
```json
{
  "values": [
    {
      "keyValue": {
        "key": "message",
        "value": "Processing iteration {{$json.iteration}}"
      }
    }
  ]
}
```

**Result**: Processes 100 iterations, each with its own index.

---

## Example 2: Loop with Batch Processing

**Workflow**:
```
Manual Trigger → Code Node → Loop Node (Batch) → HTTP Request
```

### Code Node (Generate 100 Items)
```javascript
const count = 100;

// Generate 100 user IDs to process
const result = Array.from({ length: count }, (_, i) => ({
  userId: `USER_${String(i + 1).padStart(4, '0')}`,
  batch: Math.floor(i / 10) + 1
}));

return result;
```

### Loop Node (Batch Mode)
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 10
}
```

**Result**: Creates 10 batches of 10 items each.

---

## Example 3: Loop with Custom Start/End

**Workflow**:
```
Manual Trigger → Code Node → Loop Node → Set Node
```

### Manual Trigger Data
```json
{
  "start": 1,
  "end": 100,
  "step": 1
}
```

### Code Node (Generate Range)
```javascript
const start = items[0]?.customData?.start || 1;
const end = items[0]?.customData?.end || 100;
const step = items[0]?.customData?.step || 1;

const result = [];
for (let i = start; i <= end; i += step) {
  result.push({
    value: i,
    isEven: i % 2 === 0,
    isOdd: i % 2 !== 0
  });
}

return result;
```

### Loop Node
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Result**: Loops from 1 to 100 with custom step size.

---

## Example 4: Loop with Data Generation

**Workflow**:
```
Manual Trigger → Code Node → Loop Node → HTTP Request
```

### Code Node (Generate Test Data)
```javascript
const count = 100;

// Generate 100 test users
const result = Array.from({ length: count }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  createdAt: new Date().toISOString()
}));

return result;
```

### Loop Node
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Result**: Creates 100 user objects and processes each one.

---

## Example 5: Nested Loop (10x10 Grid)

**Workflow**:
```
Manual Trigger → Code (Outer) → Loop (Outer) → Code (Inner) → Loop (Inner)
```

### Code Node (Generate Outer Array)
```javascript
// Generate 10 rows
const rows = Array.from({ length: 10 }, (_, i) => ({
  row: i + 1
}));

return rows;
```

### Loop Node (Outer)
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

### Code Node (Generate Inner Array)
```javascript
const row = items[0].row;

// Generate 10 columns for this row
const columns = Array.from({ length: 10 }, (_, i) => ({
  row: row,
  col: i + 1,
  cell: `R${row}C${i + 1}`
}));

return columns;
```

### Loop Node (Inner)
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Result**: Processes 100 cells (10 rows × 10 columns).

---

## Example 6: Loop with Delay Between Iterations

**Workflow**:
```
Manual Trigger → Code → Loop → Code (Delay) → HTTP Request
```

### Code Node (Generate Items)
```javascript
const count = 100;

const result = Array.from({ length: count }, (_, i) => ({
  id: i + 1,
  timestamp: Date.now() + (i * 1000) // Stagger by 1 second
}));

return result;
```

### Loop Node (Batch for Rate Limiting)
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 5
}
```

### Code Node (Add Delay)
```javascript
// Process batch and add delay
const batch = items[0].items;

// Simulate delay (in real workflow, you'd use actual delay)
return batch.map(item => ({
  ...item,
  processedAt: new Date().toISOString()
}));
```

**Result**: Processes 100 items in 20 batches of 5.

---

## Quick Reference: Generate N Items

### Simple Array (1 to N)
```javascript
const n = 100;
return Array.from({ length: n }, (_, i) => ({ index: i + 1 }));
```

### Array with Custom Values
```javascript
const n = 100;
return Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  value: i * 10,
  label: `Item ${i + 1}`
}));
```

### Array from Range
```javascript
const start = 1;
const end = 100;
return Array.from({ length: end - start + 1 }, (_, i) => ({
  value: start + i
}));
```

### Array with Random Data
```javascript
const n = 100;
return Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  random: Math.random(),
  randomInt: Math.floor(Math.random() * 1000)
}));
```

---

## Common Patterns

### Pattern 1: Simple Counter Loop
```
Manual Trigger → Code (generate array) → Loop (each) → Process
```

### Pattern 2: Batch Processing
```
Manual Trigger → Code (generate array) → Loop (batch) → Process
```

### Pattern 3: Conditional Loop
```
Manual Trigger → Code (generate array) → Loop (each) → If → Process
```

### Pattern 4: Loop with Aggregation
```
Manual Trigger → Code (generate array) → Loop (each) → Process → Code (aggregate)
```

---

## Tips

1. **Always generate the array first** - Use a Code node before the Loop node
2. **Use batch mode for large counts** - More efficient than processing individually
3. **Add delays for rate limiting** - Use Code node with setTimeout or batch processing
4. **Monitor memory usage** - Very large loops (>10,000) may need optimization
5. **Use Manual Trigger custom data** - Pass count as parameter for flexibility

---

## Complete Example: Loop 100 Times

Here's a complete, copy-paste ready example:

### Manual Trigger Configuration
```json
{
  "description": "Loop 100 times",
  "allowCustomData": true,
  "defaultData": "{\"count\": 100}"
}
```

### Code Node (Generate Array)
```javascript
// Get count from trigger or default to 100
const count = items[0]?.customData?.count || 100;

// Generate array
const result = Array.from({ length: count }, (_, i) => ({
  iteration: i + 1,
  timestamp: new Date().toISOString(),
  data: `Processing item ${i + 1} of ${count}`
}));

return result;
```

### Loop Node Configuration
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

### Set Node (Process Each)
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

**Result**: Successfully loops 100 times and processes each iteration!
