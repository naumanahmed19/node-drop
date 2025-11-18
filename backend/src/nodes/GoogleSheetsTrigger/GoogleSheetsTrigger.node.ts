import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const GoogleSheetsTriggerNode: NodeDefinition = {
  identifier: "google-sheets-trigger",
  displayName: "Google Sheets Trigger",
  name: "googleSheetsTrigger",
  group: ["trigger"],
  version: 1,
  description:
    "Triggers workflow execution when changes occur in Google Sheets",
  icon: "📊",
  color: "#0F9D58",
  defaults: {
    triggerOn: "row",
    spreadsheetId: "",
    sheetName: "",
    range: "",
    pollInterval: 60,
    hasHeader: true,
    includeMetadata: true,
    filterMode: "all",
    filters: [],
    columnsToWatch: [],
    detectDeletes: false,
    batchSize: 100,
  },
  inputs: [],
  outputs: ["main"],
  credentials: [
    {
      name: "googleOAuth2",  // Core credential (NEW)
      displayName: "Google OAuth2",
      properties: [],
    },
    {
      name: "googleSheetsOAuth2",  // Legacy credential (for backward compatibility)
      displayName: "Google Sheets OAuth2",
      properties: [],
    },
  ],
  properties: [
    {
      displayName: "Authentication",
      name: "authentication",
      type: "credential",
      required: true,
      default: "",
      description: "Select Google Sheets credentials to connect to the API",
      placeholder: "Select credentials...",
      allowedTypes: ["googleOAuth2", "googleSheetsOAuth2"],
    },
    {
      displayName: "Spreadsheet",
      name: "spreadsheetId",
      type: "custom",
      required: true,
      default: "",
      description: "The Google Sheets spreadsheet to monitor",
      placeholder: "Select a spreadsheet",
      component: "SpreadsheetSelector",
    },
    {
      displayName: "Sheet Name",
      name: "sheetName",
      type: "custom",
      required: true,
      default: "",
      description: "The specific sheet within the spreadsheet to monitor",
      placeholder: "Select a sheet",
      component: "SheetSelector",
      componentProps: {
        dependsOn: "spreadsheetId",
      },
    },
    {
      displayName: "Trigger On",
      name: "triggerOn",
      type: "options",
      required: true,
      default: "row",
      description: "What type of change should trigger the workflow",
      placeholder: "Select trigger event...",
      options: [
        {
          name: "Row Added",
          value: "row",
          description: "Trigger when a new row is added",
        },
        {
          name: "Row Updated",
          value: "rowUpdate",
          description: "Trigger when an existing row is updated",
        },
        {
          name: "Row Deleted",
          value: "rowDelete",
          description: "Trigger when a row is deleted",
        },
        {
          name: "Cell Changed",
          value: "cell",
          description: "Trigger when any cell value changes",
        },
        {
          name: "Any Change",
          value: "any",
          description: "Trigger on any change (add, update, or delete)",
        },
        {
          name: "Specific Columns",
          value: "columns",
          description: "Trigger when specific columns change",
        },
      ],
    },
    {
      displayName: "Range",
      name: "range",
      type: "custom",
      required: false,
      default: "",
      description:
        "Specific range to monitor (e.g., A1:D100). Leave empty to monitor entire sheet",
      placeholder: "e.g., A1:D100",
      component: "RangeSelector",
      componentProps: {
        dependsOn: ["spreadsheetId", "sheetName"],
      },
    },
    {
      displayName: "Columns to Watch",
      name: "columnsToWatch",
      type: "custom",
      required: false,
      default: [],
      description: "Only trigger when these specific columns change",
      component: "ColumnSelector",
      componentProps: {
        dependsOn: ["spreadsheetId", "sheetName"],
        multiSelect: true,
      },
      displayOptions: {
        show: {
          triggerOn: ["columns", "rowUpdate"],
        },
      },
    },
    {
      displayName: "Has Header Row",
      name: "hasHeader",
      type: "boolean",
      required: false,
      default: true,
      description: "Whether the first row contains column headers",
    },
    {
      displayName: "Include Metadata",
      name: "includeMetadata",
      type: "boolean",
      required: false,
      default: true,
      description:
        "Include additional metadata like row number, timestamp, change type",
    },
    {
      displayName: "Poll Interval (seconds)",
      name: "pollInterval",
      type: "number",
      required: false,
      default: 60,
      description:
        "How often to check for changes (in seconds). Minimum: 10 seconds",
      placeholder: "60",
    },
    {
      displayName: "Batch Size",
      name: "batchSize",
      type: "number",
      required: false,
      default: 100,
      description: "Maximum number of rows to process per trigger (1-1000)",
      placeholder: "100",
    },
    {
      displayName: "Filter Mode",
      name: "filterMode",
      type: "options",
      required: false,
      default: "all",
      description: "How to apply filters",
      options: [
        {
          name: "All Changes",
          value: "all",
          description: "Trigger on all changes (no filtering)",
        },
        {
          name: "Match All Filters",
          value: "and",
          description: "Row must match all filter conditions",
        },
        {
          name: "Match Any Filter",
          value: "or",
          description: "Row must match at least one filter condition",
        },
      ],
    },
    {
      displayName: "Filters",
      name: "filters",
      type: "collection",
      required: false,
      default: [],
      description: "Filter which rows trigger the workflow",
      typeOptions: {
        multipleValues: true,
      },
      componentProps: {
        fields: [
          {
            displayName: "Column",
            name: "column",
            type: "custom",
            required: true,
            default: "",
            description: "Column to filter on",
            component: "ColumnSelector",
            componentProps: {
              dependsOn: ["spreadsheetId", "sheetName"],
            },
          },
          {
            displayName: "Condition",
            name: "condition",
            type: "options",
            required: true,
            default: "equals",
            description: "Filter condition",
            options: [
              { name: "Equals", value: "equals" },
              { name: "Not Equals", value: "notEquals" },
              { name: "Contains", value: "contains" },
              { name: "Not Contains", value: "notContains" },
              { name: "Starts With", value: "startsWith" },
              { name: "Ends With", value: "endsWith" },
              { name: "Greater Than", value: "greaterThan" },
              { name: "Less Than", value: "lessThan" },
              { name: "Is Empty", value: "isEmpty" },
              { name: "Is Not Empty", value: "isNotEmpty" },
              { name: "Matches Regex", value: "regex" },
            ],
          },
          {
            displayName: "Value",
            name: "value",
            type: "string",
            required: false,
            default: "",
            description: "Value to compare against",
            displayOptions: {
              hide: {
                condition: ["isEmpty", "isNotEmpty"],
              },
            },
          },
        ],
      },
      displayOptions: {
        show: {
          filterMode: ["and", "or"],
        },
      },
    },
    {
      displayName: "Detect Deletes",
      name: "detectDeletes",
      type: "boolean",
      required: false,
      default: false,
      description:
        "Track and detect when rows are deleted (requires additional API calls)",
    },
    {
      displayName: "Data Format",
      name: "dataFormat",
      type: "options",
      required: false,
      default: "object",
      description: "How to format the row data",
      options: [
        {
          name: "Object (Key-Value)",
          value: "object",
          description: "Return data as objects with column names as keys",
        },
        {
          name: "Array",
          value: "array",
          description: "Return data as arrays of values",
        },
        {
          name: "Both",
          value: "both",
          description: "Include both object and array format",
        },
      ],
    },
    {
      displayName: "Empty Cell Handling",
      name: "emptyCellHandling",
      type: "options",
      required: false,
      default: "null",
      description: "How to handle empty cells",
      options: [
        {
          name: "null",
          value: "null",
          description: "Use null for empty cells",
        },
        {
          name: "Empty String",
          value: "emptyString",
          description: "Use empty string for empty cells",
        },
        {
          name: "Skip",
          value: "skip",
          description: "Don't include empty cells in the object",
        },
      ],
    },
    {
      displayName: "Type Conversion",
      name: "typeConversion",
      type: "boolean",
      required: false,
      default: true,
      description:
        "Automatically convert cell values to appropriate types (numbers, booleans, dates)",
    },
    {
      displayName: "Date Format",
      name: "dateFormat",
      type: "options",
      required: false,
      default: "iso",
      description: "How to format date values",
      options: [
        {
          name: "ISO 8601",
          value: "iso",
          description: "2024-01-15T10:30:00Z",
        },
        {
          name: "Unix Timestamp",
          value: "unix",
          description: "1705315800000",
        },
        {
          name: "Google Sheets Serial",
          value: "serial",
          description: "Keep original serial number",
        },
      ],
      displayOptions: {
        show: {
          typeConversion: [true],
        },
      },
    },
    {
      displayName: "Error Handling",
      name: "errorHandling",
      type: "options",
      required: false,
      default: "stop",
      description: "What to do when an error occurs",
      options: [
        {
          name: "Stop Workflow",
          value: "stop",
          description: "Stop the workflow and report the error",
        },
        {
          name: "Continue",
          value: "continue",
          description: "Continue processing other rows and log the error",
        },
        {
          name: "Retry",
          value: "retry",
          description: "Retry the failed operation",
        },
      ],
    },
    {
      displayName: "Max Retries",
      name: "maxRetries",
      type: "number",
      required: false,
      default: 3,
      description: "Maximum number of retry attempts",
      displayOptions: {
        show: {
          errorHandling: ["retry"],
        },
      },
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Get credentials for Google Sheets API (try core credential first, then legacy)
    let credentials;
    try {
      credentials = await this.getCredentials("googleOAuth2");
      this.logger?.info("[GoogleSheets] Using core Google OAuth2 credential");
    } catch (error) {
      // Fall back to legacy credential for backward compatibility
      try {
        credentials = await this.getCredentials("googleSheetsOAuth2");
        this.logger?.warn("[GoogleSheets] Using legacy googleSheetsOAuth2 credential. Please migrate to googleOAuth2 for better credential reuse across Google services.");
      } catch (error) {
        throw new Error("No Google Sheets credentials found. Please configure either googleOAuth2 or googleSheetsOAuth2 credentials.");
      }
    }

    const spreadsheetId = this.getNodeParameter("spreadsheetId") as string;
    const sheetName = this.getNodeParameter("sheetName") as string;
    const triggerOn = this.getNodeParameter("triggerOn") as string;
    const hasHeader = this.getNodeParameter("hasHeader") as boolean;
    const includeMetadata = this.getNodeParameter("includeMetadata") as boolean;

    // Log credentials for debugging (remove in production)
    this.logger?.info("Google Sheets credentials loaded", {
      hasAccessToken: !!credentials.accessToken,
      clientId: credentials.clientId ? "***" : "missing",
    });

    // The trigger data is passed through the execution context
    const triggerData = inputData.main?.[0]?.[0] || {};

    // In a real implementation, this would be handled by the TriggerService
    // which polls Google Sheets API at the specified interval

    const changeData = triggerData.changes || [];
    const results = [];

    for (const change of changeData) {
      const rowData: any = {
        ...change.data,
      };

      // Add metadata if requested
      if (includeMetadata) {
        rowData._metadata = {
          rowNumber: change.rowNumber,
          changeType: change.changeType,
          timestamp: new Date().toISOString(),
          spreadsheetId,
          sheetName,
          triggerOn,
          columnsChanged: change.columnsChanged || [],
        };
      }

      results.push({ json: rowData });
    }

    // If no changes, return sample data structure
    if (results.length === 0) {
      results.push({
        json: {
          triggeredAt: new Date().toISOString(),
          triggerType: "google-sheets",
          spreadsheetId,
          sheetName,
          message: "Waiting for changes...",
          ...(includeMetadata && {
            _metadata: {
              pollInterval: this.getNodeParameter("pollInterval"),
              triggerOn,
              hasHeader,
            },
          }),
        },
      });
    }

    return [{ main: results }];
  },
};
