# Refactoring: `type` → `nodeType`

## Overview
This document outlines the complete refactoring from using `type` as the node **type** identifier to using `nodeType`. 

**Important**: We use `nodeType` (not `nodeId`) because `nodeId` is already used for node **instance** IDs in workflows (e.g., "node-1763397483596").

This is a **breaking change** that requires careful execution.

## Status: IN PROGRESS ⚠️

### Completed ✅
1. **Backend Node Definitions** - All custom nodes updated
   - AI Agent nodes (OpenAI Model, Anthropic Model, etc.)
   - Tool nodes (Calculator, HTTP Request, Knowledge Base)
   - Memory nodes (Buffer, Redis, Window)
   - Other custom nodes (Validator, Transform, TextParser, Slack)

2. **Backend Type Definitions** - Core interfaces updated
   - `NodeDefinition` interface
   - `NodeSchema` interface
   - `NodeTypeInfo` interface
   - Added `nodeCategory` property for service/tool classification

3. **NodeService.ts** - Partially updated (IN PROGRESS)
   - Registry operations updated
   - Database operations updated
   - Method signatures partially updated
   - **Remaining**: ~90 more occurrences to update

### Critical Issue ⚠️
The refactoring is **partially complete** which means the system is currently **BROKEN**. 

**Current State:**
- Node definitions use `nodeId`
- Type definitions use `nodeId`
- Services still mostly use `type`
- Database schema still uses `type`
- Frontend still uses `type`

**This means:**
- ❌ Node registration will fail
- ❌ Node execution will fail
- ❌ Workflows cannot load
- ❌ System is non-functional

### Remaining Tasks 🔄

#### Phase 2: Backend Services (CRITICAL)
These files use `type` extensively and must be updated:

1. **NodeService.ts** (`backend/src/services/NodeService.ts`)
   - `nodeRegistry.set(nodeDefinition.type, ...)` → `nodeRegistry.set(nodeDefinition.nodeId, ...)`
   - `nodeRegistry.get(nodeType)` → `nodeRegistry.get(nodeId)`
   - All `type` references in methods
   - Update method parameters from `nodeType` to `nodeId`

2. **RealtimeExecutionEngine.ts** (`backend/src/services/RealtimeExecutionEngine.ts`)
   - `node.type` → `node.nodeId`
   - `nodeTypeInfo.type` → `nodeTypeInfo.nodeId`
   - Service node detection logic

3. **FlowExecutionEngine.ts** (`backend/src/services/FlowExecutionEngine.ts`)
   - Similar updates to RealtimeExecutionEngine

4. **NodeDiscovery.ts** (`backend/src/utils/NodeDiscovery.ts`)
   - Node registration logic
   - Type extraction from file names

#### Phase 3: Backend Routes
1. **node-types.ts** (`backend/src/routes/node-types.ts`)
   - API endpoints that return node types
   - Search and filter logic
   - Package management

#### Phase 4: Database Schema & Migration
1. **Prisma Schema** (`backend/prisma/schema.prisma`)
   ```prisma
   model NodeType {
     type String @id @unique  // Change to: nodeId String @id @unique
     // ... other fields
   }
   
   model WorkflowNode {
     type String  // Change to: nodeId String
     // ... other fields
   }
   ```

2. **Migration Script**
   ```sql
   -- Rename columns
   ALTER TABLE "NodeType" RENAME COLUMN "type" TO "nodeId";
   ALTER TABLE "WorkflowNode" RENAME COLUMN "type" TO "nodeId";
   
   -- Update indexes and constraints
   -- ... (depends on your schema)
   ```

#### Phase 5: Frontend Types
1. **workflow.ts** (`frontend/src/types/workflow.ts`)
   - `NodeType` interface: `type` → `nodeId`
   - `WorkflowNode` interface: `type` → `nodeId`

2. **Update all frontend components** (100+ files)
   - Search for: `node.type`, `nodeType`, `.type`
   - Replace with: `node.nodeId`, `nodeId`, `.nodeId`

#### Phase 6: Built-in Nodes
1. **Update built-in node definitions** (`backend/src/nodes/`)
   - HTTP Request node
   - JSON node
   - Set node
   - If node
   - Code node
   - Webhook nodes
   - Trigger nodes

2. **Update BuiltInNodeTypes enum** (already defined, just reference)
   ```typescript
   export enum BuiltInNodeTypes {
     HTTP_REQUEST = "http-request",  // These values stay the same
     JSON = "json",                   // They're the nodeId values
     // ...
   }
   ```

#### Phase 7: Tests
Update all test files that reference `type`:
- `backend/src/__tests__/**/*.test.ts`
- `frontend/src/__tests__/**/*.test.ts`

## Breaking Changes

### API Changes
All API endpoints that return or accept node types will change:

**Before:**
```json
{
  "type": "http-request",
  "displayName": "HTTP Request",
  ...
}
```

**After:**
```json
{
  "nodeId": "http-request",
  "nodeCategory": null,
  "displayName": "HTTP Request",
  ...
}
```

### Workflow JSON Changes
All saved workflows will need migration:

**Before:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "http-request",
      ...
    }
  ]
}
```

**After:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "nodeId": "http-request",
      ...
    }
  ]
}
```

## Migration Strategy

### Option 1: Big Bang (Risky)
1. Complete all changes at once
2. Run database migration
3. Deploy everything together
4. **Risk**: If anything fails, entire system is down

### Option 2: Gradual Migration (Recommended)
1. **Phase 1**: Add `nodeId` as alias to `type` (both work)
2. **Phase 2**: Update all code to use `nodeId` internally
3. **Phase 3**: Add database migration that copies `type` to `nodeId`
4. **Phase 4**: Update API to return both `type` and `nodeId`
5. **Phase 5**: Deprecate `type` field
6. **Phase 6**: Remove `type` field after grace period

### Option 3: Dual Support (Safest)
1. Support both `type` and `nodeId` indefinitely
2. Internally use `nodeId`
3. API accepts and returns both
4. Gradual migration of workflows

## Rollback Plan

If the migration fails:
1. Revert database migration
2. Revert code changes
3. Restore from backup
4. **Estimated downtime**: 15-30 minutes

## Testing Checklist

Before deploying:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing of:
  - [ ] Creating new workflows
  - [ ] Loading existing workflows
  - [ ] Executing workflows
  - [ ] Node discovery and registration
  - [ ] Custom node installation
  - [ ] API endpoints
  - [ ] Frontend node palette
  - [ ] Node configuration dialogs

## Files Changed So Far

### Backend
- ✅ `backend/custom-nodes/ai-agent-nodes/nodes/*.node.js` (8 files)
- ✅ `backend/custom-nodes/validator/nodes/Validator.node.js`
- ✅ `backend/custom-nodes/transform/nodes/Transform.node.js`
- ✅ `backend/custom-nodes/textParser/nodes/textParser.node.js`
- ✅ `backend/custom-nodes/slack/nodes/slack.node.js`
- ✅ `backend/src/types/node.types.ts`

### Frontend
- ⏳ Pending

### Database
- ⏳ Pending

## Estimated Effort

- **Backend Services**: 8-12 hours
- **Frontend Components**: 12-16 hours
- **Database Migration**: 2-4 hours
- **Testing**: 8-12 hours
- **Total**: 30-44 hours

## Recommendation

Given the scope and risk, I recommend **Option 2: Gradual Migration** with the following immediate next steps:

1. **Stop current refactoring** - We've updated node definitions but not the services
2. **Add backward compatibility** - Make services accept both `type` and `nodeId`
3. **Create migration script** - Automated tool to update all references
4. **Test thoroughly** - Before touching production

Would you like me to:
1. Continue with the full refactoring (risky)
2. Implement backward compatibility first (safer)
3. Create automated migration scripts (recommended)
