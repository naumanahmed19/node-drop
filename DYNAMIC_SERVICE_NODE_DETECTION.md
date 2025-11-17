# Dynamic Service Node Detection

## Problem
Service nodes (model, memory, and tool nodes) were hardcoded in multiple places throughout the codebase. This made the system brittle and required code changes whenever new service nodes were added.

**Previous hardcoded lists:**
```typescript
// Backend - RealtimeExecutionEngine.ts
const serviceNodeTypes = [
    'openai-model', 'anthropic-model',  // Model nodes
    'buffer-memory', 'window-memory', 'redis-memory',  // Memory nodes
    'calculator-tool', 'http-request-tool', 'knowledge-base-tool'  // Tool nodes
];

// Backend - AIAgent.node.js
const validModelTypes = ['openai-model', 'anthropic-model'];
const validMemoryTypes = ['buffer-memory', 'window-memory', 'redis-memory'];
const validToolTypes = ['calculator-tool', 'http-request-tool', 'knowledge-base-tool'];

// Frontend - workflowErrorHandling.ts
const validServiceTypes = {
    model: ['openai-model', 'anthropic-model'],
    memory: ['buffer-memory', 'window-memory', 'redis-memory'],
    tools: ['calculator-tool', 'http-request-tool', 'knowledge-base-tool'],
};
```

## Solution

### 1. Backend - RealtimeExecutionEngine.ts
**Dynamic service node detection based on node structure:**

Service nodes are now identified by checking if they have **no inputs** (`inputs: []`). This is a structural characteristic that all service nodes share.

```typescript
/**
 * Check if a node is a service node (has no inputs)
 * Service nodes include model, memory, and tool nodes
 */
private async isServiceNode(nodeType: string): Promise<boolean> {
    try {
        const allNodeTypes = await this.nodeService.getNodeTypes();
        const nodeTypeInfo = allNodeTypes.find((nt) => nt.type === nodeType);
        
        if (!nodeTypeInfo) {
            return false;
        }
        
        // Service nodes have no inputs (inputs: [])
        return Array.isArray(nodeTypeInfo.inputs) && nodeTypeInfo.inputs.length === 0;
    } catch (error) {
        logger.error(`[RealtimeExecution] Failed to check if node is service node`, { nodeType, error });
        return false;
    }
}
```

**Dynamic credential validation:**

Instead of hardcoding which nodes require credentials, we now check the node definition for credential-type properties:

```typescript
// Check if node has credential-type properties that are required
if (nodeDefinition && nodeDefinition.properties) {
    const properties = Array.isArray(nodeDefinition.properties) 
        ? nodeDefinition.properties 
        : [];
    
    for (const property of properties) {
        if (property.type === 'credential' && property.required) {
            // Validate credentials are present
        }
    }
}
```

### 2. Backend - AIAgent.node.js
**Interface-based validation instead of type checking:**

Service nodes are now validated by checking if they implement the required methods (duck typing):

```javascript
// Model nodes must implement the chat() method
if (!modelNode.chat || typeof modelNode.chat !== 'function') {
    throw new Error(`Invalid Model node: ${modelNode.type} does not implement the required 'chat' method`);
}

// Memory nodes must implement the getMessages() method
if (!memoryNode.getMessages || typeof memoryNode.getMessages !== 'function') {
    logger.warn('Invalid Memory node - missing required methods');
    return null;
}

// Tool nodes must implement getDefinition() and executeTool() methods
if (toolNode && toolNode.getDefinition && typeof toolNode.getDefinition === 'function' &&
    toolNode.executeTool && typeof toolNode.executeTool === 'function') {
    toolNodes.push(toolNode);
}
```

### 3. Frontend - workflowErrorHandling.ts
**Removed hardcoded type validation:**

The frontend now only checks that required service inputs are connected, without validating specific node types. The backend will handle proper validation during execution.

```typescript
// Check each node that requires service inputs
nodes.forEach((node) => {
    const requiredInputs = requiredServiceInputs[node.type];
    if (!requiredInputs) return;
    
    requiredInputs.forEach((inputName) => {
        // Find connections to this service input
        const serviceConnections = connections.filter(
            (conn) => conn.targetNodeId === node.id && conn.targetInput === inputName
        );
        
        if (serviceConnections.length === 0) {
            errors.push({
                field: `node.${node.id}.${inputName}`,
                message: `Required service input '${inputName}' is not connected.`,
                code: ErrorCodes.VALIDATION_ERROR,
            });
        }
        // Backend will validate service node types during execution
    });
});
```

## Benefits

1. **Extensibility**: New service nodes can be added without modifying validation code
2. **Maintainability**: Single source of truth (node definitions) instead of scattered hardcoded lists
3. **Type Safety**: Interface-based validation ensures nodes implement required methods
4. **Flexibility**: System adapts automatically to new node types
5. **Reduced Coupling**: Frontend and backend validation are decoupled

## How to Add New Service Nodes

To add a new service node (model, memory, or tool):

1. **Create the node definition** with:
   - `inputs: []` (no inputs - this marks it as a service node)
   - Appropriate output type (`outputs: ['model']`, `outputs: ['memory']`, or `outputs: ['tool']`)
   - Required interface methods:
     - Model nodes: `chat()`, `supportsTools()`, etc.
     - Memory nodes: `getMessages()`, `addMessage()`, `clear()`
     - Tool nodes: `getDefinition()`, `executeTool()`

2. **No code changes needed** in:
   - RealtimeExecutionEngine.ts (automatically detects service nodes)
   - AIAgent.node.js (validates based on interface methods)
   - workflowErrorHandling.ts (only checks connections exist)

## Example: Adding a New Model Node

```javascript
const NewModelNode = {
  type: 'new-model',
  displayName: 'New Model',
  name: 'new-model',
  group: ['ai', 'model'],
  version: 1,
  description: 'A new model provider',
  inputs: [],  // ← Service node marker
  outputs: ['model'],  // ← Model output type
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',  // ← Credential property
      required: true,
      allowedTypes: ['apiKey'],
    },
    // ... other properties
  ],
  
  // Required interface methods
  async chat(messages, tools, toolChoice) {
    // Implementation
  },
  
  supportsTools() {
    return true;
  },
  
  // ... other interface methods
};
```

The system will automatically:
- Detect it as a service node (no inputs)
- Skip it during workflow execution
- Validate it has required credentials (credential-type property)
- Allow AI Agent to use it (implements chat() method)

## Migration Notes

No migration needed - the changes are backward compatible. All existing service nodes continue to work as before, but the system is now more flexible for future additions.
