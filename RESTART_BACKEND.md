# IMPORTANT: Restart Backend Server

## Critical Fix Applied
A critical bug was found and fixed in how node outputs are stored in the execution context. The backend was losing branch information from the IfElse node.

## You Must Restart the Backend
The changes to `ExecutionEngine.ts` require a backend restart to take effect.

### How to Restart

1. **Stop the current backend process** (if running)
   - Press `Ctrl+C` in the terminal running the backend
   - Or kill the process

2. **Start the backend again**
   ```bash
   cd backend
   npm run dev
   ```
   Or whatever command you use to start your backend.

3. **Test your workflow again**
   - The IfElse node should now correctly route to only one branch
   - With condition `{{json.test}}` equal to `"xxxxx"` and actual value `"go"`:
     - Condition evaluates to FALSE
     - Only Anthropic node should execute
     - HTTP Request node should be skipped

## What Was Fixed

### The Critical Bug
```typescript
// BEFORE - Lost all branch data!
const outputData = result.data ? [{ main: result.data.main }] : [];
context.nodeOutputs.set(nodeId, outputData);
```

This was extracting only the `main` array and discarding the `branches` object that contained the separate "true" and "false" data.

### The Fix
```typescript
// AFTER - Preserves complete output including branches
if (result.data) {
  context.nodeOutputs.set(nodeId, result.data as any);
}
```

Now the full standardized output is stored, including:
- `main`: Combined output (for backward compatibility)
- `branches`: Separate branch data (true/false for IfElse)
- `metadata`: Node type and branch information

## Verification

After restarting, check the logs. You should see:
- `IfElse routing decision: FALSE` (from the IfElse node)
- `Skipping node [http-node-id]: No data from incoming branches` (from ExecutionEngine)
- Only the Anthropic node should execute

If both nodes still execute, check:
1. Did you restart the backend?
2. Are you running the latest code?
3. Check the logs for the debug messages added
