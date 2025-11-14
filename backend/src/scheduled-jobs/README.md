# Scheduled Jobs System

## Overview

The scheduled jobs system allows workflows to execute automatically at specified times using cron expressions. It uses a **database-backed approach** where the `scheduled_jobs` table serves as the single source of truth, ensuring job state persists across server restarts.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (Workflow Editor / API)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Endpoints                              │
│         /api/schedule-jobs (CRUD operations)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ScheduleJobManager                            │
│              (Orchestrates DB and Redis)                        │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│   PostgreSQL Database    │    │      Redis (Bull Queue)        │
│   ┌──────────────────┐   │    │   ┌────────────────────────┐  │
│   │ scheduled_jobs   │   │    │   │  schedule-jobs queue   │  │
│   │ (Source of Truth)│   │    │   │  (Execution Engine)    │  │
│   └──────────────────┘   │    │   └────────────────────────┘  │
└──────────────────────────┘    └────────────────────────────────┘
```

### Key Principles

1. **Database First**: All operations update the database before Redis
2. **Redis Rebuilt**: Redis is cleared and rebuilt from database on server restart
3. **Active Flag**: Controls whether a job is in Redis and executing
4. **Cascade Delete**: Jobs are deleted when the workflow is deleted

---

## Database Schema

```prisma
model ScheduledJob {
  id             String    @id @default(cuid())
  workflowId     String
  triggerId      String    // References trigger.id in workflow.triggers JSON
  jobKey         String    @unique // Format: workflowId-triggerId
  cronExpression String
  timezone       String    @default("UTC")
  description    String?
  active         Boolean   @default(true)
  lastRun        DateTime?
  nextRun        DateTime?
  failCount      Int       @default(0)
  lastError      Json?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  workflow       Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@unique([workflowId, triggerId])
  @@index([workflowId])
  @@index([active])
  @@map("scheduled_jobs")
}
```

### Key Fields

- **jobKey**: Unique identifier (format: `workflowId-triggerId`)
- **active**: Controls if job is running (true) or paused (false)
- **lastRun**: Timestamp of last execution
- **nextRun**: Timestamp of next scheduled execution
- **failCount**: Number of consecutive failures
- **lastError**: JSON object with last error details

---

## Data Flow

### 1. Server Startup

```
Server Start
    ↓
ScheduleJobManager.initialize()
    ↓
Clear all jobs from Redis (fresh start)
    ↓
Load active jobs from database
    ↓
For each active job:
    - Find trigger in workflow JSON
    - Create Bull job in Redis
    ↓
Jobs are now scheduled
```

### 2. Job Creation

```
User adds schedule trigger to workflow
    ↓
WorkflowService.update()
    ↓
ScheduleJobManager.syncWorkflowJobs()
    ↓
Create/update record in scheduled_jobs table
    ↓
Remove old Bull job from Redis (if exists)
    ↓
Create new Bull job in Redis
    ↓
Job starts executing on schedule
```

### 3. Job Execution

```
Cron time reached
    ↓
Bull Queue triggers job
    ↓
ScheduleJobManager processes job
    ↓
ExecutionService.executeWorkflow()
    ↓
Update database:
    - lastRun = current time
    - failCount = 0 (success) or +1 (failure)
    - lastError = error details (if failed)
    ↓
Execution complete
```

### 4. Job Deletion

```
User deletes job via API
    ↓
ScheduleJobManager.removeScheduleJob()
    ↓
Parse jobId (workflowId-triggerId)
    ↓
Delete record from scheduled_jobs table
    ↓
Remove Bull job from Redis
    ↓
Job is permanently deleted
```

### 5. Job Pause/Resume

**Pause:**
```
User pauses job
    ↓
Set active = false in database
    ↓
Remove Bull job from Redis
    ↓
Job stops executing
```

**Resume:**
```
User resumes job
    ↓
Set active = true in database
    ↓
Create Bull job in Redis
    ↓
Job starts executing
```

---

## File Structure

### Backend Files

```
backend/
├── prisma/
│   ├── schema.prisma                    # ScheduledJob model definition
│   └── migrations/
│       └── 20251106094707_add_scheduled_jobs_table/
│           └── migration.sql            # Database migration
│
├── src/
│   ├── services/
│   │   └── ScheduleJobManager.ts        # Main service (manages jobs)
│   │
│   ├── routes/
│   │   └── schedule-jobs.ts             # API endpoints
│   │
│   └── scripts/
│       └── migrate-scheduled-jobs.ts    # Migration script (Redis → DB)
│
└── test-delete-schedule-job.ts          # Test script for deletion
```

### Frontend Files

```
frontend/
└── src/
    └── components/
        └── execution/
            └── ScheduledExecutionsList.tsx  # UI for viewing/managing jobs
```

---

## API Endpoints

### GET /api/schedule-jobs
Get all scheduled jobs for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 2,
    "jobs": [
      {
        "id": "workflowId-triggerId",
        "workflowId": "workflow123",
        "workflowName": "My Workflow",
        "triggerId": "trigger-node-123",
        "cronExpression": "0 9 * * *",
        "timezone": "UTC",
        "description": "Daily at 9 AM",
        "nextRun": "2024-11-07T09:00:00Z",
        "lastRun": "2024-11-06T09:00:00Z",
        "status": "active",
        "failCount": 0
      }
    ]
  }
}
```

### GET /api/schedule-jobs/workflow/:workflowId
Get all scheduled jobs for a specific workflow.

### POST /api/schedule-jobs/:jobId/pause
Pause a scheduled job (sets active=false, removes from Redis).

### POST /api/schedule-jobs/:jobId/resume
Resume a paused job (sets active=true, adds to Redis).

### DELETE /api/schedule-jobs/:jobId
Permanently delete a scheduled job from database and Redis.

---

## ScheduleJobManager Methods

### initialize()
Loads active jobs from database and creates Bull jobs in Redis.

```typescript
await scheduleJobManager.initialize();
```

### addScheduleJob(workflowId, workflowName, userId, trigger)
Creates a new scheduled job in database and Redis.

```typescript
await scheduleJobManager.addScheduleJob(
  'workflow123',
  'My Workflow',
  'user123',
  trigger
);
```

### removeScheduleJob(jobId)
Deletes a job from database and Redis.

```typescript
await scheduleJobManager.removeScheduleJob('workflow123-trigger-node-123');
```

### pauseScheduleJob(jobId)
Pauses a job (sets active=false, removes from Redis).

```typescript
await scheduleJobManager.pauseScheduleJob('workflow123-trigger-node-123');
```

### resumeScheduleJob(workflowId, triggerId)
Resumes a paused job (sets active=true, adds to Redis).

```typescript
await scheduleJobManager.resumeScheduleJob('workflow123', 'trigger-node-123');
```

### syncWorkflowJobs(workflowId)
Syncs jobs with workflow triggers (adds/updates/removes as needed).

```typescript
await scheduleJobManager.syncWorkflowJobs('workflow123');
```

### getAllScheduleJobs()
Returns all scheduled jobs from database.

```typescript
const jobs = await scheduleJobManager.getAllScheduleJobs();
```

### getWorkflowScheduleJobs(workflowId)
Returns all jobs for a specific workflow.

```typescript
const jobs = await scheduleJobManager.getWorkflowScheduleJobs('workflow123');
```

---

## Job ID Format

Jobs are identified by a unique `jobKey` in the format:
```
workflowId-triggerId
```

**Example:**
```
cmhn9g2h2000aaz5x1wwjxl99-trigger-node-1762423520648
```

**Important:** Trigger IDs can contain dashes, so parsing must use:
```typescript
const firstDashIndex = jobId.indexOf('-');
const workflowId = jobId.substring(0, firstDashIndex);
const triggerId = jobId.substring(firstDashIndex + 1);
```

**Not:**
```typescript
const [workflowId, triggerId] = jobId.split('-'); // ❌ Wrong!
```

---

## Job States

| State | Active | In Redis | Executes | Persists |
|-------|--------|----------|----------|----------|
| Active | true | Yes | Yes | Yes |
| Paused | false | No | No | Yes |
| Deleted | - | No | No | No |

---

## Workflow Integration

### Workflow Triggers

Workflows store triggers in JSON format:
```json
{
  "triggers": [
    {
      "id": "trigger-node-123",
      "type": "schedule",
      "nodeId": "node-123",
      "active": true,
      "settings": {
        "cronExpression": "0 9 * * *",
        "timezone": "UTC",
        "description": "Daily at 9 AM"
      }
    }
  ]
}
```

### Relationship

- **Workflow triggers**: Define what jobs *should* exist
- **Scheduled jobs table**: Tracks which jobs *actually* exist and their state

When you:
- **Add a trigger**: Job is created in database and Redis
- **Remove a trigger**: Job is deleted from database and Redis
- **Update a trigger**: Job is updated in database and Redis
- **Delete a workflow**: All jobs are cascade deleted

---

## Migration Script

The migration script (`migrate-scheduled-jobs.ts`) migrates existing jobs from Redis to the database.

**Run:**
```bash
cd backend
npx tsx src/scripts/migrate-scheduled-jobs.ts
```

**What it does:**
1. Reads all repeatable jobs from Bull/Redis
2. Creates corresponding records in `scheduled_jobs` table
3. Preserves job configuration (cron, timezone, description)
4. Skips jobs where workflow/trigger no longer exists
5. Reports migration statistics

---

## Testing

### Test Script

```bash
cd backend
npx tsx test-delete-schedule-job.ts
```

**What it tests:**
1. Lists all jobs in database
2. Attempts to delete the first job
3. Verifies job is actually deleted
4. Reports success/failure

---

## Common Operations

### Check Jobs in Database

```sql
-- View all jobs
SELECT * FROM scheduled_jobs;

-- View active jobs
SELECT * FROM scheduled_jobs WHERE active = true;

-- View jobs with workflows
SELECT sj.job_key, sj.cron_expression, w.name 
FROM scheduled_jobs sj 
JOIN workflows w ON sj.workflow_id = w.id;
```

### Check Jobs via API

```bash
# Get all jobs
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:4000/api/schedule-jobs

# Get workflow jobs
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:4000/api/schedule-jobs/workflow/WORKFLOW_ID
```

### Restart Server

When the server restarts:
1. Redis is cleared
2. Active jobs are loaded from database
3. Bull jobs are created for each database record
4. Only jobs in database are loaded

---

## Key Concepts

### Source of Truth

- **Database** = Source of truth (persists across restarts)
- **Redis** = Execution queue (rebuilt on restart)
- **Workflow triggers** = Job definition (not state)

### Persistence

All job operations persist to the database:
- Create → Database + Redis
- Update → Database + Redis
- Pause → Database (active=false) + Remove from Redis
- Resume → Database (active=true) + Add to Redis
- Delete → Remove from Database + Remove from Redis

### Execution Tracking

After each execution, the database is updated:
- `lastRun` = execution timestamp
- `failCount` = 0 (success) or incremented (failure)
- `lastError` = error details (if failed)

---

## Summary

The scheduled jobs system provides reliable, persistent workflow scheduling with:

- ✅ Database-backed persistence
- ✅ Automatic execution tracking
- ✅ Pause/resume functionality
- ✅ Error monitoring
- ✅ Cascade deletion
- ✅ Server restart resilience

All job state is stored in the database, ensuring that deleted jobs stay deleted, paused jobs stay paused, and all operations persist across server restarts.
