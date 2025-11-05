# Simple Debug Test for Loop Node

## Minimal Test - Just Log Everything

### Step 1: Add Manual Trigger
- Drag **Manual Trigger** to canvas
- Leave all defaults

### Step 2: Add Loop Node
- Drag **Loop** node to canvas
- Configure:
  - **Loop Over**: "Repeat N Times"
  - **Number of Iterations**: `3`
  - **Batch Size**: `1`

### Step 3: Add Code Node (Debug)
- Drag **Code** node to canvas
- Configure:
  - **Name**: "Debug Loop Output"
  - **Language**: "JavaScript"
  - **Code**:
  ```javascript
  // Debug: Log everything we receive
  console.log('=== DEBUG START ===');
  console.log('Type of items:', typeof items);
  console.log('Is items an array?', Array.isArray(items));
  console.log('Items length:', items ? items.length : 'items is null/undefined');
  console.log('Items:', JSON.stringify(items, null, 2));
  
  if (items && items.length > 0) {
    console.log('First item:', JSON.stringify(items[0], null, 2));
    console.log('Type of first item:', typeof items[0]);
  }
  console.log('=== DEBUG END ===');
  
  // Return the items as-is
  return items || [];
  ```

### Step 4: Connect Nodes
1. **Manual Trigger** → **Loop** (main output)
2. **Loop** → **Debug Loop Output** (use "loop" output - top connection)

### Step 5: Execute and Check Console

Open browser console (F12) and look for the debug output.

---

## Expected Output

You should see something like:

```
=== DEBUG START ===
Type of items: object
Is items an array? true
Items length: 1
Items: [
  {
    "iteration": 1,
    "index": 0,
    "total": 3,
    "$iteration": 1,
    "$index": 0,
    "$total": 3,
    "$isFirst": true,
    "$isLast": false,
    "$batchIndex": 0,
    "$batchSize": 1
  }
]
First item: {
  "iteration": 1,
  "index": 0,
  "total": 3,
  ...
}
Type of first item: object
=== DEBUG END ===
```

This will repeat 3 times (once for each iteration).

---

## If You See Different Output

### If `items` is undefined:
- The Loop node isn't outputting data correctly
- Check that you connected to the "loop" output (top connection)

### If `items` is an empty array:
- The Loop node is executing but not producing output
- Check Loop node configuration

### If `items[0]` has a different structure:
- Note the actual structure and we'll adjust the code accordingly

### If you see errors:
- Copy the exact error message
- Check browser console for stack traces

---

## Alternative: Even Simpler Test

If the above doesn't work, try this ultra-minimal code:

```javascript
console.log('Items received:', items);
return items;
```

This should at least show you what's being passed to the Code node.

---

## Next Step After Debug

Once you see the structure of `items`, we can write the correct code to access the iteration data.

For example, if you see:
```json
[
  {
    "iteration": 1,
    "index": 0,
    "total": 3
  }
]
```

Then the correct code would be:
```javascript
const data = items[0];
console.log(`Iteration ${data.iteration} of ${data.total}`);
return [data];
```

But if you see a different structure, we'll adjust accordingly!
