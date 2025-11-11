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
    allowedOrigins: "*",
    ignoreBots: false,
    noResponseBody: false,
    rawBody: false,
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
      displayName: "Webhook URL",
      name: "webhookUrl",
      type: "custom",
      required: false,
      default: "",
      description: "Generated webhook URL for test and production environments",
      component: "WebhookUrlGenerator",
      componentProps: {
        mode: "test",
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
    
    // === OPTIONS SECTION ===
    {
      displayName: "Options",
      name: "options",
      type: "collection",
      placeholder: "Add Option",
      default: {},
      description: "Additional webhook configuration options",
      options: [
        {
          name: "allowedOrigins",
          displayName: "Allowed Origins (CORS)",
          type: "string",
          default: "*",
          placeholder: "https://example.com, https://app.example.com",
          description: "Comma-separated list of allowed origins for CORS. Use * to allow all origins.",
        },
        {
          name: "binaryProperty",
          displayName: "Binary Property",
          type: "string",
          default: "data",
          placeholder: "data",
          description: "Name of the binary property to write received file data to. Enables receiving binary data like images or audio files.",
        },
        {
          name: "ignoreBots",
          displayName: "Ignore Bots",
          type: "boolean",
          default: false,
          description: "Ignore requests from bots like link previewers and web crawlers",
        },
        {
          name: "ipWhitelist",
          displayName: "IP(s) Whitelist",
          type: "string",
          default: "",
          placeholder: "192.168.1.1, 10.0.0.0/8",
          description: "Comma-separated list of allowed IP addresses or CIDR ranges. Leave blank to allow all IPs.",
        },
        {
          name: "noResponseBody",
          displayName: "No Response Body",
          type: "boolean",
          default: false,
          description: "Prevent sending a body with the response (only status code and headers)",
        },
        {
          name: "rawBody",
          displayName: "Raw Body",
          type: "boolean",
          default: false,
          description: "Receive data in raw format (useful for webhooks that send non-JSON data like XML)",
        },
        {
          name: "responseContentType",
          displayName: "Response Content-Type",
          type: "options",
          default: "application/json",
          description: "Content-Type header for the webhook response",
          options: [
            { name: "JSON", value: "application/json" },
            { name: "Text", value: "text/plain" },
            { name: "HTML", value: "text/html" },
            { name: "XML", value: "application/xml" },
            { name: "Custom", value: "custom" },
          ],
        },
        {
          name: "customContentType",
          displayName: "Custom Content-Type",
          type: "string",
          default: "",
          placeholder: "application/x-custom",
          description: "Custom Content-Type value",
          displayOptions: {
            show: {
              responseContentType: ["custom"],
            },
          },
        },
        {
          name: "responseHeaders",
          displayName: "Response Headers",
          type: "fixedCollection",
          typeOptions: {
            multipleValues: true,
          },
          default: {},
          description: "Additional headers to send with the webhook response",
          options: [
            {
              name: "entries",
              displayName: "Header",
              values: [
                {
                  name: "name",
                  displayName: "Name",
                  type: "string",
                  default: "",
                  placeholder: "X-Custom-Header",
                  description: "Header name",
                },
                {
                  name: "value",
                  displayName: "Value",
                  type: "string",
                  default: "",
                  placeholder: "header-value",
                  description: "Header value",
                },
              ],
            },
          ],
        },
        {
          name: "propertyName",
          displayName: "Property Name",
          type: "string",
          default: "",
          placeholder: "data.result",
          description: "Return only a specific JSON property path instead of all data (e.g., 'data.result' or 'items[0]')",
        },
        {
          name: "includeData",
          displayName: "Include Data",
          type: "multiOptions",
          default: ["headers", "query", "body", "path"],
          description: "Select which data to include in the webhook output",
          options: [
            { name: "Headers", value: "headers" },
            { name: "Query Parameters", value: "query" },
            { name: "Body", value: "body" },
            { name: "Path", value: "path" },
            { name: "Client Info (IP & User Agent)", value: "clientInfo" },
          ],
        },
        {
          name: "headersToInclude",
          displayName: "Specific Headers",
          type: "string",
          default: "",
          placeholder: "authorization, content-type, x-api-key",
          description: "Comma-separated list of specific headers to include (leave empty for all)",
          displayOptions: {
            show: {
              includeData: ["headers"],
            },
          },
        },
      ] as any,
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

    // Get options (all from options collection now)
    const options = (await this.getNodeParameter("options") ?? {}) as any;
    const includeData = options.includeData ?? ["headers", "query", "body", "path"];
    const includeHeaders = includeData.includes("headers");
    const includeQuery = includeData.includes("query");
    const includeBody = includeData.includes("body");
    const includePath = includeData.includes("path");
    const includeClientInfo = includeData.includes("clientInfo");
    const headersToInclude = options.headersToInclude ?? "";
    const binaryProperty = options.binaryProperty || "data";
    const rawBody = options.rawBody || false;

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

    // Add body (raw or parsed)
    if (includeBody) {
      if (rawBody && actualData.rawBody) {
        output.body = actualData.rawBody;
      } else {
        output.body = actualData.body || {};
      }
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

    // Handle binary data if present
    const outputData: NodeOutputData = {
      main: [
        {
          json: output,
        },
      ],
    };

    // If binary data is present, add it to the output
    // Binary data comes from webhookData.binary, not actualData.binary
    const binaryData = webhookData.binary || actualData.binary;
    
    if (binaryData && binaryProperty && outputData.main?.[0]) {
      // Binary data from webhook route is structured as:
      // { fieldName1: {data, mimeType, fileName, fileSize}, fieldName2: {...}, ... }
      // Wrap all files under the binaryProperty name
      outputData.main[0].binary = {
        [binaryProperty]: binaryData
      };
    }

    return [outputData];
  },
};
