# Split Node

Divide data into multiple outputs or batches for parallel processing and batch operations.

## Overview

The Split node is essential for workflows where you need to process large datasets in batches, perform A/B testing, or categorize data for parallel processing. It accepts a single input and splits it based on your selected strategy.

## Split Modes

### 1. Batch (Default)
Splits items into batches of a specified size.

**Example:**
```
Input: [
  { "id": 1 },
  { "id": 2 },
  { "id": 3 },
  { "id": 4 },
  { "id": 5 }
]

Batch Size: 2

Output: [
  { "batch": [{ "id": 1 }, { "id": 2 }], "batchSize": 2 },
  { "batch": [{ "id": 3 }, { "id": 4 }], "batchSize": 2 },
  { "batch": [{ "id": 5 }], "batchSize": 1 }
]
```

**Use Cases:**
- Processing large datasets in chunks
- Rate-limited API calls (e.g., 100 items per request)
- Memory-efficient data processing
- Parallel batch processing

### 2. By Field Value
Splits items by unique values of a specified field.

**Example:**
```
Input: [
  { "status": "pending", "id": 1 },
  { "status": "completed", "id": 2 },
  { "status": "pending", "id": 3 },
  { "status": "failed", "id": 4 }
]

Field Name: "status"

Output (first group): [
  { "status": "pending", "id": 1 },
  { "status": "pending", "id": 3 }
]
```

**Use Cases:**
- Categorizing data by type, status, or category
- Routing items to different processing paths
- Grouping related items together
- Data segmentation

### 3. Even/Odd
Splits items into even and odd index positions.

**Example:**
```
Input: [
  { "id": 1 },
  { "id": 2 },
  { "id": 3 },
  { "id": 4 }
]

Output 1 (even indices): [{ "id": 1 }, { "id": 3 }]
Output 2 (odd indices): [{ "id": 2 }, { "id": 4 }]
```

**Use Cases:**
- Simple A/B testing
- Load balancing across two paths
- Alternating processing
- Data sampling

### 4. Percentage
Splits items by percentage (e.g., 70/30 split).

**Example:**
```
Input: 10 items

Percentage: 70

Output 1: First 7 items (70%)
Output 2: Last 3 items (30%)
```

**Use Cases:**
- A/B testing with custom ratios
- Training/testing data split for ML
- Sampling data for analysis
- Weighted distribution

### 5. Equal Parts
Splits items into N equal parts.

**Example:**
```
Input: [1, 2, 3, 4, 5, 6]

Number of Parts: 3

Output 1: [1, 2]
Output 2: [3, 4]
Output 3: [5, 6]
```

**Use Cases:**
- Parallel processing across multiple workers
- Load distribution
- Multi-path workflows
- Data partitioning

## Configuration

### Mode
Select how to split the input data.

### Batch Size (for "Batch" mode)
Number of items per batch. Must be greater than 0.

### Field Name (for "By Field Value" mode)
The field name to use for splitting items. Supports nested paths like `user.status` or `data.category`.

### Percentage (for "Percentage" mode)
Percentage of items for the first output (0-100). The remaining items go to the second output.

### Number of Parts (for "Equal Parts" mode)
Number of equal parts to split into. Must be greater than 0.

## Common Workflows

### 1. Batch Processing Large Datasets
```
Get 1000 Users → Split (Batch: 100) → Loop → Process Batch → Save
```

### 2. A/B Testing
```
Get Users → Split (Percentage: 50%) → Path A (Email Template 1)
                                    → Path B (Email Template 2)
```

### 3. Categorize and Route
```
Get Orders → Split (By Field: status) → Process Pending
                                      → Process Completed
                                      → Process Failed
```

### 4. Parallel Processing
```
Get Data → Split (Equal Parts: 4) → Worker 1
                                  → Worker 2
                                  → Worker 3
                                  → Worker 4
                                  → Merge → Continue
```

### 5. Rate-Limited API Calls
```
Get 500 Items → Split (Batch: 50) → Loop → HTTP Request (max 50/request)
```

## Tips

1. **Use "Batch" for large datasets** - Process data in manageable chunks
2. **Use "By Field Value" for categorization** - Route items based on properties
3. **Use "Percentage" for A/B testing** - Test different approaches
4. **Use "Equal Parts" for parallel processing** - Distribute load evenly
5. **Combine with Loop node** - Process each batch or group separately
6. **Combine with Merge node** - Recombine results after parallel processing

## Error Handling

- If no items are provided, outputs an empty array
- If batch size is 0 or negative, throws an error
- If field is not found in items, those items are grouped as "undefined"
- If percentage is outside 0-100 range, throws an error
- If number of parts is 0 or negative, throws an error

## Performance

- Split is a lightweight operation
- "Batch" mode is the most common and efficient
- "By Field Value" creates an internal map for grouping
- No external API calls or heavy processing
- Memory usage scales with input size

## Batch Mode Output Format

When using Batch mode, each output item contains:
```json
{
  "batch": [...items in this batch...],
  "batchSize": 10
}
```

You can access the batch items using `{{ $json.batch }}` in subsequent nodes.

## Example: Processing in Batches

```
1. HTTP Request → Get 1000 users
2. Split (Batch: 100) → Creates 10 batches
3. Loop → Iterate over each batch
4. Code → Process batch items: {{ $json.batch }}
5. HTTP Request → Send batch to API
```

## Combining Split and Merge

```
Get Data → Split (Equal Parts: 3) → Process Path 1 ┐
                                  → Process Path 2 ├→ Merge → Continue
                                  → Process Path 3 ┘
```

This pattern enables parallel processing with result aggregation.
