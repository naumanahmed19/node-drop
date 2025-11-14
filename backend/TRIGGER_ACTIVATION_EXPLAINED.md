# Schedule Trigger Activation - How It Works

## ✅ The Good News

**You DON'T need to restart the backend!** 

When you save and activate a workflow with a schedule trigger, it starts working **immediately**.

## 🔄 How It Works

### When You Save/Activate a Workflow

```
User clicks "Save" in UI
         ↓
Frontend calls: PATCH /api/workflows/{id}
         ↓
WorkflowService.updateWorkflow() runs
         ↓
Workflow saved to database
         ↓
WorkflowService checks: "Did triggers or active status change?"
         ↓
YES → Calls: triggerService.syncWorkflowTriggers(workflowId)
         ↓
TriggerService.syncWorkflowTriggers() does:
  1. Deactivates old triggers for this workflow
  2. If workflow.active && trigger.active:
     - Validates cron expression
     - Creates cron.schedule() task
     - Starts the task
  3. Returns success
         ↓
✅ Trigger is now active and running!
```

### Code Flow

**1. WorkflowService.updateWorkflow()** (backend/src/services/WorkflowService.ts)
```typescript
// After saving workflow to database:
if (isTriggerServiceInitialized() && 
    (normalizedTriggers || data.active !== undefined)) {
  try {
    await getTriggerService().syncWorkflowTriggers(id);
  } catch (error) {
    console.error(`Error syncing triggers for workflow ${id}:`, error);
  }
}
```

**2. TriggerService.syncWorkflowTriggers()** (backend/src/services/TriggerService.ts)
```typescript
async syncWorkflowTriggers(workflowId: string): Promise<void> {
  // Get workflow with triggers
  const workflow = await this.prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, active: true, triggers: true }
  });

  // Deactivate existing triggers
  for (const trigger of existingTriggers) {
    await this.deactivateTrigger(trigger.id);
  }

  // Activate new triggers if workflow is active
  if (workflow.active && triggers && triggers.length > 0) {
    for (const trigger of triggers) {
      if (trigger.active) {
        await this.activateTrigger(workflowId, trigger);
      }
    }
  }
}
```

**3. TriggerService.activateScheduleTrigger()** (backend/src/services/TriggerService.ts)
```typescript
private async activateScheduleTrigger(trigger: TriggerDefinition): Promise<void> {
  const { cronExpression, timezone } = trigger.settings;

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    throw new AppError("Invalid cron expression", 400, "INVALID_CRON_EXPRESSION");
  }

  // Create scheduled task
  const task = cron.schedule(
    cronExpression,
    async () => {
      await this.handleScheduleTrigger(trigger);
    },
    {
      scheduled: false,
      timezone: timezone || "UTC",
    }
  );

  // Store and start task
  this.scheduledTasks.set(trigger.id, task);
  task.start(); // ← Trigger starts immediately!
}
```

## 🎯 Why This Works

### Singleton Pattern

The TriggerService uses a **singleton pattern**:

```typescript
// backend/src/services/triggerServiceSingleton.ts
let triggerServiceInstance: TriggerService | null = null;

export function getTriggerService(): TriggerService {
  if (!triggerServiceInstance) {
    throw new Error("TriggerService not initialized");
  }
  return triggerServiceInstance;
}
```

This means:
- ✅ Only **one instance** of TriggerService exists
- ✅ It's initialized **once** on server startup
- ✅ All routes use the **same instance**
- ✅ Changes are **immediately reflected**

### Server Startup

```typescript
// backend/src/index.ts
httpServer.listen(PORT, async () => {
  // ... other initialization ...
  
  // Initialize TriggerService singleton
  await initializeTriggerService(
    prisma,
    workflowService,
    executionService,
    socketService,
    nodeService,
    executionHistoryService,
    credentialService
  );
  
  console.log(`✅ TriggerService initialized - active triggers loaded`);
});
```

This:
- ✅ Loads all **existing active triggers** from database
- ✅ Starts them automatically
- ✅ Makes TriggerService available globally

## 📊 Complete Flow Example

### Scenario: User Creates "Every Minute" Schedule

**Step 1: User creates workflow**
```
- Adds Schedule Trigger node
- Sets: scheduleMode = "simple", interval = "minute"
- Adds HTTP Request node
- Connects nodes
```

**Step 2: User activates and saves**
```
- Clicks "Active" toggle
- Clicks "Save"
```

**Step 3: Frontend sends request**
```http
PATCH /api/workflows/abc123
Content-Type: application/json

{
  "active": true,
  "nodes": [...],
  "connections": {...},
  "triggers": [{
    "id": "trigger-node1",
    "type": "schedule",
    "nodeId": "node1",
    "active": true,
    "settings": {
      "scheduleMode": "simple",
      "interval": "minute",
      "timezone": "UTC"
    }
  }]
}
```

**Step 4: Backend processes**
```
WorkflowService.updateWorkflow()
  → Saves workflow to database
  → Calls triggerService.syncWorkflowTriggers("abc123")
    → Deactivates old triggers
    → Activates new trigger:
      → Converts "minute" to cron: "* * * * *"
      → Validates cron expression ✓
      → Creates cron.schedule() task
      → Starts task
    → Returns success
  → Returns updated workflow
```

**Step 5: Trigger is active!**
```
- Cron task runs in background
- Every minute at :00 seconds:
  → handleScheduleTrigger() fires
  → Creates execution
  → Workflow runs
```

**Step 6: User sees results**
```
- Execution appears in history
- Real-time updates via WebSocket
- No restart needed!
```

## 🔍 Verification

### Check if TriggerService is initialized

**Server logs on startup:**
```
⏰ Initializing TriggerService...
✅ TriggerService initialized - active triggers loaded
```

### Check if trigger activated

**Server logs when you save:**
```
Syncing triggers for workflow abc123
Successfully synced 1 triggers for workflow abc123
```

### Check scheduled tasks

**In TriggerService:**
```typescript
console.log('Active scheduled tasks:', this.scheduledTasks.size);
// Should show number of active schedule triggers
```

## 🐛 Troubleshooting

### Issue: Trigger not activating when I save

**Possible causes:**

1. **TriggerService not initialized**
   - Check server logs for initialization message
   - Restart server if needed (one-time)

2. **Workflow not active**
   - Ensure `workflow.active === true`
   - Check the toggle in UI

3. **Trigger not active**
   - Ensure `trigger.active === true`
   - Check trigger node is not disabled

4. **Invalid cron expression**
   - Check server logs for validation errors
   - Test cron expression: `cron.validate(expression)`

5. **Error in syncWorkflowTriggers**
   - Check server logs for errors
   - Look for "Error syncing triggers"

### Issue: Need to restart server

**When restart IS needed:**
- ✅ First time setting up (to initialize TriggerService)
- ✅ After code changes to trigger logic
- ✅ After environment variable changes

**When restart is NOT needed:**
- ❌ Creating new workflow with trigger
- ❌ Activating existing workflow
- ❌ Updating trigger settings
- ❌ Changing schedule configuration

## ✅ Summary

**The system is designed to work WITHOUT restarts:**

1. **Server starts** → TriggerService initializes once
2. **User saves workflow** → syncWorkflowTriggers() called automatically
3. **Trigger activates** → Starts immediately
4. **Trigger fires** → Runs at scheduled time
5. **User updates** → syncWorkflowTriggers() called again
6. **Changes apply** → Immediately, no restart

**Key Points:**

- ✅ Singleton pattern ensures one TriggerService instance
- ✅ syncWorkflowTriggers() called automatically on save
- ✅ Triggers activate immediately when workflow saved
- ✅ No manual intervention required
- ✅ No restart needed (except first-time setup)

**Your workflow with "Every Minute" schedule should:**
1. Activate immediately when you save
2. Fire at the next minute boundary (e.g., 10:01:00)
3. Continue firing every minute
4. Show executions in history

If it's not working, check the troubleshooting section above!
