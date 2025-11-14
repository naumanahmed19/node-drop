# Data Preview Node - Troubleshooting Guide

## Issue: Expand Button Not Showing

### ✅ Solution Applied
The issue was in `frontend/src/components/workflow/workflowTransformers.ts`. The `data-preview` node type wasn't being mapped to use the custom `DataPreviewNode` component.

**Fixed in:** `workflowTransformers.ts` line ~170

```typescript
const reactFlowNodeType =
  node.type === "chat"
    ? "chat"
    : node.type === "image-preview"
    ? "image-preview"
    : node.type === "data-preview"  // ← Added this
    ? "data-preview"
    : node.type === "form-generator"
    ? "form-generator"
    : node.type === "annotation"
    ? "annotation"
    : "custom";
```

### How to Verify the Fix

1. **Refresh the frontend** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. **Add a Data Preview node** to the canvas
3. **Look for the expand button** at the bottom center of the node:
   ```
   ┌─────────────────────────┐
   │ 🖥️ Data Preview         │
   │ Waiting for data        │
   └─────────────────────────┘
              ↓ ← This button
   ```

## Common Issues

### 1. Node Shows as Regular CustomNode (No Expand Button)

**Symptoms:**
- Node looks like a regular node
- No expand button at the bottom
- Can't collapse/expand

**Cause:**
- The node type mapping is missing in `workflowTransformers.ts`

**Solution:**
- Verify the fix above is applied
- Hard refresh the browser
- Clear browser cache if needed

### 2. Backend Node Not Loading

**Symptoms:**
- Node doesn't appear in node palette
- Can't find "Data Preview" when searching

**Cause:**
- Backend server not restarted
- Node not registered in backend

**Solution:**
```bash
# Restart backend server
cd backend
npm run dev
```

**Verify registration:**
- Check `backend/src/nodes/index.ts` has:
  ```typescript
  export * from "./DataPreview";
  ```

### 3. Expand Button Shows But Doesn't Work

**Symptoms:**
- Expand button is visible
- Clicking it does nothing
- No console errors

**Cause:**
- `onToggleExpand` handler not working
- State not updating

**Solution:**
- Check browser console for errors
- Verify `DataPreviewNode.tsx` has:
  ```typescript
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    updateNode(id, {
      parameters: {
        ...data.parameters,
        isExpanded: newExpanded
      }
    })
  }, [isExpanded, id, data.parameters, updateNode])
  ```

### 4. Node Expands But Shows No Content

**Symptoms:**
- Node expands successfully
- Shows "No data to preview"
- Even after workflow execution

**Cause:**
- Node not receiving execution data
- Data extraction logic issue

**Solution:**
- Execute the workflow first
- Check if the node has input connections
- Verify `getDataFromExecution()` function:
  ```typescript
  const getDataFromExecution = useCallback(() => {
    if (!workflow || !lastExecutionResult) {
      return null
    }
    
    const nodeExecution = lastExecutionResult.nodeResults?.find(
      nr => nr.nodeId === id
    )
    
    if (!nodeExecution || !nodeExecution.data) return null
    
    let execData = nodeExecution.data
    
    if (execData.main && Array.isArray(execData.main) && execData.main.length > 0) {
      const mainOutput = execData.main[0]
      if (mainOutput.json) {
        execData = mainOutput.json
      }
    }
    
    return execData
  }, [workflow, lastExecutionResult, id])
  ```

### 5. TypeScript Errors

**Symptoms:**
- Red squiggly lines in IDE
- Build fails

**Cause:**
- Missing imports
- Type mismatches

**Solution:**
- Run diagnostics:
  ```bash
  npm run type-check
  ```
- Check all imports are correct
- Verify all files are saved

## Verification Checklist

After applying the fix, verify:

- [ ] Backend server restarted
- [ ] Frontend refreshed (hard refresh)
- [ ] Node appears in palette under "Transform" category
- [ ] Node can be added to canvas
- [ ] Node shows expand button (↓) at bottom center
- [ ] Clicking expand button works
- [ ] Node expands to show larger preview area
- [ ] Clicking again collapses the node
- [ ] Expansion state persists when clicking elsewhere
- [ ] After workflow execution, data appears in preview
- [ ] Copy button works in expanded view
- [ ] Scrolling works for long data

## Debug Mode

To enable debug logging:

1. Open browser console (F12)
2. Add this to console:
   ```javascript
   localStorage.setItem('debug', 'workflow:*')
   ```
3. Refresh page
4. Check console for workflow-related logs

## Still Having Issues?

### Check Browser Console
Look for errors related to:
- `DataPreviewNode`
- `workflowTransformers`
- `BaseNodeWrapper`
- ReactFlow errors

### Check Network Tab
Verify:
- Node types are being fetched: `/api/node-types`
- Node definition includes `data-preview` type

### Check React DevTools
1. Install React DevTools extension
2. Find the DataPreviewNode component
3. Check its props:
   - `isExpanded` should be boolean
   - `onToggleExpand` should be function
   - `expandedContent` should exist

### File Checklist

Ensure all these files exist and are correct:

**Backend:**
- [ ] `backend/src/nodes/DataPreview/DataPreview.node.ts`
- [ ] `backend/src/nodes/DataPreview/index.ts`
- [ ] `backend/src/nodes/index.ts` (exports DataPreview)

**Frontend:**
- [ ] `frontend/src/components/workflow/nodes/DataPreviewNode.tsx`
- [ ] `frontend/src/components/workflow/nodes/index.ts` (exports DataPreviewNode)
- [ ] `frontend/src/components/workflow/WorkflowEditor.tsx` (maps 'data-preview')
- [ ] `frontend/src/components/workflow/workflowTransformers.ts` (maps 'data-preview') ⭐
- [ ] `frontend/src/components/workflow/node-config/output-components/DataPreviewOutput.tsx`
- [ ] `frontend/src/components/workflow/node-config/custom-fields/DataPreview.tsx`

## Success Indicators

When everything is working correctly:

1. **In Node Palette:**
   - See "Data Preview" with 🖥️ icon
   - Under "Transform" category
   - Green color theme

2. **On Canvas (Collapsed):**
   - 200px wide node
   - Green icon and handles
   - Expand button (↓) at bottom
   - Shows "Waiting for data" or first 3 lines

3. **On Canvas (Expanded):**
   - 360px wide node
   - Full terminal-style preview
   - Scrollable content area
   - Copy button in header
   - Metadata at bottom
   - Collapse button (↑) at bottom

4. **After Execution:**
   - Data appears in preview
   - Format matches configuration
   - Line count is accurate
   - Timestamp shows (if enabled)

## Contact

If issues persist after following this guide:
1. Check all files are saved
2. Restart both backend and frontend
3. Clear browser cache completely
4. Try in incognito/private window
5. Check for conflicting browser extensions
