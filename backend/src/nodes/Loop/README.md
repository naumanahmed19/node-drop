# Loop Node

The Loop node allows you to iterate over items and process them individually or in batches. It's essential for data processing workflows where you need to handle arrays of data.

## ⭐ NEW: Simple Repeat Mode!
**No Code node needed!** Just select "Repeat N Times" and enter how many iterations you want. Perfect for simple counting loops!

👉 **[Simple Repeat Guide](./SIMPLE_REPEAT_GUIDE.md)** - The easiest way to loop!

## Quick Start Guides
- **[Simple Repeat Guide](./SIMPLE_REPEAT_GUIDE.md)** ⭐ NEW! - Loop N times without code
- **[How to Loop 100 Times](./LOOP_100_TIMES_GUIDE.md)** - Step-by-step guide (old method)
- **[Manual Trigger Examples](./MANUAL_TRIGGER_EXAMPLES.md)** - Using Loop with Manual Trigger
- **[Workflow Patterns](./WORKFLOW_PATTERNS.md)** - Common workflow patterns
- **[Examples](./EXAMPLES.md)** - Practical use case examples

## Features

- **Repeat N times** ⭐ NEW! - Simple repeat like a for loop (no code needed!)
- **Iterate over input items**: Process all items from the previous node
- **Extract and iterate**: Loop over an array stored in a specific field
- **Batch processing**: Group items into batches for efficient processing
- **Nested field support**: Access arrays in nested objects (e.g., `data.users`)

## Use Cases

1. **Process API results**: Loop through paginated API responses
2. **Batch operations**: Process large datasets in manageable chunks
3. **Data transformation**: Apply operations to each item in an array
4. **Multi-step workflows**: Send each item through a series of processing nodes

## Configuration

### Loop Over

Choose what to iterate over:

- **Repeat N Times** ⭐ NEW! - Simple repeat like a for loop (enter number of iterations)
- **All Input Items**: Loop over all items received from the previous node
- **Field Value**: Extract an array from a specific field and loop over it

### Number of Iterations (when using Repeat N Times)

Enter how many times to repeat (1 to 100,000). Each iteration provides:
- `iteration`: Current iteration number (1-based)
- `index`: Array index (0-based)
- `total`: Total number of iterations

### Mode

Choose how to process items:

- **Process Each Item**: Output items one by one for individual processing
- **Batch Processing**: Group items into batches of a specified size

### Field Name (when looping over field)

Specify the field containing the array to loop over. Supports nested paths:
- Simple: `users`
- Nested: `data.users`
- Deep nesting: `response.data.items`

### Batch Size (when using batch mode)

Number of items to include in each batch. Each batch is output as a single item containing an array.

## Examples

### Example 1: Simple Iteration

**Input:**
```json
[
  { "id": 1, "name": "John" },
  { "id": 2, "name": "Jane" },
  { "id": 3, "name": "Bob" }
]
```

**Configuration:**
- Loop Over: All Input Items
- Mode: Process Each Item

**Output:**
Each item is sent individually to the next node for processing.

### Example 2: Field Extraction

**Input:**
```json
{
  "users": [
    { "name": "John", "email": "john@example.com" },
    { "name": "Jane", "email": "jane@example.com" }
  ]
}
```

**Configuration:**
- Loop Over: Field Value
- Field Name: `users`
- Mode: Process Each Item

**Output:**
Each user object is sent individually.

### Example 3: Batch Processing

**Input:**
```json
[
  { "id": 1 },
  { "id": 2 },
  { "id": 3 },
  { "id": 4 },
  { "id": 5 }
]
```

**Configuration:**
- Loop Over: All Input Items
- Mode: Batch Processing
- Batch Size: 2

**Output:**
```json
[
  { "items": [{ "id": 1 }, { "id": 2 }], "count": 2 },
  { "items": [{ "id": 3 }, { "id": 4 }], "count": 2 },
  { "items": [{ "id": 5 }], "count": 1 }
]
```

## Tips

- Use batch processing when making API calls with rate limits
- Combine with the If node to filter items during iteration
- Use with the Set node to transform each item
- Chain multiple Loop nodes for nested iterations

## Error Handling

The node will throw errors in these cases:
- Field name is empty when looping over a field
- Specified field doesn't exist or isn't an array
- Batch size is less than or equal to 0
- No input items when trying to extract a field
