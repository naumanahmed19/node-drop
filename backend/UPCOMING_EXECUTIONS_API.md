# Upcoming Executions API

## Overview

View upcoming scheduled executions for workflows with schedule triggers. This helps you see when your workflows will run next.

## Endpoint

```
GET /api/workflows/:id/upcoming-executions
```

## Authentication

Requires authentication token in header:
```
Authorization: Bearer YOUR_TOKEN
```

## Parameters

### Path Parameters
- `id` (required): Workflow ID (UUID)

### Query Parameters
- `limit` (optional): Number of upcoming executions to return per trigger (default: 10, max: 100)

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "workflowId": "abc-123-def-456",
    "workflowName": "My Scheduled Workflow",
    "active": true,
    "totalTriggers": 2,
    "upcomingExecutions": [
      {
        "triggerId": "trigger-node1",
        "triggerNodeId": "node1",
        "triggerType": "schedule",
        "scheduleMode": "simple",
        "cronExpression": "* * * * *",
        "timezone": "UTC",
        "description": "Every minute",
        "nextExecutions": [
          {
            "timestamp": "2025-10-31T15:01:00.000Z",
            "iso": "2025-10-31T15:01:00.000Z",
            "relative": "in 30 seconds",
            "cronExpression": "* * * * *"
          },
          {
            "timestamp": "2025-10-31T15:02:00.000Z",
            "iso": "2025-10-31T15:02:00.000Z",
            "relative": "in 1 minute",
            "cronExpression": "* * * * *"
          },
          {
            "timestamp": "2025-10-31T15:03:00.000Z",
            "iso": "2025-10-31T15:03:00.000Z",
            "relative": "in 2 minutes",
            "cronExpression": "* * * * *"
          }
        ]
      },
      {
        "triggerId": "trigger-node2",
        "triggerNodeId": "node2",
        "triggerType": "schedule",
        "scheduleMode": "cron",
        "cronExpression": "0 9 * * 1-5",
        "timezone": "America/New_York",
        "description": "Weekdays at 9:00 AM",
        "nextExecutions": [
          {
            "timestamp": "2025-11-01T09:00:00.000Z",
            "iso": "2025-11-01T09:00:00.000Z",
            "relative": "in 18 hours",
            "cronExpression": "0 9 * * 1-5"
          },
          {
            "timestamp": "2025-11-04T09:00:00.000Z",
            "iso": "2025-11-04T09:00:00.000Z",
            "relative": "in 4 days",
            "cronExpression": "0 9 * * 1-5"
          }
        ]
      }
    ]
  }
}
```

### No Schedule Triggers Response

```json
{
  "success": true,
  "data": {
    "workflowId": "abc-123-def-456",
    "workflowName": "My Workflow",
    "active": true,
    "upcomingExecutions": [],
    "message": "No active schedule triggers found"
  }
}
```

### Error Response (404 Not Found)

```json
{
  "success": false,
  "error": {
    "message": "Workflow not found",
    "code": "WORKFLOW_NOT_FOUND"
  }
}
```

## Examples

### cURL

```bash
# Get upcoming executions for a workflow
curl -X GET "http://localhost:3000/api/workflows/abc-123-def-456/upcoming-executions?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript/Fetch

```javascript
const response = await fetch(
  'http://localhost:3000/api/workflows/abc-123-def-456/upcoming-executions?limit=5',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log('Upcoming executions:', data.data.upcomingExecutions);
```

### Axios

```javascript
const { data } = await axios.get(
  `/api/workflows/${workflowId}/upcoming-executions`,
  {
    params: { limit: 5 },
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

console.log('Next execution:', data.data.upcomingExecutions[0]?.nextExecutions[0]);
```

## Response Fields

### Root Level
- `workflowId`: UUID of the workflow
- `workflowName`: Name of the workflow
- `active`: Whether the workflow is active
- `totalTriggers`: Number of active schedule triggers
- `upcomingExecutions`: Array of trigger execution schedules

### Trigger Level (upcomingExecutions[])
- `triggerId`: ID of the trigger
- `triggerNodeId`: ID of the trigger node in the workflow
- `triggerType`: Always "schedule" for this endpoint
- `scheduleMode`: "cron", "simple", or "datetime"
- `cronExpression`: The cron expression used
- `timezone`: Timezone for the schedule
- `description`: Human-readable description of the schedule
- `nextExecutions`: Array of upcoming execution times

### Execution Time Level (nextExecutions[])
- `timestamp`: JavaScript Date object
- `iso`: ISO 8601 formatted timestamp
- `relative`: Human-readable relative time (e.g., "in 5 minutes")
- `cronExpression`: The cron expression that generated this time

## Use Cases

### 1. Display Next Execution in UI

```javascript
async function showNextExecution(workflowId) {
  const { data } = await fetch(`/api/workflows/${workflowId}/upcoming-executions?limit=1`);
  
  if (data.upcomingExecutions.length > 0) {
    const next = data.upcomingExecutions[0].nextExecutions[0];
    console.log(`Next execution: ${next.relative} (${next.iso})`);
  }
}
```

### 2. Show All Upcoming Executions

```javascript
async function listUpcomingExecutions(workflowId) {
  const { data } = await fetch(`/api/workflows/${workflowId}/upcoming-executions?limit=10`);
  
  data.upcomingExecutions.forEach(trigger => {
    console.log(`\nTrigger: ${trigger.description}`);
    trigger.nextExecutions.forEach((exec, i) => {
      console.log(`  ${i + 1}. ${exec.relative} - ${exec.iso}`);
    });
  });
}
```

### 3. Check if Workflow Will Run Soon

```javascript
async function willRunSoon(workflowId, withinMinutes = 60) {
  const { data } = await fetch(`/api/workflows/${workflowId}/upcoming-executions?limit=1`);
  
  if (data.upcomingExecutions.length === 0) return false;
  
  const next = data.upcomingExecutions[0].nextExecutions[0];
  const nextTime = new Date(next.timestamp);
  const now = new Date();
  const diffMinutes = (nextTime - now) / 1000 / 60;
  
  return diffMinutes <= withinMinutes;
}
```

### 4. Display Schedule Calendar

```javascript
async function getScheduleCalendar(workflowId) {
  const { data } = await fetch(`/api/workflows/${workflowId}/upcoming-executions?limit=50`);
  
  const calendar = {};
  
  data.upcomingExecutions.forEach(trigger => {
    trigger.nextExecutions.forEach(exec => {
      const date = new Date(exec.timestamp).toLocaleDateString();
      if (!calendar[date]) calendar[date] = [];
      calendar[date].push({
        time: new Date(exec.timestamp).toLocaleTimeString(),
        description: trigger.description
      });
    });
  });
  
  return calendar;
}
```

## Common Schedule Descriptions

The API automatically generates human-readable descriptions for common cron patterns:

| Cron Expression | Description |
|----------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 * * 1` | Weekly on Monday at midnight |
| `0 0 1 * *` | Monthly on the 1st at midnight |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |

## Notes

- Only returns executions for **active** schedule triggers
- Workflow must be **active** for triggers to actually fire
- Times are calculated based on the cron expression and timezone
- Maximum limit is 100 executions per trigger
- Relative times are approximate and update in real-time
- Invalid cron expressions are skipped with a warning in logs

## Integration with Frontend

### React Example

```jsx
function UpcomingExecutions({ workflowId }) {
  const [upcoming, setUpcoming] = useState(null);
  
  useEffect(() => {
    async function fetchUpcoming() {
      const response = await fetch(
        `/api/workflows/${workflowId}/upcoming-executions?limit=5`
      );
      const data = await response.json();
      setUpcoming(data.data);
    }
    
    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [workflowId]);
  
  if (!upcoming) return <div>Loading...</div>;
  
  return (
    <div>
      <h3>Upcoming Executions</h3>
      {upcoming.upcomingExecutions.map(trigger => (
        <div key={trigger.triggerId}>
          <h4>{trigger.description}</h4>
          <ul>
            {trigger.nextExecutions.slice(0, 3).map((exec, i) => (
              <li key={i}>
                {exec.relative} - {new Date(exec.iso).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

## Troubleshooting

### No upcoming executions returned

**Possible causes:**
1. Workflow has no schedule triggers
2. Schedule triggers are not active
3. Workflow is not active
4. Invalid cron expression

**Solution:**
- Check workflow has schedule trigger nodes
- Ensure triggers are active (not disabled)
- Activate the workflow
- Validate cron expression

### Times seem incorrect

**Possible causes:**
1. Timezone mismatch
2. Server time incorrect

**Solution:**
- Check timezone setting in trigger
- Verify server time is correct
- Use UTC for consistency

### Relative times not updating

**Solution:**
- Refresh the data periodically (every minute)
- Recalculate relative times on the frontend

## Related Endpoints

- `GET /api/workflows/:id` - Get workflow details
- `GET /api/workflows/:id/triggers` - Get workflow triggers
- `GET /api/workflows/:id/executions` - Get past executions
- `POST /api/executions` - Manually execute workflow
