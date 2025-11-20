-- Update any triggers that have pollInterval but are marked as 'schedule'
UPDATE trigger_jobs 
SET type = 'polling' 
WHERE "pollInterval" IS NOT NULL 
  AND type = 'schedule';

-- Update any triggers that have cronExpression but are marked as 'polling'
UPDATE trigger_jobs 
SET type = 'schedule' 
WHERE "cronExpression" IS NOT NULL 
  AND type = 'polling';

-- Show results
SELECT 
  id,
  type,
  "cronExpression",
  "pollInterval",
  active
FROM trigger_jobs;
