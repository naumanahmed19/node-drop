# Loop Node Examples

This document provides practical examples of using the Loop node in workflows.

## Example 1: Process API Results One by One

**Scenario**: You fetch a list of users from an API and want to send an email to each one.

**Workflow**:
1. HTTP Request node → Fetch users from API
2. Loop node → Iterate over users
3. Set node → Prepare email data for each user
4. HTTP Request node → Send email via email API

**Loop Node Configuration**:
```json
{
  "loopOver": "field",
  "fieldName": "users",
  "mode": "each"
}
```

**Input Data**:
```json
{
  "users": [
    { "name": "John", "email": "john@example.com" },
    { "name": "Jane", "email": "jane@example.com" },
    { "name": "Bob", "email": "bob@example.com" }
  ]
}
```

**Output**: Each user is sent individually to the next node.

---

## Example 2: Batch Process Database Records

**Scenario**: You have 1000 records to insert into a database, but want to batch them in groups of 100 to avoid overwhelming the database.

**Workflow**:
1. HTTP Request node → Fetch records
2. Loop node → Batch records
3. PostgreSQL node → Bulk insert batch

**Loop Node Configuration**:
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 100
}
```

**Input Data**:
```json
[
  { "id": 1, "name": "Record 1" },
  { "id": 2, "name": "Record 2" },
  // ... 998 more records
  { "id": 1000, "name": "Record 1000" }
]
```

**Output**: 10 batches, each containing 100 records wrapped in an object:
```json
[
  { "items": [/* 100 records */], "count": 100 },
  { "items": [/* 100 records */], "count": 100 },
  // ... 8 more batches
  { "items": [/* 100 records */], "count": 100 }
]
```

---

## Example 3: Process Nested Arrays

**Scenario**: You have an order with multiple line items, and you want to process each line item separately.

**Workflow**:
1. HTTP Request node → Fetch order details
2. Loop node → Extract and iterate over line items
3. Code node → Calculate tax for each item
4. Set node → Add calculated values

**Loop Node Configuration**:
```json
{
  "loopOver": "field",
  "fieldName": "order.lineItems",
  "mode": "each"
}
```

**Input Data**:
```json
{
  "orderId": "ORD-12345",
  "customer": "John Doe",
  "order": {
    "lineItems": [
      { "product": "Widget A", "price": 10.00, "quantity": 2 },
      { "product": "Widget B", "price": 15.00, "quantity": 1 },
      { "product": "Widget C", "price": 20.00, "quantity": 3 }
    ]
  }
}
```

**Output**: Each line item is sent individually.

---

## Example 4: Rate-Limited API Calls

**Scenario**: You need to call an API for each item, but the API has a rate limit of 10 requests per second.

**Workflow**:
1. Set node → Create array of IDs
2. Loop node → Batch IDs
3. Code node → Add delay between batches
4. HTTP Request node → Call API for each batch

**Loop Node Configuration**:
```json
{
  "loopOver": "items",
  "mode": "batch",
  "batchSize": 10
}
```

**Input Data**:
```json
[
  { "userId": 1 },
  { "userId": 2 },
  // ... more users
  { "userId": 50 }
]
```

**Output**: 5 batches of 10 users each, allowing you to process them with delays.

---

## Example 5: Transform Array Items

**Scenario**: You have an array of products and want to enrich each one with additional data.

**Workflow**:
1. HTTP Request node → Fetch products
2. Loop node → Iterate over products
3. HTTP Request node → Fetch additional details for each product
4. Set node → Merge product with details

**Loop Node Configuration**:
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Input Data**:
```json
[
  { "productId": "P1", "name": "Product 1" },
  { "productId": "P2", "name": "Product 2" },
  { "productId": "P3", "name": "Product 3" }
]
```

**Output**: Each product is sent individually for enrichment.

---

## Example 6: Multi-Level Iteration

**Scenario**: You have multiple departments, each with multiple employees, and you want to process each employee.

**Workflow**:
1. HTTP Request node → Fetch departments
2. Loop node (outer) → Iterate over departments
3. Loop node (inner) → Iterate over employees in each department
4. Set node → Process employee data

**Outer Loop Configuration**:
```json
{
  "loopOver": "items",
  "mode": "each"
}
```

**Inner Loop Configuration**:
```json
{
  "loopOver": "field",
  "fieldName": "employees",
  "mode": "each"
}
```

**Input Data**:
```json
[
  {
    "department": "Engineering",
    "employees": [
      { "name": "Alice", "role": "Developer" },
      { "name": "Bob", "role": "Designer" }
    ]
  },
  {
    "department": "Sales",
    "employees": [
      { "name": "Charlie", "role": "Sales Rep" },
      { "name": "Diana", "role": "Manager" }
    ]
  }
]
```

**Output**: Each employee from each department is processed individually.

---

## Tips for Using Loop Node

1. **Performance**: Use batch mode when making API calls to reduce the number of requests
2. **Error Handling**: Combine with If node to skip invalid items
3. **Data Transformation**: Use Set or Code nodes after Loop to transform each item
4. **Nested Loops**: You can chain multiple Loop nodes for multi-level iteration
5. **Empty Arrays**: Loop node handles empty arrays gracefully by returning no items
6. **Memory**: Be cautious with very large arrays - consider using batch mode to process in chunks
