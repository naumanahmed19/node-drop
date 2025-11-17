# Service and Tool Node Execution Fix

## Summary

Created a reusable utility to identify service and tool nodes, and updated the UI to prevent direct execution of these node types. Service and tool nodes are designed to be called by other nodes (like AI Agent nodes) and should not be executed independently.

## Changes Made

### 1. Created Reusable Utility (`frontend/src/utils/nodeTypeUtils.ts`)

New utility functions to check node types:

- `isServiceNode(nodeType)` - Check if a node is a service type
- `isToolNode(nodeType)` - Check if a node is a tool type  
- `isNodeExecutable(nodeType)` - Check if a node can be executed directly
- `isServiceOrToolNode(nodeType)` - Check if a node is service or tool type

These functions accept either a node type string or a full NodeType object for flexibility.

### 2. Updated Middle Column (`frontend/src/components/workflow/node-config/MiddleColumn.tsx`)

- Added import for `isNodeExecutable` utility
- Modified execute button to only show for executable nodes:
  ```tsx
  {!readOnly && isNodeExecutable(nodeType) && (
    <div className="relative">
      <Button onClick={onExecute} ...>
        <Play className="h-4 w-4" />
      </Button>
    </div>
  )}
  ```

### 3. Updated Test Tab (`frontend/src/components/node/NodeTester.tsx`)

- Added import for `isServiceOrToolNode` utility
- Added informational message for service/tool nodes explaining they cannot be executed directly
- Hidden test input and execute button for service/tool nodes
- Shows different messages for service vs tool nodes:
  - **Service nodes**: "Service nodes (like AI models) provide functionality to other nodes and are not standalone executables."
  - **Tool nodes**: "Tool nodes are called by AI Agent nodes to perform specific tasks."

### 4. Updated Inputs Column (`frontend/src/components/workflow/node-config/InputsColumn.tsx`)

- Added import for `isNodeExecutable` utility
- Modified execute button in node tree to only show for executable nodes:
  ```tsx
  {nodeTypeDefinition && isNodeExecutable(nodeTypeDefinition) && (
    <Button onClick={() => onExecuteNode(inputNode.id)}>
      <Play className="h-3.5 w-3.5" />
    </Button>
  )}
  ```

### 5. Updated Node Context Menu (`frontend/src/components/workflow/components/NodeContextMenu.tsx`)

- Added import for `isNodeExecutable` utility and `NodeType` type
- Added optional `nodeType` prop to interface
- Added logic to check if node is executable
- Conditionally render "Execute Node" menu item only for executable nodes:
  ```tsx
  {canExecute && (
    <ContextMenuItem onClick={onExecute}>
      <Play className="mr-2 h-4 w-4" />
      Execute Node
    </ContextMenuItem>
  )}
  ```

### 6. Updated Base Node Wrapper (`frontend/src/components/workflow/nodes/BaseNodeWrapper.tsx`)

- Added import for `useNodeTypes` hook and `useMemo`
- Added code to get node type definition from store:
  ```tsx
  const { nodeTypes } = useNodeTypes()
  const nodeTypeDefinition = useMemo(() => 
    nodeTypes.find(nt => nt.type === data.nodeType),
    [nodeTypes, data.nodeType]
  )
  ```
- Updated all three `NodeContextMenu` calls to pass `nodeType={nodeTypeDefinition}` prop

## Backend Node Types

The backend nodes now have the `nodeCategory` property set to indicate they are service or tool nodes:

### Service Nodes (nodeCategory: 'service')
- `AnthropicModel.node.js` - Anthropic Claude model provider (type: 'anthropic-model')
- `OpenAIModel.node.js` - OpenAI GPT model provider (type: 'openai-model')
de.js` - Buffer memory for AI agents (type: 'buffer-memory')
- `RedisMemory.node.js` - Redis-based memory for AI agents (type: 'redis-memory')
- `WindowMemory.node.js` - Window-based memory for AI agents (type: 'window-memory')

### Tool Nodes (nodeCategory: 'tool')
- `CalculatorTool.node.js` - Mathematical calculations (type: 'calculator-tool')
- `HttpRequestTool.node.js` - HTTP requests to external APIs (type: 'http-request-tool')
- `KnowledgeBaseTool.node.js` - Knowledge base queries (type: 'knowledge-base-tool')

**Important:** The `type` property remains the unique identifier for each node (e.g., 'openai-model', 'calculator-tool'). The new `nodeCategory` property is used to indicate whether a node is a service or tool node that should not be directly executable.

## User Experience Improvements

### Before
- Users could attempt to execute service/tool nodes directly
- This would result in errors since these nodes are designed to be called by other nodes
- Confusing UX with execute buttons visible on non-executable nodes

### After
- Execute buttons are hidden for service/tool nodes in:
  - Middle column (node configuration dialog)
  - Test tab (with informative message)
  - Inputs column (node tree)
  - Context menu (right-click menu)
  - Node toolbar (floating toolbar above nodes)
- Clear messaging in Test tab explaining why these nodes cannot be executed
- Consistent behavior across all UI components

## Technical Details

### Node Type Detection
The utility functions check the `nodeCategory` property of nodes:
- Regular nodes: No `nodeCategory` property → Executable
- Service nodes: `nodeCategory: 'service'` → Not executable
- Tool nodes: `nodeCategory: 'tool'` → Not executable

The `type` property (e.g., 'openai-model', 'http-request-tool') remains the unique identifier used for node discovery and registration.

### Backward Compatibility
- The `nodeType` prop in `NodeContextMenu` is optional
- If not provided, defaults to showing execute button (backward compatible)
- All existing nodes continue to work as expected

## Testing Recommendations

1. **Service Nodes**: Open any AI model node (Anthropic, OpenAI) and verify:
   - No execute button in middle column header
   - Test tab shows informational message
   - No execute option in context menu

2. **Tool Nodes**: Open any tool node (Calculator, HTTP Request) and verify:
   - No execute button in middle column header
   - Test tab shows informational message
   - No execute option in context menu

3. **Regular Nodes**: Open any regular node (HTTP, Slack) and verify:
   - Execute button still visible and functional
   - Test tab works normally
   - Execute option in context menu works

4. **Inputs Column**: Open any node and check the inputs column:
   - Service/tool nodes should not show execute button
   - Regular nodes should show execute button on hover

### 7. Updated Node Type Classification (`frontend/src/utils/nodeTypeClassification.ts`)

- Updated `shouldShowExecuteButton` function to check for service/tool nodes
- Added logic to return `false` for service and tool node types
- This ensures the node toolbar (floating above nodes) also respects node execution capabilities
- Works in conjunction with the new `nodeTypeUtils` for consistent behavior

## Files Modified

1. `frontend/src/utils/nodeTypeUtils.ts` (new file)
2. `frontend/src/components/workflow/node-config/MiddleColumn.tsx`
3. `frontend/src/components/node/NodeTester.tsx`
4. `frontend/src/components/workflow/node-config/InputsColumn.tsx`
5. `frontend/src/components/workflow/components/NodeContextMenu.tsx`
6. `frontend/src/components/workflow/nodes/BaseNodeWrapper.tsx`
7. `frontend/src/utils/nodeTypeClassification.ts`

## Benefits

1. **Clearer UX**: Users understand which nodes can be executed independently
2. **Prevents Errors**: Eliminates confusion from attempting to execute non-executable nodes
3. **Consistent Behavior**: All UI components respect node execution capabilities
4. **Maintainable**: Centralized utility functions make it easy to add new node type checks
5. **Type-Safe**: Uses TypeScript types for better IDE support and compile-time checking
