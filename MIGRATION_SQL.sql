-- Migration: Rename 'type' to 'identifier' in node_types table
-- This migration renames the column and adds the new nodeCategory column

BEGIN;

-- Step 1: Rename the 'type' column to 'identifier'
ALTER TABLE "node_types" 
  RENAME COLUMN "type" TO "identifier";

-- Step 2: Add the new 'nodeCategory' column (nullable)
ALTER TABLE "node_types" 
  ADD COLUMN "nodeCategory" TEXT;

-- Step 3: Update any indexes or constraints that reference the old column name
-- (Prisma will handle this automatically when you run the migration)

COMMIT;

-- After running this migration, you should:
-- 1. Update all existing workflows in the database to use 'identifier' instead of 'type'
-- 2. Test that node registration works
-- 3. Test that workflow execution works
