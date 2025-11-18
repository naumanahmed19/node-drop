-- Safe Migration: Rename 'type' to 'identifier' in node_types table
-- This migration preserves all existing data

BEGIN;

-- Step 1: Add the new 'identifier' column (nullable first)
ALTER TABLE "node_types" 
  ADD COLUMN IF NOT EXISTS "identifier" TEXT;

-- Step 2: Copy data from 'type' to 'identifier'
UPDATE "node_types" 
  SET "identifier" = "type"
  WHERE "identifier" IS NULL;

-- Step 3: Make 'identifier' NOT NULL and UNIQUE
ALTER TABLE "node_types" 
  ALTER COLUMN "identifier" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "node_types_identifier_key" 
  ON "node_types"("identifier");

-- Step 4: Drop the old 'type' column
ALTER TABLE "node_types" 
  DROP COLUMN IF EXISTS "type";

-- Step 5: Add the new 'nodeCategory' column (nullable)
ALTER TABLE "node_types" 
  ADD COLUMN IF NOT EXISTS "nodeCategory" TEXT;

COMMIT;

-- Verification queries (run these after migration):
-- SELECT identifier, "displayName", "nodeCategory" FROM node_types LIMIT 10;
-- SELECT COUNT(*) FROM node_types WHERE identifier IS NULL;
