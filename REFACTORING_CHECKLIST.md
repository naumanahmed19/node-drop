# Refactoring Checklist: type → nodeId

## Files to Update (In Order)

### ✅ COMPLETED
1. All node definition files (.node.js)
2. backend/src/types/node.types.ts
3. backend/src/services/NodeService.ts (partially - you're working on this)

### 🔄 IN PROGRESS
**File: backend/src/services/NodeService.ts**

Remaining changes:
- [ ] Line ~94, 127, 145: `nodeType` → `nodeId` in metadata
- [ ] Line ~247: `async unregisterNode(nodeType: string)` → `async unregisterNode(nodeId: string)`
- [ ] Line ~250: `where: { type: nodeType }` → `where: { nodeId: nodeId }`
- [ ] Line ~254-255: All `nodeType` → `nodeId`
- [ ] Line ~268: `async unloadNodeFromMemory(nodeType: string)` → `async unloadNodeFromMemory(nodeId: string)`
- [ ] Line ~270-273: All `nodeType` → `nodeId`
- [ ] Line ~289: `for (const [nodeType, nodeDefinition]` → `for (const [nodeId, nodeDefinition]`
- [ ] Line ~292: `type: nodeDefinition.nodeId` (already correct if you updated it)
- [ ] Line ~322: `const nodeTypes = await this.prisma.nodeType.findMany` (table name stays same)
- [ ] Line ~378: `async getNodeDefinition(nodeType: string)` → `async getNodeDefinition(nodeId: string)`
- [ ] Line ~384: `this.nodeRegistry.get(nodeType)` → `this.nodeRegistry.get(nodeId)`
- [ ] Line ~392: All `nodeType` → `nodeId`
- [ ] Line ~400: `async getNodeSchema(nodeType: string)` → `async getNodeSchema(nodeId: string)`
- [ ] Line ~406: `this.nodeRegistry.get(nodeType)` → `this.nodeRegistry.get(nodeId)`
- [ ] Line ~429-432: All `nodeType` → `nodeId`
- [ ] Line ~432: `where: { type: nodeType }` → `where: { nodeId: nodeId }`
- [ ] Line ~454-456: All `nodeType` → `nodeId`
- [ ] Line ~466: `async executeNode(nodeType: string,` → `async executeNode(nodeId: string,`
- [ ] Line ~487: `this.nodeRegistry.get(nodeType)` → `this.nodeRegistry.get(nodeId)`
- [ ] Line ~489: All `nodeType` → `nodeId`

Continue through the entire file replacing:
- Parameter names: `nodeType` → `nodeId`
- Variable names: `nodeType` → `nodeId`
- Object properties: `.type` → `.nodeId` (when referring to node identifier)
- Log messages: Update strings to say "nodeId" instead of "nodeType"

---

### 📋 NEXT FILE
**File: backend/src/services/RealtimeExecutionEngine.ts**

Key changes needed:

1. **Line ~18 - WorkflowNode interface:**
```typescript
interface WorkflowNode {
    id: string;
    name: string;
    nodeId: string;  // ← Change from: type: string;
    parameters: any;
    settings?: any;
    position?: { x: number; y: number };
    disabled?: boolean;
    credentials?: string[];
}
```

2. **Line ~76 - buildCredentialsMapping method:**
```typescript
logger.info(`[RealtimeExecution] Building credentials mapping for node ${node.id}`, {
    nodeId: node.nodeId,  // ← Change from: nodeType: node.type,
    nodeParameters: Object.keys(node.parameters || {}),
    // ...
});
```

3. **Line ~82 - Finding node type info:**
```typescript
const nodeTypeInfo = allNodeTypes.find((nt) => nt.nodeId === node.nodeId);
// ← Change from: nt.type === node.type
```

4. **Search and replace throughout the file:**
- `node.type` → `node.nodeId`
- `nodeType:` → `nodeId:` (in log messages and objects)
- Function parameters named `nodeType` → `nodeId`
- Variables named `nodeType` → `nodeId`

**Important:** Keep `nodeTypeInfo` variable name (it's fine) but change how you access it:
- `nodeTypeInfo.type` → `nodeTypeInfo.nodeId`

---

### 📋 AFTER THAT
**File: backend/src/services/FlowExecutionEngine.ts**

Similar changes to RealtimeExecutionEngine:
1. Update WorkflowNode interface
2. Update all `node.type` → `node.nodeId`
3. Update all `nodeType` parameters and variables → `nodeId`
4. Update database queries

---

### 📋 THEN
**File: backend/src/routes/node-types.ts**

Changes:
1. Update API response to use `nodeId` instead of `type`
2. Update search/filter logic
3. Update database queries

---

### 📋 DATABASE MIGRATION
**File: backend/prisma/schema.prisma**

```prisma
model NodeType {
  nodeId      String   @id @unique  // ← Change from: type String @id @unique
  displayName String
  name        String
  // ... rest stays same
}

model WorkflowNode {
  id          String   @id @default(uuid())
  nodeId      String   // ← Change from: type String
  // ... rest stays same
}
```

After schema change, run:
```bash
npx prisma migrate dev --name rename_type_to_nodeid
```

---

### 📋 FRONTEND FILES
**File: frontend/src/types/workflow.ts**

Already updated! ✅ (you did this earlier with `nodeCategory`)

Just verify:
```typescript
export interface NodeType {
  nodeId: string;  // ← Should be this, not 'type'
  nodeCategory?: 'service' | 'tool';
  displayName: string;
  // ...
}
```

---

### 📋 FRONTEND COMPONENTS (Many files)

Search for these patterns and replace:
- `node.type` → `node.nodeId`
- `nodeType.identifier` → `nodeType.nodeId`
- `type:` → `nodeId:` (in object literals)
- Function parameters: `nodeType: string` → `nodeId: string`

Key files:
1. `frontend/src/stores/nodeTypes.ts`
2. `frontend/src/services/nodeType.ts`
3. `frontend/src/components/workflow/**/*.tsx`
4. `frontend/src/utils/nodeTypeClassification.ts`

---

## Testing Checklist

After each file update, test:
- [ ] Node registration works
- [ ] Node discovery works
- [ ] Workflow execution works
- [ ] Frontend loads node types
- [ ] Can create new workflows
- [ ] Can load existing workflows (after migration)

---

## Quick Reference

**What to change:**
- `type: string` → `nodeId: string` (in interfaces)
- `node.type` → `node.nodeId` (property access)
- `nodeType` → `nodeId` (variable/parameter names)
- `where: { type: x }` → `where: { nodeId: x }` (database queries)
- `nodeRegistry.get(type)` → `nodeRegistry.get(nodeId)`

**What NOT to change:**
- `type: "string"` (property type definitions)
- `type: "number"` (property type definitions)
- TypeScript type annotations (`: string`, `: number`, etc.)
- `nodeTypeInfo` variable name (it's fine to keep)
- Table name `nodeType` in Prisma (can stay, just column names change)

---

## Current Progress

- ✅ Node definitions updated
- ✅ Type interfaces updated
- 🔄 NodeService.ts (you're working on this)
- ⏳ RealtimeExecutionEngine.ts (next)
- ⏳ FlowExecutionEngine.ts
- ⏳ Routes
- ⏳ Database schema
- ⏳ Frontend

**Estimated remaining time:** 15-20 hours
