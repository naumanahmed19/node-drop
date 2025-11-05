# Data Preview Node - Pass-Through Behavior

## Overview
The Data Preview node is a **non-modifying visualization node**. It displays data for debugging purposes but **passes through the original input data unchanged** to the next node.

## How It Works

### Input → Preview → Output

```
[Previous Node]  →  [Data Preview]  →  [Next Node]
     data              (visualize)         same data
```

The Data Preview node:
1. ✅ Receives input data from previous node
2. ✅ Formats it for display (JSON, Text, Table)
3. ✅ Shows preview in canvas and output panel
4. ✅ **Passes original data unchanged** to next node

## Data Flow Example

### Workflow
```
[HTTP Request] → [Data Preview] → [If Condition]
```

### What Happens

**1. HTTP Request Output:**
```json
{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ],
  "total": 2
}
```

**2. Data Preview Processing:**
- Formats data as JSON/Text/Table for display
- Stores preview metadata in `_preview` property
- **Keeps original data intact**

**3. Data Preview Output (to next node):**
```json
{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ],
  "total": 2
}
```
**Same as input!** ✅

**4. If Condition receives:**
The exact same data from HTTP Request, as if Data Preview wasn't there.

## Technical Implementation

### Backend (DataPreview.node.ts)

```typescript
// Pass through the original input data unchanged
const outputItems = items.map(item => ({
  json: item.json,  // ← Original data preserved
  _preview: previewMetadata  // ← Preview info for UI only
}));

return [{ main: outputItems }];
```

### Key Points:
- `json` property contains **original unmodified data**
- `_preview` property contains **preview metadata** (format, line count, etc.)
- Next node receives the `json` data, not the preview metadata

### Frontend (DataPreviewNode.tsx)

```typescript
// Look for the _preview metadata
if (mainOutput._preview) {
  return mainOutput._preview  // Use for display
}
// Fallback to json for backwards compatibility
if (mainOutput.json) {
  execData = mainOutput.json
}
```

## Use Cases

### 1. Debugging Without Disruption
```
[API Call] → [Data Preview] → [Transform] → [Save to DB]
              ↓
         (see data)
```
- Preview the API response
- Transform continues with original data
- No impact on downstream nodes

### 2. Multiple Preview Points
```
[Start] → [Preview 1] → [Transform] → [Preview 2] → [End]
           ↓                           ↓
      (before data)               (after data)
```
- Preview at multiple stages
- Each preview shows data at that point
- Data flows through unchanged

### 3. Conditional Logic Testing
```
[Data] → [Data Preview] → [If Condition] → [Action]
          ↓
     (verify data structure)
```
- Preview data before condition
- Condition receives exact same data
- No transformation applied

## Benefits

### 1. Non-Invasive Debugging
- Add preview nodes anywhere
- Remove them without affecting workflow
- No data transformation side effects

### 2. Safe to Use in Production
- Doesn't modify data
- Doesn't break data flow
- Can be disabled without issues

### 3. Multiple Previews
- Add as many as needed
- Each shows data at that point
- No cumulative effects

### 4. Easy to Remove
- Delete preview node
- Workflow continues working
- No data structure changes

## Comparison with Other Nodes

| Node Type | Modifies Data | Use Case |
|-----------|---------------|----------|
| **Data Preview** | ❌ No | Visualization only |
| **Set** | ✅ Yes | Add/modify fields |
| **Code** | ✅ Yes | Transform data |
| **JSON** | ✅ Yes | Parse/stringify |
| **If** | ❌ No | Route data |
| **Switch** | ❌ No | Route data |

## Example Workflows

### Example 1: API Response Inspection
```
[Manual Trigger]
  ↓
[HTTP Request] (GET /api/users)
  ↓
[Data Preview] ← Shows: [{ id: 1, name: "Alice" }, ...]
  ↓
[Loop] ← Receives: [{ id: 1, name: "Alice" }, ...]
  ↓
[Send Email]
```

### Example 2: Data Transformation Verification
```
[Database Query]
  ↓
[Data Preview] ← Shows: Raw DB data
  ↓
[Code Node] (transform)
  ↓
[Data Preview] ← Shows: Transformed data
  ↓
[HTTP Request] (POST)
```

### Example 3: Debugging Complex Logic
```
[Start]
  ↓
[Get Data]
  ↓
[Data Preview] ← Check input
  ↓
[If Condition]
  ├─ True → [Data Preview] ← Check true branch
  └─ False → [Data Preview] ← Check false branch
```

## Best Practices

### ✅ Do:
- Use for debugging and development
- Add at key points in workflow
- Remove or disable in production if not needed
- Use multiple previews to track data flow

### ❌ Don't:
- Rely on preview node to transform data
- Use as a data storage node
- Expect data modification
- Use for business logic

## Performance Considerations

### Minimal Impact
- Preview formatting happens in backend
- Original data passed through efficiently
- No extra network requests
- Minimal memory overhead

### Optimization Tips
1. **Set Max Lines** to limit preview size
2. **Use Auto Collapse** for multiple previews
3. **Disable in production** if not needed
4. **Use JSON Compact** for large datasets

## Migration Guide

If you were using Data Preview expecting data modification:

### Before (Incorrect Usage)
```
[Data] → [Data Preview] → [Next Node]
         (expecting modified data)
```

### After (Correct Usage)
```
[Data] → [Set/Code Node] → [Data Preview] → [Next Node]
         (modify data)      (visualize)
```

## Summary

The Data Preview node is a **visualization-only tool** that:
- ✅ Shows data in terminal-style format
- ✅ Supports multiple format options
- ✅ Provides debugging information
- ✅ **Passes data through unchanged**
- ✅ Safe to add/remove anytime
- ✅ No side effects on workflow

Think of it as a **window into your data flow** - you can look through it, but it doesn't change what's flowing through! 🪟
