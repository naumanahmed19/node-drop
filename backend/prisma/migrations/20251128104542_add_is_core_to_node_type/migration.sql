-- AlterTable
ALTER TABLE "node_types" ADD COLUMN "isCore" BOOLEAN NOT NULL DEFAULT false;

-- Update existing core nodes to set isCore = true
UPDATE "node_types" SET "isCore" = true WHERE "identifier" IN (
  'manual-trigger',
  'schedule-trigger',
  'webhook-trigger',
  'workflow-called',
  'workflow-trigger',
  'google-sheets-trigger',
  'code',
  'ifElse',
  'if',
  'switch',
  'loop',
  'merge',
  'split',
  'set',
  'json',
  'http-request',
  'openai',
  'anthropic',
  'data-preview',
  'image-preview'
);
