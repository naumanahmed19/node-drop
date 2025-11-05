import { useEffect, useState } from 'react'

interface DelayCountdownProps {
  /** Total delay time in milliseconds */
  totalMs: number
  /** Start time of the delay (ISO string or timestamp) */
  startTime?: string | number
  /** Whether the delay is currently running */
  isRunning: boolean
  /** Time unit for display */
  timeUnit: 'seconds' | 'minutes' | 'hours'
}

export function DelayCountdown({ totalMs, isRunning, timeUnit }: DelayCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(totalMs)
  const [localStartTime, setLocalStartTime] = useState<number | null>(null)

  useEffect(() => {
    // When execution starts, capture the start time ONCE
    if (isRunning && localStartTime === null) {
      setLocalStartTime(Date.now())
    }

    // When execution stops, reset everything
    if (!isRunning) {
      setRemainingMs(totalMs)
      setLocalStartTime(null)
    }
  }, [isRunning, totalMs, localStartTime])

  useEffect(() => {
    // Only run countdown when we're running AND have a start time
    if (!isRunning || localStartTime === null) {
      return
    }

    let isMounted = true

    const updateCountdown = () => {
      if (!isMounted) return

      const now = Date.now()
      const elapsed = now - localStartTime
      const remaining = Math.max(0, totalMs - elapsed)

      setRemainingMs(remaining)
    }

    // Update immediately
    updateCountdown()

    // Update every 100ms for smooth countdown
    const interval = setInterval(updateCountdown, 100)

    // Cleanup function
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isRunning, localStartTime, totalMs])

  // Format the display based on time unit
  const formatTime = (ms: number): string => {
    if (timeUnit === 'seconds') {
      const seconds = (ms / 1000).toFixed(1)
      return `${seconds}s`
    } else if (timeUnit === 'minutes') {
      const minutes = (ms / 60000).toFixed(1)
      return `${minutes}m`
    } else {
      const hours = (ms / 3600000).toFixed(1)
      return `${hours}h`
    }
  }

  // Show static time when not running
  if (!isRunning) {
    return (
      <div className="flex items-center gap-0.5 bg-muted/70 backdrop-blur-sm text-muted-foreground text-[9px] font-medium px-1 py-0.5 rounded-sm shadow-sm border border-border/40 min-w-[36px] h-4">
        <svg className="w-2 h-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="tabular-nums leading-none">{formatTime(totalMs)}</span>
      </div>
    )
  }

  // Show countdown when running
  return (
    <div className="flex items-center gap-0.5 bg-orange-500/90 backdrop-blur-sm text-white text-[9px] font-semibold px-1 py-0.5 rounded-sm shadow-md border border-orange-400/40 animate-pulse min-w-[36px] h-4">
      <svg className="w-2 h-2 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="tabular-nums leading-none">{formatTime(remainingMs)}</span>
    </div>
  )
}
