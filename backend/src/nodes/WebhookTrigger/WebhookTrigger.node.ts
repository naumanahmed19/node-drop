import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const WebhookTriggerNode: NodeDefinition = {
  type: "webhook-trigger",
  displayName: "Webhook Trigger",
  name: "webhookTrigger",
  group: ["trigger"],
  version: 1,
  description: "Triggers workflow execution when a webhook is called",
  icon: "Webhook",
  color: "#3B82F6",
  defaults: {
    httpMethod: "POST",
    path: "",
    responseMode: "onReceived",
    responseData: "firstEntryJson",
  },
  inputs: [],
  outputs: ["main"],
  properties: [
    {
      displayName: "Authentication",
      name: "authentication",
      type: "credential",
      required: false,
      default: "",
      description:
        "Require authentication for incoming webhook requests (optional)",
      placeholder: "None (allow all requests)",
      allowedTypes: ["httpBasicAuth", "httpHeaderAuth", "webhookQueryAuth"],
    },
    {
      displayName: "Webhook Path",
      name: "webhookPath",
      type: "string",
      required: false,
      default: "",
      placeholder: "e.g., users, orders/:orderId, users/:userId/posts",
      description: "Custom webhook path. Supports parameters with :paramName syntax. Production URLs will include a unique ID.",
    },
    {
      displayName: "Webhook URL",
      name: "webhookUrl",
      type: "custom",
      required: false,
      default: "",
      description: "Generated webhook URL for test and production environments",
      component: "WebhookUrlGenerator",
      componentProps: {
        mode: "test",
        dependsOn: ["webhookPath"],
      },
    },
    {
      displayName: "HTTP Method",
      name: "httpMethod",
      type: "options",
      required: true,
      default: "POST",
      description: "The HTTP method to listen for",
      options: [
        { name: "GET", value: "GET" },
        { name: "POST", value: "POST" },
        { name: "PUT", value: "PUT" },
        { name: "DELETE", value: "DELETE" },
        { name: "PATCH", value: "PATCH" },
      ],
    },
    {
      displayName: "Response Mode",
      name: "responseMode",
      type: "options",
      required: true,
      default: "onReceived",
      description: "When to respond to the webhook",
      options: [
        { name: "Immediately", value: "onReceived" },
        { name: "When Workflow Finishes", value: "lastNode" },
      ],
    },
    {
      displayName: "Response Data",
      name: "responseData",
      type: "options",
      required: true,
      default: "firstEntryJson",
      description: "What data to return in the response",
      options: [
        { name: "First Entry JSON", value: "firstEntryJson" },
        { name: "First Entry Binary", value: "firstEntryBinary" },
        { name: "All Entries", value: "allEntries" },
        { name: "No Data", value: "noData" },
      ],
    },
    {
      displayName: "Include Headers",
      name: "includeHeaders",
      type: "boolean",
      default: true,
      description: "Include HTTP headers in the output",
    },
    {
      displayName: "Specific Headers",
      name: "headersToInclude",
      type: "string",
      default: "",
      placeholder: "authorization, content-type, x-api-key",
      description: "Comma-separated list of specific headers to include (leave empty for all)",
      displayOptions: {
        show: {
          includeHeaders: [true],
        },
      },
    },
    {
      displayName: "Include Query Parameters",
      name: "includeQuery",
      type: "boolean",
      default: true,
      description: "Include URL query parameters in the output",
    },
    {
      displayName: "Include Body",
      name: "includeBody",
      type: "boolean",
      default: true,
      description: "Include request body in the output",
    },
    {
      displayName: "Include Path",
      name: "includePath",
      type: "boolean",
      default: true,
      description: "Include request path in the output",
    },
    {
      displayName: "Include Client Info",
      name: "includeClientInfo",
      type: "boolean",
      default: false,
      description: "Include client IP address and user agent",
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Webhook triggers don't execute in the traditional sense
    // They are activated by the TriggerService and provide data to the workflow
    // This function is called when the webhook receives a request

    // The webhook data is passed through the execution context
    const webhookData = inputData.main?.[0]?.[0] || {};

    // Extract the actual webhook data - it might be nested in json property
    const actualData = webhookData.json || webhookData;

    // Get options (with defaults)
    const includeHeaders = (await this.getNodeParameter("includeHeaders") ?? true) as boolean;
    const includeQuery = (await this.getNodeParameter("includeQuery") ?? true) as boolean;
    const includeBody = (await this.getNodeParameter("includeBody") ?? true) as boolean;
    const includePath = (await this.getNodeParameter("includePath") ?? true) as boolean;
    const includeClientInfo = (await this.getNodeParameter("includeClientInfo") ?? false) as boolean;
    const headersToInclude = (await this.getNodeParameter("headersToInclude") ?? "") as string;

    // Build the output with proper structure
    const output: any = {
      method: actualData.method || "GET",
      timestamp: new Date().toISOString(),
    };

    // Add path parameters (e.g., userId from /users/:userId)
    if (actualData.params && Object.keys(actualData.params).length > 0) {
      output.params = actualData.params;
    }

    // Add headers (all or filtered)
    if (includeHeaders) {
      if (headersToInclude) {
        // Include only specific headers
        const headerNames = headersToInclude
          .split(",")
          .map((h: string) => h.trim().toLowerCase())
          .filter((h: string) => h);
        
        const filteredHeaders: any = {};
        const allHeaders = actualData.headers || {};
        
        for (const headerName of headerNames) {
          if (allHeaders[headerName]) {
            filteredHeaders[headerName] = allHeaders[headerName];
          }
        }
        
        output.headers = filteredHeaders;
      } else {
        // Include all headers
        output.headers = actualData.headers || {};
      }
    }

    // Add query parameters
    if (includeQuery) {
      output.query = actualData.query || {};
    }

    // Add body
    if (includeBody) {
      output.body = actualData.body || {};
    }

    // Add path
    if (includePath) {
      output.path = actualData.path || "/";
    }

    // Add client info (IP and user agent)
    if (includeClientInfo) {
      if (actualData.ip) {
        output.ip = actualData.ip;
      }
      if (actualData.userAgent) {
        output.userAgent = actualData.userAgent;
      }
    }

    return [
      {
        main: [
          {
            json: output,
          },
        ],
      },
    ];
  },
};
