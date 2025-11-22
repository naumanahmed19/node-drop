-- Migration: Unify credential_shares and team_credential_shares into single table
-- This migration preserves all existing data

-- Step 1: Add new columns to credential_shares table
ALTER TABLE "credential_shares" 
  ADD COLUMN "sharedWithTeamId" TEXT;

-- Step 2: Make sharedWithUserId nullable (it was required before)
ALTER TABLE "credential_shares" 
  ALTER COLUMN "sharedWithUserId" DROP NOT NULL;

-- Step 3: Migrate data from team_credential_shares to credential_shares
INSERT INTO "credential_shares" (
  "id",
  "credentialId",
  "ownerUserId",
  "sharedWithUserId",
  "sharedWithTeamId",
  "permission",
  "sharedAt",
  "sharedByUserId"
)
SELECT 
  tcs."id",
  tcs."credentialId",
  c."userId" as "ownerUserId",  -- Get owner from credential
  NULL as "sharedWithUserId",    -- NULL for team shares
  tcs."teamId" as "sharedWithTeamId",
  tcs."permission",
  tcs."sharedAt",
  tcs."sharedBy" as "sharedByUserId"
FROM "team_credential_shares" tcs
JOIN "credentials" c ON tcs."credentialId" = c."id";

-- Step 4: Create indexes for new column
CREATE INDEX "credential_shares_sharedWithTeamId_idx" ON "credential_shares"("sharedWithTeamId");

-- Step 5: Add unique constraint for team shares
CREATE UNIQUE INDEX "credential_shares_credentialId_sharedWithTeamId_key" 
  ON "credential_shares"("credentialId", "sharedWithTeamId") 
  WHERE "sharedWithTeamId" IS NOT NULL;

-- Step 6: Add foreign key for team relationship
ALTER TABLE "credential_shares" 
  ADD CONSTRAINT "credential_shares_sharedWithTeamId_fkey" 
  FOREIGN KEY ("sharedWithTeamId") 
  REFERENCES "teams"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Step 7: Drop old team_credential_shares table
DROP TABLE "team_credential_shares";

-- Step 8: Add check constraint to ensure exactly one target is set
-- Note: This is a safety check at database level
ALTER TABLE "credential_shares"
  ADD CONSTRAINT "credential_shares_check_one_target"
  CHECK (
    (("sharedWithUserId" IS NOT NULL)::integer + 
     ("sharedWithTeamId" IS NOT NULL)::integer) = 1
  );
