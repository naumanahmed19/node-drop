# DataPreviewNode Append Mode Feature

## Overview
Added an append mode to DataPreviewNode that works similar to ChatInterfaceNode's message history, allowing you to accumulate and view multiple execution results with the latest shown on top.

## New Features

### Backend Changes (`backend/src/nodes/DataPreview/DataPreview.node.ts`)

1. **Append Mode Toggle**
   - New boolean parameter `appendMode` (default: false)
   - When enabled, each execution appends to history instead of replacing

2. **Max History Items**
   - New parameter `maxHistoryItems` (default: 10, range: 1-50)
   - Controls how many historical previews to keep
   - Only visible when append mode is enabled

3. **Preview History Storage**
   - Each preview gets a unique ID and timestamp
   - History stored in `previewHistory` array
   - Latest previews added to the beginning (index 0)
   - Automatically trimmed to `maxHistoryItems` limit

### Frontend Changes (`frontend/src/components/workflow/nodes/DataPreviewNode.tsx`)

1. **History Display**
   - When append mode is enabled, shows all historical previews
   - Latest preview shown first with "Latest" badge
   - Older previews numbered (#2, #3, etc.)
   - Each preview shows its own timestamp and metadata

2. **Collapsed View**
   - Shows preview of the latest item from history
   - Maintains same compact format

3. **Header Info**
   - In append mode: Shows count of previews (e.g., "5 previews")
   - In normal mode: Shows line count (e.g., "42 lines")

## Usage

1. Add a DataPreviewNode to your workflow
2. Enable "Append Mode" in the node configuration
3. Optionally adjust "Max History Items" (default: 10)
4. Execute the workflow multiple times
5. Each execution will append to the history, with latest on top

## Use Cases

- **Loop Debugging**: See all iterations of a loop in one place
- **Incremental Data Processing**: Track how data changes over multiple runs
- **Testing**: Compare outputs across different executions
- **Monitoring**: Keep a rolling history of recent data transformations

## Example

```
Execution 1: [1, 2, 3]
Execution 2: [4, 5, 6]
Execution 3: [7, 8, 9]

Display (latest on top):
┌─────────────────┐
│ Latest: [7,8,9] │
├─────────────────┤
│ #2: [4,5,6]     │
├─────────────────┤
│ #3: [1,2,3]     │
└─────────────────┘
```

## Technical Details

- History persists in node parameters between executions
- Each preview includes full metadata (format, line count, input items, etc.)
- Execution ID tracking prevents duplicate processing
- Compatible with all existing preview formats (JSON, Table, Text)
