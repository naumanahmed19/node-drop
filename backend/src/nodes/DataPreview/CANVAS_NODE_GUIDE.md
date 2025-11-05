# Data Preview Canvas Node - Interactive Guide

## 🎯 The Collapsible Canvas Node

The Data Preview node now has a **collapsible interface** in the workflow canvas, just like the Image Preview node. This allows you to see data previews directly on the canvas without opening the output panel.

## 🖱️ Interaction

### Click to Expand/Collapse
```
Collapsed (200px)              Expanded (360px)
     ↓                              ↓
┌─────────────┐              ┌──────────────────┐
│ 🖥️ Data     │   [CLICK]    │ 🖥️ Data Preview  │
│   Preview   │   ────→      │                  │
│ 42 lines    │              │ [Full Preview]   │
│             │              │                  │
│ {           │              │ [Metadata]       │
│   "data":.. │              │                  │
│ ...         │              │ [Copy Button]    │
└─────────────┘              └──────────────────┘
```

## 📐 Size Specifications

### Collapsed State
- **Width**: 200px
- **Height**: Auto (fits content)
- **Content**: First 3 lines of preview
- **Purpose**: Quick glance at data

### Expanded State
- **Width**: 360px
- **Height**: Auto (fits content)
- **Content**: Full terminal preview (240px scroll area)
- **Purpose**: Detailed data inspection

## 🎨 Visual Elements

### Header (Both States)
```
┌────────────────────────────────┐
│ 🖥️ Data Preview    42 lines    │  ← Icon, Name, Line Count
└────────────────────────────────┘
```

### Collapsed Content
```
┌────────────────────────────────┐
│ {                              │  ← First 3 lines
│   "counter": 5,                │
│   "index": 4,                  │
│ ...                            │  ← Ellipsis if more
└────────────────────────────────┘
```

### Expanded Content
```
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │
│ │ 🖥️ Data Preview  10:30  42 lines 📋│ │ ← Terminal Header
│ ├────────────────────────────────────┤ │
│ │                                    │ │
│ │ {                                  │ │
│ │   "counter": 5,                    │ │ ← Scrollable
│ │   "index": 4,                      │ │   Content
│ │   "data": {                        │ │   (240px)
│ │     "name": "Test Item",           │ │
│ │     "value": 100                   │ │
│ │   }                                │ │
│ │ }                                  │ │
│ │                                    │ │
│ ├────────────────────────────────────┤ │
│ │ 📊 Format: JSON (Pretty)          │ │ ← Terminal Footer
│ └────────────────────────────────────┘ │
│                                        │
│ ┌──────────────┐  ┌──────────────┐   │
│ │ Input: 1     │  │ Type: object │   │ ← Metadata
│ └──────────────┘  └──────────────┘   │
└────────────────────────────────────────┘
```

## 🎭 States

### 1. Idle (No Data)
```
┌─────────────────────────┐
│ 🖥️ Data Preview         │
│ Waiting for data        │
│                         │
│ [Terminal Icon]         │
│ No data to preview      │
│                         │
└─────────────────────────┘
```

### 2. Collapsed (With Data)
```
┌─────────────────────────┐
│ 🖥️ Data Preview         │
│ 42 lines                │
│                         │
│ {                       │
│   "counter": 5,         │
│   "index": 4,           │
│ ...                     │
└─────────────────────────┘
```

### 3. Expanded (With Data)
```
┌──────────────────────────────────────┐
│ 🖥️ Data Preview           42 lines   │
├──────────────────────────────────────┤
│ [Full Terminal Display]              │
│ [Scrollable Content]                 │
│ [Metadata Panel]                     │
└──────────────────────────────────────┘
```

### 4. Executing
```
┌─────────────────────────┐
│ 🖥️ Data Preview         │
│ [Spinner Animation]     │
│ Processing...           │
└─────────────────────────┘
```

## 🎨 Color Scheme

### Node Colors
- **Icon Background**: Green (#4CAF50)
- **Input Handle**: Green
- **Output Handle**: Green
- **Border (Selected)**: Blue highlight

### Terminal Colors
- **Header Background**: Dark Gray (#1F2937)
- **Content Background**: Very Dark Gray (#111827)
- **Footer Background**: Light Gray (#F9FAFB)
- **Text (Terminal)**: Light Gray (#F3F4F6)
- **Text (Footer)**: Dark Gray (#374151)

## 🔄 State Persistence

The expansion state is **persisted** in the node parameters:

```typescript
{
  parameters: {
    dataInput: "{{json}}",
    previewFormat: "json",
    maxLines: 100,
    showTimestamp: true,
    autoCollapse: false,
    isExpanded: true  // ← Persisted state
  }
}
```

This means:
- ✅ Expansion state survives page refresh
- ✅ Expansion state saved with workflow
- ✅ Each node instance has independent state

## 🎯 Use Cases

### 1. Quick Data Check (Collapsed)
```
[HTTP Request] → [Data Preview] → [If Condition]
                      ↓
                 (collapsed)
                 Quick glance
```

### 2. Detailed Inspection (Expanded)
```
[Loop] → [Transform] → [Data Preview] → [Next Step]
                            ↓
                       (expanded)
                    Full data view
```

### 3. Multiple Previews
```
[Start] → [Preview 1] → [Transform] → [Preview 2] → [End]
           (collapsed)                  (collapsed)
```

### 4. Debugging Workflow
```
[Complex Logic] → [Data Preview] ← Click to expand
                       ↓
                  See full data
                  Copy to clipboard
                  Verify structure
```

## 💡 Pro Tips

1. **Keep Collapsed by Default**
   - Set `autoCollapse: true` in config
   - Keeps canvas clean
   - Expand only when needed

2. **Use Multiple Previews**
   - Add preview nodes at key points
   - Keep them collapsed
   - Expand to debug specific steps

3. **Copy Data Quickly**
   - Expand node
   - Click copy button in terminal header
   - Paste into external tools

4. **Monitor Loops**
   - Add preview inside loop
   - See data change on each iteration
   - Expand to see full details

5. **Compare Before/After**
   - Add preview before transformation
   - Add preview after transformation
   - Expand both to compare

## 🔧 Technical Details

### Component: DataPreviewNode.tsx
- Uses `BaseNodeWrapper` for consistent behavior
- Implements `onToggleExpand` callback
- Manages `isExpanded` state
- Fetches data from `lastExecutionResult`
- Renders collapsed/expanded content conditionally

### Integration Points
1. **WorkflowEditor.tsx** - Node type mapping
2. **BaseNodeWrapper.tsx** - Wrapper component
3. **WorkflowStore** - Execution results
4. **Node Parameters** - State persistence

### Performance
- Memoized content rendering
- Conditional rendering (collapsed vs expanded)
- Efficient state updates
- No unnecessary re-renders

## 🎉 Summary

The Data Preview canvas node provides:
- ✅ **Collapsible interface** - Click to expand/collapse
- ✅ **Persistent state** - Remembers expansion
- ✅ **Real-time updates** - Shows execution data
- ✅ **Terminal theme** - Beautiful dark display
- ✅ **Copy functionality** - Quick clipboard access
- ✅ **Metadata display** - Format, lines, type info
- ✅ **Scrollable content** - Handle large data
- ✅ **Responsive design** - Adapts to content

Perfect for debugging, testing, and monitoring your workflows! 🚀
