# Merge Node

Combine data from multiple inputs into a single output.

## Overview

The Merge node is essential for workflows where you need to combine results from parallel branches or multiple data sources. It accepts multiple input connections and merges them based on your selected strategy.

## Merge Modes

### 1. Append (Default)
Concatenates all items from all inputs into a single array.

**Example:**
```
Input 1: [{ "name": "Alice" }, { "name": "Bob" }]
Input 2: [{ "name": "Charlie" }, { "name": "David" }]

Output: [
  { "name": "Alice" },
  { "name": "Bob" },
  { "name": "Charlie" },
  { "name": "David" }
]
```

**Use Cases:**
- Combining results from multiple API calls
- Aggregating data from different sources
- Collecting items from parallel processing branches

### 2. Merge by Position
Merges items at the same index position across inputs.

**Example:**
```
Input 1: [{ "firstName": "Alice" }, { "firstName": "Bob" }]
Input 2: [{ "lastName": "Smith" }, { "lastName": "Jones" }]

Output: [
  { "firstName": "Alice", "lastName": "Smith" },
  { "firstName": "Bob", "lastName": "Jones" }
]
```

**Use Cases:**
- Enriching data from parallel lookups
- Combining related data at the same positions
- Merging split processing results

### 3. Merge by Key
Merges items with matching key values across inputs.

**Example:**
```
Input 1: [{ "id": 1, "name": "Alice" }, { "id": 2, "name": "Bob" }]
Input 2: [{ "id": 1, "age": 30 }, { "id": 2, "age": 25 }]

Merge Key: "id"

Output: [
  { "id": 1, "name": "Alice", "age": 30 },
  { "id": 2, "name": "Bob", "age": 25 }
]
```

**Use Cases:**
- Joining data like SQL JOIN
- Enriching records with additional fields
- Combining user data with profile data

### 4. Keep First Input
Only outputs items from the first input, ignoring all others.

**Example:**
```
Input 1: [{ "name": "Alice" }]
Input 2: [{ "name": "Bob" }]

Output: [{ "name": "Alice" }]
```

**Use Cases:**
- Fallback scenarios
- Priority-based data selection
- Testing and debugging

### 5. Keep Last Input
Only outputs items from the last input, ignoring all others.

**Example:**
```
Input 1: [{ "name": "Alice" }]
Input 2: [{ "name": "Bob" }]

Output: [{ "name": "Bob" }]
```

**Use Cases:**
- Override scenarios
- Latest data wins
- Testing and debugging

## Configuration

### Mode
Select how to merge the data from multiple inputs.

### Merge Key (for "Merge by Key" mode)
The field name to use for matching items across inputs. Supports nested paths like `user.id` or `data.userId`.

### Wait for All Inputs
- **Enabled (default)**: Waits for all inputs to arrive before merging
- **Disabled**: Outputs as soon as any input arrives (pass-through mode)

## Common Workflows

### 1. Combine API Results
```
HTTP Request (Get Users) ──┐
                           ├─→ Merge (Append) → Process All
HTTP Request (Get Admins) ─┘
```

### 2. Enrich User Data
```
Get User ──────────────────┐
                           ├─→ Merge (By Key: id) → Send Email
Get User Preferences ──────┘
```

### 3. Parallel Processing
```
Split ──→ Process A ──┐
                      ├─→ Merge (Append) → Save Results
     └──→ Process B ──┘
```

### 4. Conditional Merge
```
If (condition) ──→ Path A ──┐
                            ├─→ Merge (Append) → Continue
            └──→ Path B ────┘
```

## Tips

1. **Use "Append" for simple concatenation** - It's the most common use case
2. **Use "Merge by Key" for data enrichment** - Like SQL JOINs
3. **Use "Merge by Position" for parallel lookups** - When order matters
4. **Always enable "Wait for All Inputs"** - Unless you specifically need pass-through behavior
5. **Check your data structure** - Ensure items have the merge key when using "Merge by Key"

## Error Handling

- If no inputs are provided, outputs an empty array
- If merge key is not found in items, those items are skipped (Merge by Key mode)
- If inputs have different lengths, shorter inputs are padded with empty objects (Merge by Position mode)

## Performance

- Merge is a lightweight operation
- "Append" mode is the fastest
- "Merge by Key" creates an internal map for efficient lookups
- No external API calls or heavy processing
