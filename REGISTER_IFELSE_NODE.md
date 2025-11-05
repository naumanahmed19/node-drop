# How to Register the IfElse Node

Since you deleted the IfElse node from the database, you need to re-register it.

## Option 1: Register All Nodes (Recommended)

Run this command from the backend directory:

```bash
cd backend
npm run nodes:register
```

This will discover and register all nodes, including the new IfElse node.

## Option 2: Use the Node CLI

```bash
cd backend
npm run nodes:discover
```

## Option 3: Restart the Backend

If your backend has auto-registration on startup, simply restart it:

```bash
cd backend
npm run dev
```

## Verify Registration

After running the registration, verify the node is registered:

```bash
cd backend
npm run nodes:list
```

You should see the IfElse node in the list with all three modes (Simple, Combine, Grouped).

## If It Still Doesn't Work

1. **Check the database directly** - Make sure the node was actually deleted
2. **Check for errors** - Look at the console output when running the registration
3. **Clear the node cache** - The NodeService has an in-memory registry that might need clearing

## Database Check (if needed)

If you want to manually check/delete the node from the database:

```sql
-- Check if node exists
SELECT * FROM "NodeType" WHERE type = 'ifElse';

-- Delete if exists (to force re-registration)
DELETE FROM "NodeType" WHERE type = 'ifElse';
```

Then run the registration command again.
