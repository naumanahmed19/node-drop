# Next Steps to Complete the Refactoring

## ✅ Completed
1. Updated all node definitions (.node.js and .node.ts files) to use `identifier` instead of `type`
2. Updated backend type definitions (NodeDefinition, NodeSchema, NodeTypeInfo)
3. Updated backend services (NodeService, RealtimeExecutionEngine, FlowExecutionEngine)
4. Updated CLI scripts and utilities
5. Updated Prisma schema
6. Updated frontend types (workflow.ts)

## 🔄 Next Steps

### 1. Run Database Migration
```bash
cd backend
npx prisma migrate dev --name rename_type_to_identifier
```

This will:
- Rename the `type` column to `identifier` in the `node_types` table
- Add the `nodeCategory` column
- Update indexes and constraints

### 2. Update Frontend Components
Run this PowerShell command to update all frontend files:

```powershell
# Update all TypeScript/TSX files in frontend
Get-ChildItem "frontend/src" -Recurse -Include "*.ts","*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    
    # Replace nodeType.identifier with nodeType.identifier
    $content = $content -replace 'nodeType\.type\b', 'nodeType.identifier'
    
    # Replace node.type with node.identifier (but NOT nodeId)
    $content = $content -replace '(?<!node)\.type\b(?!\s*[=:])', '.identifier'
    
    # Replace type: in object literals (be careful)
    $content = $content -replace 'type:\s*nodeType', 'identifier: nodeType'
    
    if ($content -ne $original) {
        Set-Content $_.FullName -Value $content -NoNewline
        Write-Host "Updated: $($_.Name)"
    }
}
```

**Important**: Review the changes carefully! Some `.type` references might be TypeScript type annotations that shouldn't be changed.

### 3. Update Frontend Utilities
Specifically update these files:
- `frontend/src/utils/nodeTypeClassification.ts`
- `frontend/src/utils/nodeTypeUtils.ts`
- `frontend/src/stores/nodeTypes.ts`
- `frontend/src/services/nodeType.ts`

Replace references like:
- `nodeType.identifier` → `nodeType.identifier`
- `nt.type` → `nt.identifier`
- `type:` → `identifier:` (in object literals)

### 4. Test the System

After all updates, test:

```bash
# Backend
cd backend
npm run build
npm run dev

# Frontend
cd frontend
npm run build
npm run dev
```

Test these scenarios:
- [ ] Node registration works
- [ ] Node discovery works
- [ ] Workflow creation works
- [ ] Workflow execution works
- [ ] Service nodes (OpenAI, Anthropic) work with AI Agent
- [ ] Tool nodes (Calculator, HTTP Request) work with AI Agent
- [ ] Frontend loads node types correctly
- [ ] Node palette displays correctly
- [ ] Node configuration dialog works

### 5. Update Documentation

Update any documentation that references the `type` property to use `identifier` instead.

## Summary of Changes

### Property Names
- **Old**: `type` (ambiguous - could mean node type or TypeScript type)
- **New**: `identifier` (clear - uniquely identifies the node type)

### What Changed
- Node definitions: `type: 'http-request'` → `identifier: 'http-request'`
- Database column: `type` → `identifier`
- TypeScript interfaces: `type: string` → `identifier: string`
- All service/backend code updated
- Frontend types updated

### What Didn't Change
- `nodeId` - Still used for node instance IDs (e.g., "node-1763397483596")
- TypeScript type annotations (`: string`, `: number`, etc.)
- Property type definitions in node properties (`type: "string"`, `type: "number"`)

## Rollback Plan

If something goes wrong:

1. **Revert database migration**:
```bash
cd backend
npx prisma migrate resolve --rolled-back <migration_name>
```

2. **Revert code changes**:
```bash
git revert <commit_hash>
```

3. **Restore from backup** (if you made one)

## Estimated Time
- Database migration: 5 minutes
- Frontend updates: 30-60 minutes
- Testing: 30-60 minutes
- **Total**: 1-2 hours

## Questions?
If you encounter any issues, check:
1. Compilation errors - look for references to `.type` that should be `.identifier`
2. Runtime errors - check database queries
3. Frontend errors - check API responses and type mismatches
