# Data Preview Node

A powerful debugging and testing node that displays data in a terminal-like collapsible format. Perfect for testing loops, counters, and debugging data transformations in your workflows.

**Important:** This node is **non-modifying** - it visualizes data but passes through the original input unchanged to the next node.

## Features

- **Multiple Format Options**: Display data as JSON (pretty or compact), plain text, or ASCII tables
- **Collapsible Output**: Keep your workflow clean with collapsible preview sections
- **Smart Truncation**: Automatically limits output to prevent overwhelming displays
- **Timestamp Tracking**: Optional timestamps to track when data was processed
- **Terminal-Style Display**: Familiar terminal-like interface for developers

## Use Cases

1. **Testing Loops**: Preview counter values and iteration data
2. **Debugging Transformations**: See exactly what data looks like at each step
3. **API Response Inspection**: Quickly view API responses in readable format
4. **Array Processing**: Display arrays as formatted tables
5. **Data Validation**: Verify data structure and content during development

## Configuration

### Data Input
- **Type**: String (supports template expressions)
- **Default**: Empty (uses all input data)
- **Description**: Specify what data to preview using `{{json}}` for all data or `{{json.fieldName}}` for specific fields

### Preview Format
- **JSON (Pretty)**: Nicely formatted JSON with indentation
- **JSON (Compact)**: Single-line JSON for compact display
- **Text**: Plain text representation
- **Table**: ASCII table format (works best with arrays of objects)

### Max Lines
- **Type**: Number
- **Default**: 100
- **Range**: 10-1000
- **Description**: Maximum lines to display before truncation

### Show Timestamp
- **Type**: Boolean
- **Default**: true
- **Description**: Include execution timestamp in output

### Auto Collapse
- **Type**: Boolean
- **Default**: false
- **Description**: Start with preview collapsed

## Examples

### Example 1: Testing a Counter Loop
```
Input: {{json.counter}}
Format: Text
Output: Shows counter value at each iteration
```

### Example 2: Debugging API Response
```
Input: {{json}}
Format: JSON (Pretty)
Output: Formatted API response data
```

### Example 3: Array of Users as Table
```
Input: {{json.users}}
Format: Table
Output: ASCII table with user data columns
```

## Pass-Through Behavior

**The Data Preview node does NOT modify your data!**

```
[Previous Node] → [Data Preview] → [Next Node]
     data           (visualize)       same data
```

- Input data is passed through **unchanged**
- Preview metadata is stored separately for display
- Next node receives the **original data**
- Safe to add/remove without affecting workflow

## Output Structure

The node passes through the original input data and adds preview metadata in a `_preview` property for display purposes:

```json
{
  "json": { /* original data unchanged */ },
  "_preview": {
    "preview": "formatted data string",
    "format": "json|json-compact|text|table",
    "lineCount": 42,
    "timestamp": "2025-11-03T10:30:00.000Z",
    "metadata": {
      "inputItems": 1,
      "dataType": "object",
      "isArray": false,
      "truncated": false
    }
  }
}
```

The next node receives only the `json` data, not the preview metadata.

## Tips

- Use the **Table** format for arrays of objects to get a clean columnar view
- Set **Auto Collapse** to true when working with large datasets
- Adjust **Max Lines** based on your data size to prevent performance issues
- Use **JSON (Compact)** for quick inline previews of small objects
- The preview updates in real-time as you configure the node

## Custom Component

This node uses a custom `DataPreview` component for live preview in the configuration dialog, similar to the Image Preview node. The preview updates as you change settings, giving you immediate feedback.
