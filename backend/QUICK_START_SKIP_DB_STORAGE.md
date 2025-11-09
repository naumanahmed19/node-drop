# Quick Start: Skip Database Storage

## Enable the Feature

### 1. Frontend (Workflow Settings)
1. Open your workflow
2. Click "Settings" button
3. Toggle "Save Execution History" to **OFF**
4. Click "Apply"
5. Save the workflow

### 2. Backend (Programmatic)
```typescript
// Update workflow settings
await prisma.workflow.update({
  where: { id: workflowId },
  data: {
    settings: {
      saveExecutionToDatabase: false
    }
  }
});
```

## Verify It's Working

### Check Logs
Look for this message when workflow executes:
```
⏭️  Skipping database save for execution {executionId} (saveToDatabase: false)
```

### Check Database
```sql
-- Should return 0 rows for workflows with saveExecutionToDatabase: false
SELECT * FROM "Execution" WHERE "workflowId" = 'your-workflow-id';
```

### Check Redis
```bash
# Should show cached results (60s TTL)
redis-cli KEYS "execution:result:*"
```

## Use Cases

### ✅ When to Use
- High-traffic webhook APIs (1000+ requests/day)
- Temporary/disposable workflows
- Testing and development
- Cost optimization (reduce database storage)
- Performance-critical workflows

### ❌ When NOT to Use
- Workflows requiring audit trails
- Debugging complex workflows
- Compliance/regulatory requirements
- Long-term execution history needed
- Workflows with errors you need to investigate

## Behavior by Trigger Type

### Webhook (responseMode: "onReceived")
```
Request → 200 OK immediately
        ↓
Execution runs in background
        ↓
No database record ✅
```

### Webhook (responseMode: "lastNode")
```
Request → Wait for execution
        ↓
Get result from Redis
        ↓
Return custom HTTP Response
        ↓
No database record ✅
```

### Schedule Trigger
```
Cron triggers execution
        ↓
Execution runs
        ↓
No database record ✅
```

### Manual Trigger
```
User clicks "Execute"
        ↓
Execution runs
        ↓
No database record ✅
```

## Troubleshooting

### Problem: Still seeing executions in database
**Solution**: 
1. Check workflow settings: `settings.saveExecutionToDatabase` should be `false`
2. Save the workflow after changing settings
3. Clear browser cache and reload

### Problem: Webhook timeout with responseMode: "lastNode"
**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Check execution logs for errors
3. Increase timeout if execution takes > 30s

### Problem: "Redis connection error"
**Solution**:
1. Start Redis: `redis-server`
2. Check environment variables:
   ```bash
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```
3. Verify network connectivity

## Performance Impact

### Database Load
- **Before**: 1 execution = 1 Execution record + N NodeExecution records
- **After**: 0 database writes ✅

### Response Time
- **Fire & Forget**: Same (instant)
- **Wait for Completion**: Slightly faster (Redis vs Database)

### Storage Costs
- **Reduction**: ~100% for execution history
- **Redis Usage**: Minimal (60s TTL, small payloads)

## Monitoring

### Key Metrics
```bash
# Count executions in database (should be 0)
SELECT COUNT(*) FROM "Execution" 
WHERE "workflowId" = 'your-workflow-id' 
AND "createdAt" > NOW() - INTERVAL '1 hour';

# Check Redis cache size
redis-cli DBSIZE

# Monitor Redis memory
redis-cli INFO memory
```

### Logs to Watch
```
✅ Success:
- "⏭️ Skipping database save for execution"
- "Cached execution result for {executionId}"
- "Retrieved cached execution result for {executionId}"

⚠️  Warnings:
- "Timeout waiting for execution result"
- "Redis connection error"
```

## FAQ

**Q: Will I lose execution history?**
A: Yes, that's the point. No database records are created.

**Q: Can I still see real-time execution in the editor?**
A: Yes! Socket.IO events still work for real-time monitoring.

**Q: What happens if Redis is down?**
A: Fire-and-forget webhooks work fine. Wait-for-completion webhooks will timeout.

**Q: Can I enable/disable per workflow?**
A: Yes! Each workflow has its own `saveExecutionToDatabase` setting.

**Q: Does this affect node execution?**
A: No, nodes execute normally. Only database persistence is skipped.

**Q: Can I re-enable it later?**
A: Yes, just toggle "Save Execution History" back ON.

## Quick Commands

```bash
# Check Redis is running
redis-cli ping

# View cached execution results
redis-cli KEYS "execution:result:*"

# Get specific result
redis-cli GET "execution:result:{executionId}"

# Monitor Redis in real-time
redis-cli MONITOR

# Check Redis memory usage
redis-cli INFO memory | grep used_memory_human

# Clear all execution result cache
redis-cli KEYS "execution:result:*" | xargs redis-cli DEL
```

## Support

For issues or questions:
1. Check logs: `backend/logs/`
2. Check Redis: `redis-cli ping`
3. Check workflow settings: `settings.saveExecutionToDatabase`
4. Review documentation: `EXECUTION_RESULT_DELIVERY_SUMMARY.md`
