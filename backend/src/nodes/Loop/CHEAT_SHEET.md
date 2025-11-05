# Loop Node Cheat Sheet

## Quick Reference

### Basic Workflow Pattern
```
Data Source → Loop Node → Process Node
```

### Loop 100 Times Pattern
```
Manual Trigger → Code (generate array) → Loop → Process
```

---

## Code Snippets for Generating Arrays

### Loop N Times (Simple)
```javascript
const n = 100;
return Array.from({ length: n }, (_, i) => ({ index: i + 1 }));
```

### Loop with Range (Start to End)
```javascript
const start = 1;
const end = 100;
return Array.from({ length: end - start + 1 }, (_, i) => ({ value: start + i }));
```

### Loop with Custom Data
```javascript
const n = 100;
return Array.from({ length: n }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  timestamp: new Date().toISOString()
}));
```

### Dynamic Count from Trigger
```javascript
const count = items[0]?.customData?.count || 100;
return Array.from({ length: count }, (_, i) => ({ iteration: i + 1 }));
```

---

## Loop Node Configurations

### Process Each Item Individually
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

### Process in Batches
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 10
}
```

### Loop Over Field in Data
```json
{
  "loopOver": "field",
  "fieldName": "users",
  "mode": "each"
}
```

### Loop Over Nested Field
```json
{
  "loopOver": "field",
  "fieldName": "data.items",
  "mode": "each"
}
```

---

## Common Patterns

### Pattern 1: Simple Loop
```
Manual Trigger → Code → Loop (each) → Set
```
**Use**: Process items one by one

### Pattern 2: Batch Processing
```
Manual Trigger → Code → Loop (batch: 10) → HTTP Request
```
**Use**: Group items for efficiency

### Pattern 3: Conditional Loop
```
Manual Trigger → Code → Loop → If → Process
```
**Use**: Filter items during iteration

### Pattern 4: Nested Loop
```
Manual Trigger → Code → Loop (outer) → Code → Loop (inner) → Process
```
**Use**: Multi-level iteration

### Pattern 5: Field Extraction
```
HTTP Request → Loop (field: "users") → Process
```
**Use**: Extract and iterate nested arrays

---

## Quick Formulas

### Generate N Items
```javascript
Array.from({ length: N }, (_, i) => ({ id: i + 1 }))
```

### Generate Range [A, B]
```javascript
Array.from({ length: B - A + 1 }, (_, i) => ({ value: A + i }))
```

### Generate with Step
```javascript
Array.from({ length: Math.ceil((end - start) / step) }, (_, i) => ({ 
  value: start + (i * step) 
}))
```

### Generate Random Data
```javascript
Array.from({ length: N }, (_, i) => ({
  id: i + 1,
  random: Math.random(),
  randomInt: Math.floor(Math.random() * 100)
}))
```

---

## Batch Size Recommendations

| Items | Batch Size | Batches | Use Case |
|-------|------------|---------|----------|
| 10    | N/A (each) | N/A     | Small dataset |
| 100   | 10         | 10      | API calls |
| 1,000 | 50         | 20      | Database ops |
| 10,000| 100        | 100     | Bulk processing |

---

## Error Prevention

### ✅ DO
```javascript
// Return an array
return [{ id: 1 }, { id: 2 }];

// Use Array.from for loops
return Array.from({ length: 100 }, (_, i) => ({ id: i }));

// Validate input
if (!Array.isArray(data)) throw new Error('Expected array');
```

### ❌ DON'T
```javascript
// Don't return single object
return { count: 100 };

// Don't use for loop without return
for (let i = 0; i < 100; i++) { /* no return */ }

// Don't forget to return
Array.from({ length: 100 }, (_, i) => ({ id: i }));
// Missing return statement!
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Loop doesn't run | Ensure Code node returns an array |
| Loop runs once | Check array has multiple items |
| Out of memory | Use batch mode with smaller batches |
| Field not found | Verify field path is correct |
| Empty output | Check input data is not empty |

---

## Performance Tips

1. **Use batch mode for 100+ items**
2. **Limit batch size to 100-500 for memory**
3. **Add delays between batches for rate limiting**
4. **Use field extraction instead of preprocessing**
5. **Monitor execution time for large datasets**

---

## Complete Example: Loop 100 Times

### 1. Manual Trigger
```json
{ "description": "Loop 100 times" }
```

### 2. Code Node
```javascript
return Array.from({ length: 100 }, (_, i) => ({
  iteration: i + 1,
  data: `Processing ${i + 1} of 100`
}));
```

### 3. Loop Node
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

### 4. Set Node
```json
{
  "values": [
    { "keyValue": { "key": "processed", "value": true } }
  ]
}
```

**Result**: 100 iterations, each processed individually! ✅

---

## API Reference

### Loop Node Properties

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| loopOver | options | items, field | What to loop over |
| fieldName | string | any | Field path (when loopOver=field) |
| mode | options | each, batch | Processing mode |
| batchSize | number | 1-10000 | Items per batch (when mode=batch) |

### Input Format
```typescript
// Wrapped format
[{ json: { id: 1 } }, { json: { id: 2 } }]

// Unwrapped format
[{ id: 1 }, { id: 2 }]
```

### Output Format (Each Mode)
```typescript
[{ json: { id: 1 } }, { json: { id: 2 } }, ...]
```

### Output Format (Batch Mode)
```typescript
[
  { json: { items: [...], count: 10 } },
  { json: { items: [...], count: 10 } }
]
```

---

## Need Help?

- **Loop 100 times?** → See [LOOP_100_TIMES_GUIDE.md](./LOOP_100_TIMES_GUIDE.md)
- **Use with Manual Trigger?** → See [MANUAL_TRIGGER_EXAMPLES.md](./MANUAL_TRIGGER_EXAMPLES.md)
- **Workflow patterns?** → See [WORKFLOW_PATTERNS.md](./WORKFLOW_PATTERNS.md)
- **Real examples?** → See [EXAMPLES.md](./EXAMPLES.md)
