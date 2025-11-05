# Data Preview Node - Example Usage

## Example 1: Testing a Counter Loop

**Workflow Setup:**
1. Manual Trigger → Loop Node → Data Preview Node

**Loop Node Configuration:**
- Loop Type: Counter
- Start: 1
- End: 10

**Data Preview Node Configuration:**
- Data Input: `{{json}}`
- Preview Format: JSON (Pretty)
- Max Lines: 100
- Show Timestamp: true

**Expected Output:**
```json
{
  "preview": "{\n  \"counter\": 5,\n  \"index\": 4\n}",
  "format": "json",
  "lineCount": 4,
  "originalData": {
    "counter": 5,
    "index": 4
  },
  "timestamp": "2025-11-03T10:30:00.000Z",
  "metadata": {
    "inputItems": 1,
    "dataType": "object",
    "isArray": false,
    "truncated": false
  }
}
```

## Example 2: Debugging API Response

**Workflow Setup:**
1. Manual Trigger → HTTP Request → Data Preview Node

**HTTP Request Configuration:**
- URL: `https://jsonplaceholder.typicode.com/users`
- Method: GET

**Data Preview Node Configuration:**
- Data Input: `{{json}}`
- Preview Format: Table
- Max Lines: 200

**Expected Output:**
ASCII table showing all user fields in a clean columnar format.

## Example 3: Array Processing

**Workflow Setup:**
1. Manual Trigger → Code Node → Data Preview Node

**Code Node:**
```javascript
const items = [];
for (let i = 1; i <= 5; i++) {
  items.push({
    id: i,
    name: `Item ${i}`,
    value: i * 10,
    active: i % 2 === 0
  });
}
return items;
```

**Data Preview Node Configuration:**
- Data Input: `{{json}}`
- Preview Format: Table
- Max Lines: 100

**Expected Output:**
```
+----+--------+-------+--------+
| id | name   | value | active |
+----+--------+-------+--------+
| 1  | Item 1 | 10    | false  |
| 2  | Item 2 | 20    | true   |
| 3  | Item 3 | 30    | false  |
| 4  | Item 4 | 40    | true   |
| 5  | Item 5 | 50    | false  |
+----+--------+-------+--------+
```

## Example 4: Specific Field Preview

**Workflow Setup:**
1. Manual Trigger → HTTP Request → Data Preview Node

**Data Preview Node Configuration:**
- Data Input: `{{json.data.users[0].email}}`
- Preview Format: Text

This will show only the email field from the first user in the response.

## Example 5: Large Dataset with Auto Collapse

**Data Preview Node Configuration:**
- Data Input: `{{json}}`
- Preview Format: JSON (Compact)
- Max Lines: 50
- Auto Collapse: true

Perfect for large datasets where you want the preview available but not taking up screen space by default.

## Tips for Best Results

1. **Use Table format** for arrays of objects with consistent structure
2. **Use JSON (Pretty)** for nested objects and complex data
3. **Use JSON (Compact)** for quick inline previews
4. **Use Text format** for simple strings or numbers
5. **Set Auto Collapse** to true when working with multiple preview nodes
6. **Adjust Max Lines** based on your data size (lower for performance, higher for completeness)
