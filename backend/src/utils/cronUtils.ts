/**
 * Utility functions for working with cron expressions
 */

import * as cron from "node-cron";

export interface NextExecution {
  timestamp: Date;
  iso: string;
  relative: string;
  cronExpression: string;
}

/**
 * Calculate the next N execution times for a cron expression
 */
export function getNextExecutionTimes(
  cronExpression: string,
  count: number = 10,
  timezone: string = "UTC"
): NextExecution[] {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const executions: NextExecution[] = [];
  const now = new Date();
  let currentTime = new Date(now);

  // Parse cron expression
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Cron expression must have 5 parts");
  }

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Calculate next execution times
  for (let i = 0; i < count * 100 && executions.length < count; i++) {
    currentTime = new Date(currentTime.getTime() + 60000); // Add 1 minute

    if (matchesCron(currentTime, parts, timezone)) {
      executions.push({
        timestamp: new Date(currentTime),
        iso: currentTime.toISOString(),
        relative: getRelativeTime(currentTime),
        cronExpression,
      });
    }
  }

  return executions;
}

/**
 * Check if a date matches a cron expression
 */
function matchesCron(date: Date, parts: string[], timezone: string): boolean {
  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Convert to timezone if needed (simplified - just use UTC for now)
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const weekday = date.getUTCDay();

  return (
    matchesPart(minute, minutePart, 0, 59) &&
    matchesPart(hour, hourPart, 0, 23) &&
    matchesPart(day, dayPart, 1, 31) &&
    matchesPart(month, monthPart, 1, 12) &&
    matchesPart(weekday, weekdayPart, 0, 6)
  );
}

/**
 * Check if a value matches a cron part
 */
function matchesPart(
  value: number,
  part: string,
  min: number,
  max: number
): boolean {
  // Wildcard
  if (part === "*") return true;

  // Step values (e.g., */5)
  if (part.includes("/")) {
    const [range, step] = part.split("/");
    const stepNum = parseInt(step);
    if (range === "*") {
      return value % stepNum === 0;
    }
  }

  // Range (e.g., 1-5)
  if (part.includes("-")) {
    const [start, end] = part.split("-").map(Number);
    return value >= start && value <= end;
  }

  // List (e.g., 1,3,5)
  if (part.includes(",")) {
    const values = part.split(",").map(Number);
    return values.includes(value);
  }

  // Exact match
  return value === parseInt(part);
}

/**
 * Get relative time string (e.g., "in 5 minutes", "in 2 hours")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "now";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `in ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    return `in ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  return `in ${seconds} second${seconds > 1 ? "s" : ""}`;
}

/**
 * Get a human-readable description of a cron expression
 */
export function describeCronExpression(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpression;

  const [minute, hour, day, month, weekday] = parts;

  // Common patterns
  if (cronExpression === "* * * * *") return "Every minute";
  if (cronExpression === "*/5 * * * *") return "Every 5 minutes";
  if (cronExpression === "*/15 * * * *") return "Every 15 minutes";
  if (cronExpression === "*/30 * * * *") return "Every 30 minutes";
  if (cronExpression === "0 * * * *") return "Every hour";
  if (cronExpression === "0 0 * * *") return "Daily at midnight";
  if (cronExpression === "0 9 * * *") return "Daily at 9:00 AM";
  if (cronExpression === "0 0 * * 0") return "Weekly on Sunday at midnight";
  if (cronExpression === "0 0 * * 1") return "Weekly on Monday at midnight";
  if (cronExpression === "0 0 1 * *") return "Monthly on the 1st at midnight";
  if (cronExpression === "0 9 * * 1-5") return "Weekdays at 9:00 AM";

  // Build description
  let description = "";

  // Minute
  if (minute === "*") {
    description += "Every minute";
  } else if (minute.startsWith("*/")) {
    description += `Every ${minute.slice(2)} minutes`;
  } else {
    description += `At minute ${minute}`;
  }

  // Hour
  if (hour !== "*") {
    if (hour.startsWith("*/")) {
      description += `, every ${hour.slice(2)} hours`;
    } else {
      description += `, at ${hour}:00`;
    }
  }

  // Day
  if (day !== "*") {
    description += `, on day ${day}`;
  }

  // Month
  if (month !== "*") {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    description += `, in ${months[parseInt(month) - 1]}`;
  }

  // Weekday
  if (weekday !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (weekday.includes("-")) {
      const [start, end] = weekday.split("-").map(Number);
      description += `, ${days[start]}-${days[end]}`;
    } else {
      description += `, on ${days[parseInt(weekday)]}`;
    }
  }

  return description;
}
