# Loop Node Workflow Patterns

This document illustrates common workflow patterns using the Loop node.

## Pattern 1: Simple Iteration Pipeline

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────────┐
│ HTTP Request│────▶│   Loop   │────▶│   Set    │────▶│HTTP Request │
│ (Get Users) │     │  (Each)  │     │(Transform)│     │(Send Email) │
└─────────────┘     └──────────┘     └──────────┘     └─────────────┘
     [Array]         [Individual]     [Enhanced]        [Per Item]
```

**Use Case**: Fetch users and send personalized emails to each one.

---

## Pattern 2: Batch Processing

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐
│   Manual    │────▶│   Loop   │────▶│  PostgreSQL  │
│   Trigger   │     │ (Batch)  │     │(Bulk Insert) │
└─────────────┘     └──────────┘     └──────────────┘
   [1000 items]     [10 batches]      [100 per batch]
```

**Use Case**: Insert large datasets into database efficiently.

---

## Pattern 3: Conditional Processing

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────────┐
│ HTTP Request│────▶│   Loop   │────▶│    If    │────▶│HTTP Request │
│(Get Orders) │     │  (Each)  │     │(Status?) │     │(Process)    │
└─────────────┘     └──────────┘     └──────────┘     └─────────────┘
                                           │
                                           │ (false)
                                           ▼
                                     ┌──────────┐
                                     │   Skip   │
                                     └──────────┘
```

**Use Case**: Process only orders with specific status.

---

## Pattern 4: Nested Loops

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ HTTP Request│────▶│ Loop (Outer) │────▶│ Loop (Inner) │────▶│   Set    │
│(Departments)│     │   (Each)     │     │   (Field)    │     │(Process) │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────┘
   [Departments]     [Per Dept]          [Per Employee]       [Individual]
```

**Use Case**: Process employees across multiple departments.

---

## Pattern 5: Enrichment Pipeline

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│ HTTP Request│────▶│   Loop   │────▶│HTTP Request │────▶│   Set    │
│(Get Products)│     │  (Each)  │     │(Get Details)│     │  (Merge) │
└─────────────┘     └──────────┘     └─────────────┘     └──────────┘
   [Product IDs]    [Individual]      [Details]          [Enriched]
```

**Use Case**: Enrich each product with additional data from another API.

---

## Pattern 6: Rate-Limited Processing

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────────┐
│   Manual    │────▶│   Loop   │────▶│   Code   │────▶│HTTP Request │
│   Trigger   │     │ (Batch)  │     │ (Delay)  │     │(API Call)   │
└─────────────┘     └──────────┘     └──────────┘     └─────────────┘
   [Many Items]     [10 per batch]   [Wait 1s]        [Batch Call]
```

**Use Case**: Respect API rate limits by processing in batches with delays.

---

## Pattern 7: Aggregation After Loop

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│ HTTP Request│────▶│   Loop   │────▶│HTTP Request │────▶│   Code   │
│(Get Users)  │     │  (Each)  │     │(Get Score)  │     │(Aggregate)│
└─────────────┘     └──────────┘     └─────────────┘     └──────────┘
   [Users]          [Individual]      [Scores]           [Total/Avg]
```

**Use Case**: Fetch individual scores and calculate aggregate statistics.

---

## Pattern 8: Field Extraction

```
┌─────────────┐     ┌──────────┐     ┌──────────┐
│ HTTP Request│────▶│   Loop   │────▶│   Set    │
│(Get Order)  │     │ (Field)  │     │(Process) │
└─────────────┘     └──────────┘     └──────────┘
   {order: {        [Individual]     [Enhanced]
    lineItems: []}}  [Line Items]
```

**Use Case**: Extract nested array and process each element.

---

## Pattern 9: Parallel Processing Simulation

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│   Manual    │────▶│   Loop   │────▶│   Switch    │
│   Trigger   │     │ (Batch)  │     │(Route by ID)│
└─────────────┘     └──────────┘     └─────────────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         ▼                 ▼                 ▼
                    ┌─────────┐      ┌─────────┐      ┌─────────┐
                    │Process A│      │Process B│      │Process C│
                    └─────────┘      └─────────┘      └─────────┘
```

**Use Case**: Distribute batches to different processing paths.

---

## Pattern 10: Error Recovery

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│ HTTP Request│────▶│   Loop   │────▶│HTTP Request │
│(Get Items)  │     │  (Each)  │     │(Process)    │
└─────────────┘     └──────────┘     └─────────────┘
                                           │
                                           │ (on error)
                                           ▼
                                     ┌──────────┐
                                     │   Set    │
                                     │(Log Error)│
                                     └──────────┘
```

**Use Case**: Process items individually with error handling per item.

---

## Best Practices

### 1. Choose the Right Mode
- **Each Mode**: When you need to process items individually
- **Batch Mode**: When you need to group items for efficiency

### 2. Optimize Batch Size
- Small batches (10-50): For API calls with rate limits
- Medium batches (100-500): For database operations
- Large batches (1000+): For bulk processing

### 3. Handle Empty Arrays
The Loop node gracefully handles empty arrays by outputting no items.

### 4. Use Field Extraction
When your data has nested arrays, use field extraction instead of preprocessing.

### 5. Combine with Other Nodes
- **If Node**: Filter items during iteration
- **Set Node**: Transform each item
- **Code Node**: Complex processing logic
- **Switch Node**: Route items to different paths

### 6. Memory Considerations
- For very large datasets (>100k items), use batch mode
- Consider splitting into multiple workflows
- Monitor execution time and memory usage

### 7. Error Handling
- Use If node to validate items before processing
- Implement retry logic for failed items
- Log errors for debugging

---

## Common Mistakes to Avoid

❌ **Don't**: Loop over non-array fields
✅ **Do**: Validate field is an array before looping

❌ **Don't**: Use batch size of 1 (use each mode instead)
✅ **Do**: Use appropriate batch sizes for your use case

❌ **Don't**: Loop over extremely large arrays without batching
✅ **Do**: Use batch mode for large datasets

❌ **Don't**: Forget to handle empty arrays
✅ **Do**: Design workflows that handle empty results gracefully

---

## Performance Tips

1. **Batch API Calls**: Group multiple items into single API requests when possible
2. **Use Parallel Execution**: Split batches across multiple workflow paths
3. **Optimize Batch Size**: Test different sizes to find optimal performance
4. **Monitor Memory**: Watch for memory issues with large datasets
5. **Add Delays**: Use Code node to add delays between batches for rate limiting
