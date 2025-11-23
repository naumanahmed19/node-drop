/**
 * Utility functions for schedule trigger conversions
 */

/**
 * Convert simple schedule settings to cron expression
 */
export function convertSimpleToCron(
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

/**
 * Convert datetime schedule settings to cron expression
 */
export function convertDateTimeToCron(
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

/**
 * Convert schedule trigger settings to proper cron expression
 * Handles simple, datetime, and cron schedule modes
 */
export function convertScheduleSettings(settings: any): any {
  if (!settings.scheduleMode) {
    return settings;
  }

  const scheduleMode = settings.scheduleMode;

  if (scheduleMode === 'simple') {
    const convertedCron = convertSimpleToCron(
      settings.interval || 'hour',
      settings.timeOfDay,
      settings.dayOfWeek,
      settings.dayOfMonth,
      settings.weekdaysOnly
    );
    return {
      ...settings,
      cronExpression: convertedCron,
    };
  } else if (scheduleMode === 'datetime') {
    const convertedCron = convertDateTimeToCron(
      settings.startDate || '',
      settings.repeat || false,
      settings.repeatInterval
    );
    return {
      ...settings,
      cronExpression: convertedCron,
    };
  }

  // For 'cron' mode, return as-is
  return settings;
}
