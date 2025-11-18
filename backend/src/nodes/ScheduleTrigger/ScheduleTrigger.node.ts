import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const ScheduleTriggerNode: NodeDefinition = {
  identifier: "schedule-trigger",
  displayName: "Schedule Trigger",
  name: "scheduleTrigger",
  group: ["trigger"],
  version: 1,
  description:
    "Triggers workflow execution on a schedule using cron expressions or specific date/time",
  icon: "?",
  color: "#9C27B0",
  defaults: {
    scheduleMode: "cron",
    cronExpression: "0 0 * * *",
    timezone: "UTC",
  },
  inputs: [],
  outputs: ["main"],
  properties: [
    {
      displayName: "Schedule Mode",
      name: "scheduleMode",
      type: "options",
      required: true,
      default: "cron",
      description: "Choose how to define the schedule",
      options: [
        { name: "Cron Expression", value: "cron" },
        { name: "Simple Schedule", value: "simple" },
        { name: "Specific Date/Time", value: "datetime" },
      ],
    },
    // Cron Expression Mode
    {
      displayName: "Cron Expression",
      name: "cronExpression",
      type: "string",
      required: true,
      default: "0 0 * * *",
      placeholder: '*/5 * * * * (every 5 min), 0 9 * * 1-5 (weekdays 9AM)',
      description:
        'Cron expression (e.g., "0 0 * * *" for daily at midnight, "*/15 * * * *" for every 15 minutes)',
      displayOptions: {
        show: {
          scheduleMode: ["cron"],
        },
      },
    },
    // Simple Schedule Mode
    {
      displayName: "Interval",
      name: "interval",
      type: "options",
      required: true,
      default: "hour",
      description: "How often to trigger",
      options: [
        { name: "Every Minute", value: "minute" },
        { name: "Every 5 Minutes", value: "5minutes" },
        { name: "Every 15 Minutes", value: "15minutes" },
        { name: "Every 30 Minutes", value: "30minutes" },
        { name: "Every Hour", value: "hour" },
        { name: "Every Day", value: "day" },
        { name: "Every Week", value: "week" },
        { name: "Every Month", value: "month" },
      ],
      displayOptions: {
        show: {
          scheduleMode: ["simple"],
        },
      },
    },
    {
      displayName: "Time of Day",
      name: "timeOfDay",
      type: "string",
      required: false,
      default: "00:00",
      placeholder: "14:30",
      description: "Time in HH:MM format (24-hour, e.g., 14:30 for 2:30 PM)",
      displayOptions: {
        show: {
          scheduleMode: ["simple"],
          interval: ["day", "week", "month"],
        },
      },
    },
    {
      displayName: "Day of Week",
      name: "dayOfWeek",
      type: "options",
      required: false,
      default: "1",
      description: "Which day of the week",
      options: [
        { name: "Monday", value: "1" },
        { name: "Tuesday", value: "2" },
        { name: "Wednesday", value: "3" },
        { name: "Thursday", value: "4" },
        { name: "Friday", value: "5" },
        { name: "Saturday", value: "6" },
        { name: "Sunday", value: "0" },
      ],
      displayOptions: {
        show: {
          scheduleMode: ["simple"],
          interval: ["week"],
        },
      },
    },
    {
      displayName: "Day of Month",
      name: "dayOfMonth",
      type: "number",
      required: false,
      default: 1,
      description: "Day of the month (1-31)",
      displayOptions: {
        show: {
          scheduleMode: ["simple"],
          interval: ["month"],
        },
      },
    },
    // Specific Date/Time Mode
    {
      displayName: "Start Date",
      name: "startDate",
      type: "dateTime",
      required: true,
      default: "",
      description: "When to start the execution (ISO 8601 format or date picker)",
      displayOptions: {
        show: {
          scheduleMode: ["datetime"],
        },
      },
    },
    {
      displayName: "Repeat",
      name: "repeat",
      type: "boolean",
      required: false,
      default: false,
      description: "Whether to repeat after the first execution",
      displayOptions: {
        show: {
          scheduleMode: ["datetime"],
        },
      },
    },
    {
      displayName: "Repeat Interval",
      name: "repeatInterval",
      type: "options",
      required: false,
      default: "day",
      description: "How often to repeat",
      options: [
        { name: "Every Hour", value: "hour" },
        { name: "Every Day", value: "day" },
        { name: "Every Week", value: "week" },
        { name: "Every Month", value: "month" },
      ],
      displayOptions: {
        show: {
          scheduleMode: ["datetime"],
          repeat: [true],
        },
      },
    },
    {
      displayName: "End Date",
      name: "endDate",
      type: "dateTime",
      required: false,
      default: "",
      description: "When to stop repeating (optional)",
      displayOptions: {
        show: {
          scheduleMode: ["datetime"],
          repeat: [true],
        },
      },
    },
    // Common Settings
    {
      displayName: "Timezone",
      name: "timezone",
      type: "options",
      required: true,
      default: "UTC",
      description: "Timezone for the schedule",
      options: [
        { name: "UTC", value: "UTC" },
        { name: "America/New_York", value: "America/New_York" },
        { name: "America/Chicago", value: "America/Chicago" },
        { name: "America/Denver", value: "America/Denver" },
        { name: "America/Los_Angeles", value: "America/Los_Angeles" },
        { name: "Europe/London", value: "Europe/London" },
        { name: "Europe/Paris", value: "Europe/Paris" },
        { name: "Europe/Berlin", value: "Europe/Berlin" },
        { name: "Asia/Tokyo", value: "Asia/Tokyo" },
        { name: "Asia/Shanghai", value: "Asia/Shanghai" },
        { name: "Asia/Kolkata", value: "Asia/Kolkata" },
        { name: "Australia/Sydney", value: "Australia/Sydney" },
      ],
    },
    {
      displayName: "Description",
      name: "description",
      type: "string",
      required: false,
      default: "",
      description: "Optional description for this schedule",
    },
  ],
  execute: async function (
    _inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Schedule triggers don't execute in the traditional sense
    // They are activated by the TriggerService based on cron schedule
    // This function is called when the scheduled time is reached

    const scheduleMode = this.getNodeParameter("scheduleMode") as string;
    const timezone = this.getNodeParameter("timezone") as string;
    const description = this.getNodeParameter("description") as string;

    let cronExpression: string;
    let scheduleInfo: any = {};

    // Convert schedule mode to cron expression
    if (scheduleMode === "cron") {
      cronExpression = this.getNodeParameter("cronExpression") as string;
    } else if (scheduleMode === "simple") {
      const interval = this.getNodeParameter("interval") as string;
      const timeOfDay = this.getNodeParameter("timeOfDay") as string;
      const dayOfWeek = this.getNodeParameter("dayOfWeek") as string;
      const dayOfMonth = this.getNodeParameter("dayOfMonth") as number;

      cronExpression = convertSimpleToCron(
        interval,
        timeOfDay,
        dayOfWeek,
        dayOfMonth
      );
      scheduleInfo = { interval, timeOfDay, dayOfWeek, dayOfMonth };
    } else if (scheduleMode === "datetime") {
      const startDate = this.getNodeParameter("startDate") as string;
      const repeat = this.getNodeParameter("repeat") as boolean;
      const repeatInterval = this.getNodeParameter("repeatInterval") as string;
      const endDate = this.getNodeParameter("endDate") as string;

      cronExpression = convertDateTimeToCron(
        startDate,
        repeat,
        repeatInterval
      );
      scheduleInfo = { startDate, repeat, repeatInterval, endDate };
    } else {
      cronExpression = "0 0 * * *"; // Default fallback
    }

    return [
      {
        main: [
          {
            json: {
              scheduledAt: new Date().toISOString(),
              scheduleMode,
              cronExpression,
              timezone,
              description,
              scheduleInfo,
              triggerType: "schedule",
            },
          },
        ],
      },
    ];
  },
};

// Helper function to convert simple schedule to cron
function convertSimpleToCron(
  interval: string,
  timeOfDay?: string,
  dayOfWeek?: string,
  dayOfMonth?: number
): string {
  const [hour, minute] = timeOfDay ? timeOfDay.split(":") : ["0", "0"];

  switch (interval) {
    case "minute":
      return "* * * * *";
    case "5minutes":
      return "*/5 * * * *";
    case "15minutes":
      return "*/15 * * * *";
    case "30minutes":
      return "*/30 * * * *";
    case "hour":
      return "0 * * * *";
    case "day":
      return `${minute} ${hour} * * *`;
    case "week":
      return `${minute} ${hour} * * ${dayOfWeek || "1"}`;
    case "month":
      return `${minute} ${hour} ${dayOfMonth || "1"} * *`;
    default:
      return "0 0 * * *";
  }
}

// Helper function to convert datetime to cron
function convertDateTimeToCron(
  startDate: string,
  repeat: boolean,
  repeatInterval?: string
): string {
  const date = new Date(startDate);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  if (!repeat) {
    // One-time execution at specific date/time
    return `${minute} ${hour} ${day} ${month} *`;
  }

  // Repeating execution
  switch (repeatInterval) {
    case "hour":
      return `${minute} * * * *`;
    case "day":
      return `${minute} ${hour} * * *`;
    case "week":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "month":
      return `${minute} ${hour} ${day} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}
