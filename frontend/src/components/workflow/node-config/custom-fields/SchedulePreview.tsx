import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import parser from 'cron-parser'

interface SchedulePreviewProps {
  scheduleMode?: string
  cronExpression?: string
  interval?: string
  timeOfDay?: string
  dayOfWeek?: string
  dayOfMonth?: number
  weekdaysOnly?: boolean
  timezone?: string
  startDate?: string
  repeat?: boolean
  repeatInterval?: string
}

export function SchedulePreview(props: SchedulePreviewProps) {
  const [nextRuns, setNextRuns] = useState<Date[]>([])
  const [description, setDescription] = useState<string>('')
  const [error, setError] = useState<string>('')
  
  useEffect(() => {
    try {
      // Convert to cron expression
      let cron = props.cronExpression || ''
      
      if (props.scheduleMode === 'simple') {
        cron = convertSimpleToCron(
          props.interval || 'hour',
          props.timeOfDay,
          props.dayOfWeek,
          props.dayOfMonth,
          props.weekdaysOnly
        )
      } else if (props.scheduleMode === 'datetime') {
        cron = convertDateTimeToCron(
          props.startDate || '',
          props.repeat || false,
          props.repeatInterval
        )
      }
      
      if (!cron) {
        setNextRuns([])
        setDescription('')
        return
      }
      
      // Parse cron and get next 5 runs
      const interval = parser.parseExpression(cron, {
        currentDate: new Date(),
        tz: props.timezone || 'UTC'
      })
      
      const runs: Date[] = []
      for (let i = 0; i < 5; i++) {
        runs.push(interval.next().toDate())
      }
      
      setNextRuns(runs)
      setDescription(getHumanDescription(props))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid schedule')
      setNextRuns([])
      setDescription('')
    }
  }, [
    props.scheduleMode,
    props.cronExpression,
    props.interval,
    props.timeOfDay,
    props.dayOfWeek,
    props.dayOfMonth,
    props.weekdaysOnly,
    props.timezone,
    props.startDate,
    props.repeat,
    props.repeatInterval
  ])
  
  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-destructive">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Invalid Schedule</span>
        </div>
        <p className="text-xs text-destructive/80 mt-1">{error}</p>
      </div>
    )
  }
  
  if (nextRuns.length === 0) return null
  
  return (
    <div className="mt-4 rounded-lg border bg-card text-card-foreground">
      <div className="p-4 space-y-3">
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Next executions</span>
          </div>
          <div className="space-y-1">
            {nextRuns.map((date, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs font-mono py-1.5 px-2 rounded-md bg-muted/50"
              >
                <span className="text-muted-foreground">
                  {i === 0 ? '▶' : '•'}
                </span>
                <span className="flex-1">{format(date, 'MMM dd, yyyy HH:mm:ss')}</span>
                {i === 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                    Next
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getHumanDescription(props: SchedulePreviewProps): string {
  const tz = props.timezone || 'UTC'
  
  if (props.scheduleMode === 'simple') {
    const intervalMap: Record<string, string> = {
      'minute': 'every minute',
      '2minutes': 'every 2 minutes',
      '5minutes': 'every 5 minutes',
      '10minutes': 'every 10 minutes',
      '15minutes': 'every 15 minutes',
      '30minutes': 'every 30 minutes',
      'hour': 'every hour',
      '2hours': 'every 2 hours',
      '3hours': 'every 3 hours',
      '6hours': 'every 6 hours',
      '12hours': 'every 12 hours',
      'day': props.weekdaysOnly 
        ? `every weekday at ${props.timeOfDay || '00:00'}` 
        : `every day at ${props.timeOfDay || '00:00'}`,
      'week': `every ${getDayName(props.dayOfWeek)} at ${props.timeOfDay || '00:00'}`,
      'month': `on day ${props.dayOfMonth || 1} of every month at ${props.timeOfDay || '00:00'}`
    }
    return `This workflow will run ${intervalMap[props.interval || 'hour']} (${tz})`
  }
  
  if (props.scheduleMode === 'datetime') {
    if (!props.repeat) {
      return `This workflow will run once on ${format(new Date(props.startDate || ''), 'MMM dd, yyyy HH:mm')} (${tz})`
    }
    const intervalMap: Record<string, string> = {
      'hour': 'every hour',
      'day': 'every day',
      'week': 'every week',
      'month': 'every month'
    }
    return `This workflow will run ${intervalMap[props.repeatInterval || 'day']} starting ${format(new Date(props.startDate || ''), 'MMM dd, yyyy HH:mm')} (${tz})`
  }
  
  if (props.scheduleMode === 'cron') {
    return `This workflow will run on schedule: ${props.cronExpression} (${tz})`
  }
  
  return ''
}

function getDayName(day?: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[parseInt(day || '1')] || 'Monday'
}

// Copy conversion functions from ScheduleTrigger.node.ts
function convertSimpleToCron(
  interval: string,
  timeOfDay?: string,
  dayOfWeek?: string,
  dayOfMonth?: number,
  weekdaysOnly?: boolean
): string {
  const [hour, minute] = timeOfDay ? timeOfDay.split(":") : ["0", "0"];

  switch (interval) {
    case "minute": return "* * * * *";
    case "2minutes": return "*/2 * * * *";
    case "5minutes": return "*/5 * * * *";
    case "10minutes": return "*/10 * * * *";
    case "15minutes": return "*/15 * * * *";
    case "30minutes": return "*/30 * * * *";
    case "hour": return "0 * * * *";
    case "2hours": return "0 */2 * * *";
    case "3hours": return "0 */3 * * *";
    case "6hours": return "0 */6 * * *";
    case "12hours": return "0 */12 * * *";
    case "day": 
      // If weekdays only, run Monday-Friday (1-5)
      return weekdaysOnly
        ? `${minute} ${hour} * * 1-5`
        : `${minute} ${hour} * * *`;
    case "week": return `${minute} ${hour} * * ${dayOfWeek || "1"}`;
    case "month": return `${minute} ${hour} ${dayOfMonth || "1"} * *`;
    default: return "0 0 * * *";
  }
}

function convertDateTimeToCron(
  startDate: string,
  repeat: boolean,
  repeatInterval?: string
): string {
  if (!startDate) return "0 0 * * *";
  
  const date = new Date(startDate);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  if (!repeat) {
    return `${minute} ${hour} ${day} ${month} *`;
  }

  switch (repeatInterval) {
    case "hour": return `${minute} * * * *`;
    case "day": return `${minute} ${hour} * * *`;
    case "week": return `${minute} ${hour} * * ${dayOfWeek}`;
    case "month": return `${minute} ${hour} ${day} * *`;
    default: return `${minute} ${hour} * * *`;
  }
}
