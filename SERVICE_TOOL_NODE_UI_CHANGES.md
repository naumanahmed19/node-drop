# Service and Tool Node UI Changes - Visual Guide

## Overview
This document provides a visual guide to the UI changes made to prevent execution of service and tool nodes.

## What are Service and Tool Nodes?

### Service Nodes (type: 'service')
Service nodes provide functionality to other nodes and cannot be executed independently.

**Examples:**
- `OpenAI Model` - Provides AI model capabilities to AI Agent nodes
- `Anthropic Model` - Provides Claude model capabilities to AI Agent nodes
- `Buffer Memory` - Provides memory storage for AI agents
- `Redis Memory` - Provides Redis-based memory for AI agents
- `Window Memory` - Provides window-based memory for AI agents

### Tool Nodes (type: 'tool')
Tool nodes are called by AI Agent nodes to perform specific tasks.

**Examples:**
- `Calculator Tool` - Performs mathematical calculations
- `HTTP Request Tool` - Makes HTTP requests to external APIs
- `Knowledge Base Tool` - Queries knowledge bases

## UI Changes by Location

### 1. Node Configuration Dialog - Middle Column

**Location:** When you open a node's configuration dialog

**Before:**
```
┌─────────────────────────────────────┐
│ [Icon] Node Name          [▶ Run]  │  ← Execute button visible
│                           [⋮ Menu] │
└─────────────────────────────────────┘
```

**After (Service/Tool Nodes):**
```
┌─────────────────────────────────────┐
│ [Icon] Node Name          [⋮ Menu] │  ← Execute button hidden
└─────────────────────────────────────┘
```

**After (Regular Nodes):**
```
┌─────────────────────────────────────┐
│ [Icon] Node Name          [▶ Run]  │  ← Execute button still visible
│                           [⋮ Menu] │
└─────────────────────────────────────┘
```

### 2. Test Tab

**Location:** Inside node configuration dialog → Test tab

**Before:**
```
┌─────────────────────────────────────┐
│ Test Input Data                     │
│ ┌─────────────────────────────────┐ │
│ │ {"test": "data"}                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [▶ Test Node]                      │  ← Test button visible
└─────────────────────────────────────┘
```

**After (Service/Tool Nodes):**
```
┌─────────────────────────────────────┐
│ ℹ️ Service Node                     │
│                                     │
│ This node cannot be executed        │
│ directly. It is designed to be      │
│ called by other nodes in your       │
│ workflow.                           │
│                                     │
│ Service nodes (like AI models)      │
│ provide functionality to other      │
│ nodes and are not standalone        │
│ executables.                        │
└─────────────────────────────────────┘
```

**After (Regular Nodes):**
```
┌─────────────────────────────────────┐
│ Test Input Data                     │
│ ┌─────────────────────────────────┐ │
│ │ {"test": "data"}                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [▶ Test Node]                      │  ← Test button still visible
└─────────────────────────────────────┘
```

### 3. Inputs Column (Node Tree)

**Location:** Right side of node configuration dialog → Inputs tab

**Before:**
```
┌─────────────────────────────────────┐
│ ▼ [Icon] Previous Node    [▶] ✓    │  ← Execute button on hover
│   └─ data: {...}                    │
└─────────────────────────────────────┘
```

**After (Service/Tool Nodes):**
```
┌─────────────────────────────────────┐
│ ▼ [Icon] Previous Node         ✓   │  ← Execute button hidden
│   └─ data: {...}                    │
└─────────────────────────────────────┘
```

**After (Regular Nodes):**
```
┌─────────────────────────────────────┐
│ ▼ [Icon] Previous Node    [▶] ✓    │  ← Execute button still visible
│   └─ data: {...}                    │
└─────────────────────────────────────┘
```

### 4. Node Context Menu (Right-Click)

**Location:** Right-click on a node in the workflow canvas

**Before:**
```
┌─────────────────────┐
│ ⚙️  Properties      │
│ ▶️  Execute Node    │  ← Execute option visible
│ ─────────────────── │
│ 🔒 Lock Node        │
│ ─────────────────── │
│ 📋 Duplicate        │
│ 🗑️  Delete          │
└─────────────────────┘
```

**After (Service/Tool Nodes):**
```
┌─────────────────────┐
│ ⚙️  Properties      │
│ ─────────────────── │  ← Execute option hidden
│ 🔒 Lock Node        │
│ ─────────────────── │
│ 📋 Duplicate        │
│ 🗑️  Delete          │
└─────────────────────┘
```

**After (Regular Nodes):**
```
┌─────────────────────┐
│ ⚙️  Properties      │
│ ▶️  Execute Node    │  ← Execute option still visible
│ ─────────────────── │
│ 🔒 Lock Node        │
│ ─────────────────── │
│ 📋 Duplicate        │
│ 🗑️  Delete          │
└─────────────────────┘
```

### 5. Node Toolbar (Floating Above Node)

**Location:** Hover over a node in the workflow canvas

**Before:**
```
     [▶] [⏸]
┌─────────────────┐
│  [Icon] Node    │
│                 │
└─────────────────┘
```

**After (Service/Tool Nodes):**
```
        [⏸]
┌─────────────────┐
│  [Icon] Node    │  ← Execute button hidden
│                 │
└─────────────────┘
```

**After (Regular Nodes):**
```
     [▶] [⏸]
┌─────────────────┐
│  [Icon] Node    │  ← Execute button still visible
│                 │
└─────────────────┘
```

## Implementation Details

### How It Works

1. **Node Type Detection**: The system checks the `type` property of each node:
   - `type: 'service'` → Not executable
   - `type: 'tool'` → Not executable
   - Any other type → Executable

2. **Utility Functions**: Centralized functions in `nodeTypeUtils.ts`:
   ```typescript
   isServiceNode(nodeType)      // Returns true for service nodes
   isToolNode(nodeType)         // Returns true for tool nodes
   isNodeExecutable(nodeType)   // Returns false for service/tool nodes
   ```

3. **UI Components**: All UI components check node executability before showing execute buttons

### Affected Components

1. `MiddleColumn.tsx` - Node configuration dialog header
2. `NodeTester.tsx` - Test tab content
3. `InputsColumn.tsx` - Input node tree
4. `NodeContextMenu.tsx` - Right-click context menu
5. `NodeToolbarContent.tsx` - Floating node toolbar (via `nodeTypeClassification.ts`)

## User Benefits

✅ **Clearer Interface**: Users immediately understand which nodes can be executed

✅ **Prevents Errors**: Eliminates confusion from attempting to execute non-executable nodes

✅ **Better Guidance**: Informative messages explain why certain nodes cannot be executed

✅ **Consistent Experience**: All UI components behave consistently

## Developer Benefits

✅ **Maintainable**: Centralized utility functions make it easy to add new node type checks

✅ **Type-Safe**: Uses TypeScript types for better IDE support

✅ **Extensible**: Easy to add new node types with different execution capabilities

✅ **Testable**: Clear separation of concerns makes testing easier
