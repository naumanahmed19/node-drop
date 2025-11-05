# Feature Update: Simple Repeat Mode

## What's New?

The Loop node now has a **"Repeat N Times"** option - making it super easy to loop without needing a Code node!

## Before vs After

### ❌ Before (Required 3 Nodes)
```
Manual Trigger → Code Node → Loop Node → Process
                 (Generate array)
```

You had to write code:
```javascript
return Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
```

### ✅ After (Just 2 Nodes!)
```
Manual Trigger → Loop Node → Process
                 (Repeat 100)
```

No code needed! Just configure:
- Loop Over: **Repeat N Times**
- Number of Iterations: **100**

## How to Use

### Step 1: Add Loop Node
Drag the Loop node to your workflow canvas.

### Step 2: Configure
- **Loop Over**: Select "Repeat N Times"
- **Number of Iterations**: Enter your count (e.g., 100)
- **Mode**: Choose "Process Each Item" or "Batch Processing"

### Step 3: Done!
The Loop node automatically generates iterations with:
```json
{
  "iteration": 1,    // 1, 2, 3, ..., 100
  "index": 0,        // 0, 1, 2, ..., 99
  "total": 100       // Total count
}
```

## Examples

### Example 1: Loop 100 Times
```json
{
  "loopOver": "repeat",
  "repeatTimes": 100,
  "mode": "each"
}
```

### Example 2: Batch Processing (100 items, 10 per batch)
```json
{
  "loopOver": "repeat",
  "repeatTimes": 100,
  "mode": "batch",
  "batchSize": 10
}
```

### Example 3: API Pagination
```
Loop (Repeat 10) → HTTP Request
```
URL: `https://api.example.com/items?page={{$json.iteration}}`

### Example 4: Generate Test Data
```
Loop (Repeat 1000) → Set → Database
```
Set node:
```json
{
  "email": "user{{$json.iteration}}@example.com",
  "name": "User {{$json.iteration}}"
}
```

## Features

### ✅ What You Get
- Simple configuration (no code!)
- Automatic iteration tracking
- Batch processing support
- Safety limits (max 100,000)
- Works with Manual Trigger
- Access to iteration data in all subsequent nodes

### 🎯 Use Cases
- API pagination
- Bulk data generation
- Retry logic
- Scheduled tasks
- Rate-limited processing
- Test data creation

## Technical Details

### Configuration Options
| Option | Type | Range | Default |
|--------|------|-------|---------|
| repeatTimes | number | 1 - 100,000 | 10 |

### Output Format (Each Mode)
```typescript
{
  iteration: number;  // 1-based counter
  index: number;      // 0-based index
  total: number;      // Total iterations
}
```

### Output Format (Batch Mode)
```typescript
{
  items: Array<{
    iteration: number;
    index: number;
    total: number;
  }>;
  count: number;  // Items in this batch
}
```

### Safety Limits
- Minimum: 1 iteration
- Maximum: 100,000 iterations
- Recommended batch size: 10-100

## Migration Guide

### If You're Using the Old Method

**Old Code Node**:
```javascript
const count = 100;
return Array.from({ length: count }, (_, i) => ({ iteration: i + 1 }));
```

**New Loop Configuration**:
```json
{
  "loopOver": "repeat",
  "repeatTimes": 100,
  "mode": "each"
}
```

**Benefits**:
- ✅ No code to maintain
- ✅ Simpler workflow
- ✅ Built-in validation
- ✅ Better performance
- ✅ Easier to understand

## Testing

All tests pass! ✅
- 31 total tests
- 7 new tests for repeat mode
- 100% coverage for new feature

### Test Coverage
- ✅ Repeat N times
- ✅ Repeat 100 times
- ✅ Repeat with batch mode
- ✅ Error handling (zero, negative, exceeds limit)
- ✅ Works with no input data

## Documentation

New guides created:
1. **SIMPLE_REPEAT_GUIDE.md** - Complete guide for the new feature
2. **README.md** - Updated with new feature
3. **FEATURE_UPDATE.md** - This document

## Backwards Compatibility

✅ **Fully backwards compatible!**
- Existing workflows continue to work
- Old methods still supported
- No breaking changes

## Summary

The Loop node is now even more powerful and easier to use:
- ⭐ NEW: "Repeat N Times" option
- 🚀 No Code node required
- 💡 Simple configuration
- ✅ All tests passing
- 📚 Complete documentation

**Try it now!** Just select "Repeat N Times" in the Loop node configuration.
