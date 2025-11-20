/**
 * Shared webhook options configuration
 * Used by Webhook, Form, and Chat nodes for consistency
 */

export interface WebhookOptionsConfig {
  name: string;
  displayName: string;
  type: string;
  default: any;
  placeholder?: string;
  tooltip?: string;
  description?: string;
  displayOptions?: any;
}

/**
 * Common webhook options shared across all webhook-based triggers
 */
export const commonWebhookOptions: WebhookOptionsConfig[] = [
  {
    name: "allowedOrigins",
    displayName: "Allowed Origins (CORS)",
    type: "string",
    default: "*",
    placeholder: "https://example.com, https://app.example.com",
    tooltip: "Comma-separated list of allowed origins for CORS. Use * to allow all origins.",
    description: "Control which websites can access this endpoint. Use * to allow all origins, or specify domains.",
  },
  {
    name: "saveRequestLogs",
    displayName: "Save Request Logs",
    type: "boolean",
    default: false,
    tooltip: "Save request logs to database for debugging and monitoring",
    description: "Enable to log all requests. Disable for high-traffic endpoints or to avoid storing sensitive data.",
  },
  {
    name: "ipWhitelist",
    displayName: "IP(s) Whitelist",
    type: "string",
    default: "",
    placeholder: "192.168.1.1, 10.0.0.0/8",
    tooltip: "Restrict access by IP address or CIDR range",
    description: "Comma-separated list of allowed IP addresses or CIDR ranges. Leave blank to allow all IPs.",
  },
  {
    name: "ignoreBots",
    displayName: "Ignore Bots",
    type: "boolean",
    default: false,
    tooltip: "Ignore requests from bots like link previewers and web crawlers",
    description: "Prevent bot traffic from triggering the workflow (e.g., Googlebot, Slackbot, etc.)",
  },
];

/**
 * Webhook-specific options (not applicable to forms/chats)
 */
export const webhookSpecificOptions: WebhookOptionsConfig[] = [
  {
    name: "binaryProperty",
    displayName: "Binary Property",
    type: "string",
    default: "data",
    placeholder: "data",
    tooltip: "Name of the binary property to write received file data to",
    description: "Enables receiving binary data like images or audio files.",
  },
  {
    name: "noResponseBody",
    displayName: "No Response Body",
    type: "boolean",
    default: false,
    tooltip: "Send empty response body",
    description: "Prevent sending a body with the response (only status code and headers)",
  },
  {
    name: "rawBody",
    displayName: "Raw Body",
    type: "boolean",
    default: false,
    tooltip: "Receive unparsed request body",
    description: "Receive data in raw format (useful for webhooks that send non-JSON data like XML)",
  },
  {
    name: "responseContentType",
    displayName: "Response Content-Type",
    type: "options",
    default: "application/json",
    tooltip: "Set response format type",
    description: "Content-Type header for the webhook response",
  },
];

/**
 * Form-specific options
 */
export const formSpecificOptions: WebhookOptionsConfig[] = [
  {
    name: "rateLimitPerIP",
    displayName: "Rate Limit Per IP",
    type: "number",
    default: 5,
    tooltip: "Maximum form submissions per IP within the time window",
    description: "Prevent spam by limiting submissions per IP address (default: 5 per 15 minutes)",
  },
];

/**
 * Chat-specific options
 */
export const chatSpecificOptions: WebhookOptionsConfig[] = [
  {
    name: "rateLimitPerIP",
    displayName: "Rate Limit Per IP",
    type: "number",
    default: 10,
    tooltip: "Maximum chat messages per IP within the time window",
    description: "Prevent spam by limiting messages per IP address (default: 10 per minute)",
  },
];

/**
 * Get all options for a specific webhook type
 */
export function getWebhookOptions(type: 'webhook' | 'form' | 'chat'): WebhookOptionsConfig[] {
  const options = [...commonWebhookOptions];
  
  switch (type) {
    case 'webhook':
      return [...options, ...webhookSpecificOptions];
    case 'form':
      return [...options, ...formSpecificOptions];
    case 'chat':
      return [...options, ...chatSpecificOptions];
    default:
      return options;
  }
}
