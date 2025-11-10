# Webhook Trigger Node

Complete documentation for the Webhook Trigger node implementation, including all features, options, and usage examples.

## Overview

The Webhook Trigger node allows workflows to be triggered by incoming HTTP requests. It supports various HTTP methods, authentication, CORS, file uploads, and custom response handling.

## Features

### Core Features
- **Multiple HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Path Parameters**: Support for dynamic URL parameters (e.g., `/users/:userId`)
- **Authentication**: Basic Auth, Header Auth, Query Auth
- **File Uploads**: Single and multiple file uploads with any field names
- **CORS Support**: Configurable allowed origins
- **Custom Responses**: Control response mode, data, headers, and content type

### Response Modes
1. **Immediately (onReceived)**: Respond as soon as webhook is received
2. **When Workflow Finishes (lastNode)**: Wait for workflow completion, use HTTP Response node output

### Response Data Options
- **First Entry JSON**: Return first item's JSON data
- **First Entry Binary**: Return first item's binary data
- **All Entries**: Return all workflow output
- **No Data**: Return empty response

## Webhook Options

### 1. Allowed Origins (CORS)
Control which domains can make requests to your webhook.

```
Default: *
Example: https://example.com, https://app.example.com
```

- Use `*` to allow all origins
- Comma-separated list for multiple origins
- Blocks requests with 403 if origin not allowed

### 2. Binary Property
Name of the property where file upload data is stored.

```
Default: data
```

**Structure for multiple files:**
```json
{
  "binary": {
    "data": {
      "file1": {
        "data": "base64...",
        "mimeType": "image/png",
        "fileName": "photo.png",
        "fileSize": 12345
      },
      "file2": {
        "data": "base64...",
        "mimeType": "application/pdf",
        "fileName": "document.pdf",
        "fileSize": 67890
      }
    }
  }
}
```

**File Upload Details:**
- Supports multiple files with different field names
- Files are converted to base64 for efficient transfer
- Maximum file size: 50MB per file
- Maximum files: 20 files per request
- Field names become property names in the binary object

### 3. Ignore Bots
Automatically reject requests from bots and crawlers.

```
Default: false
```

Detects common bot user agents:
- Link previewers (Slack, Discord, Twitter, etc.)
- Search engine crawlers (Googlebot, Bingbot, etc.)
- Monitoring tools (UptimeRobot, Pingdom, etc.)

Returns 403 status code for bot requests.

### 4. IP(s) Whitelist
Restrict webhook access to specific IP addresses or ranges.

```
Default: "" (allow all)
Example: 192.168.1.1, 10.0.0.0/8, 172.16.0.0/12
```

- Comma-separated list of IPs or CIDR ranges
- Returns 403 for non-whitelisted IPs
- Leave blank to allow all IPs

### 5. No Response Body
Send only status code and headers, no response body.

```
Default: false
```

Useful for webhooks that don't need response data.

### 6. Raw Body
Receive request body as raw string instead of parsed JSON.

```
Default: false
```

Useful for:
- XML payloads
- Custom formats
- Signature verification

### 7. Response Content-Type
Set the Content-Type header for webhook responses.

```
Default: application/json
Options: JSON, Text, HTML, XML, Custom
```

### 8. Response Headers
Add custom headers to webhook responses.

```
Example:
  X-Custom-Header: custom-value
  X-Rate-Limit: 100
```

### 9. Property Name
Return only a specific property from the response data.

```
Example: data.result
Example: items[0]
```

Uses dot notation and array indexing to extract nested properties.

## Data Inclusion Options

Control what data is included in the webhook output:

- **Include Headers**: Include HTTP request headers
- **Specific Headers**: Filter to specific headers (comma-separated)
- **Include Query Parameters**: Include URL query parameters
- **Include Body**: Include request body
- **Include Path**: Include request path
- **Include Client Info**: Include IP address and user agent

## Implementation Details

### File Upload Flow

1. **Request arrives** at `/webhook/:webhookId`
2. **webhookBodyParser middleware** detects multipart/form-data
3. **Multer processes** files with `upload.any()` (accepts any field names)
4. **Files stored** in `req.binaryData` as array
5. **buildWebhookRequest** converts to object with field names as keys
6. **Binary data converted** to base64 for efficient transfer
7. **WebhookTrigger node** wraps files under `binaryProperty` name

### Middleware Order

```
1. webhookBodyParser (handles multipart uploads)
2. express.json() (handles JSON bodies)
3. webhook route handler
```

### Path Parameter Matching

Supports Express-style path parameters:

```
/users/:userId          → matches /users/123
/orders/:orderId/items  → matches /orders/456/items
```

Parameters are available in `output.params`:

```json
{
  "params": {
    "userId": "123"
  }
}
```

## Testing

Test files are located in `backend/tests/`:

- `test-file-upload.js` - Single file upload test
- `test-multiple-files.js` - Multiple files upload test
- `test-webhook-cors.js` - CORS functionality test
- `test-webhook-simple.js` - Basic webhook test
- `test-middleware.js` - Middleware behavior test

### Testing with Insomnia/Postman

1. Create a workflow with Webhook Trigger node
2. Copy the test webhook URL
3. Send POST request with:
   - Headers: `Content-Type: multipart/form-data`
   - Body: Add files with field names (file1, file2, document, etc.)
   - Query: Add `?test=true` to see execution in editor

### Testing with curl

```bash
# Single file
curl -X POST http://localhost:4000/webhook/test-webhook \
  -F "file=@photo.png" \
  -F "name=John"

# Multiple files
curl -X POST http://localhost:4000/webhook/test-webhook \
  -F "file1=@photo.png" \
  -F "file2=@document.pdf" \
  -F "avatar=@profile.jpg"
```

## Configuration Limits

```javascript
{
  fileSize: 50 * 1024 * 1024,  // 50MB per file
  files: 20,                    // Max 20 files
  fields: 50,                   // Max 50 form fields
  timeout: 30000                // 30 second timeout
}
```

## Error Handling

The webhook returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid data, file upload error)
- `401` - Unauthorized (authentication failed)
- `403` - Forbidden (CORS, IP whitelist, bot detection)
- `404` - Not found (webhook doesn't exist)
- `405` - Method not allowed (wrong HTTP method)
- `500` - Internal server error

## Security Best Practices

1. **Use Authentication**: Always enable authentication for production webhooks
2. **Whitelist IPs**: Restrict access to known IP addresses when possible
3. **Enable CORS**: Set specific allowed origins instead of `*`
4. **Ignore Bots**: Enable bot detection to prevent unwanted traffic
5. **Validate Input**: Always validate webhook data in subsequent nodes
6. **Rate Limiting**: Consider implementing rate limiting for public webhooks

## Related Files

- `WebhookTrigger.node.ts` - Node definition
- `webhook.ts` - Route handler
- `webhookBodyParser.ts` - Middleware for file uploads
- `webhookValidation.ts` - Validation middleware
- `TriggerService.ts` - Webhook trigger handling
- `FlowExecutionEngine.ts` - Workflow execution

## Changelog

### Latest Updates
- ✅ Multiple file upload support with any field names
- ✅ Base64 encoding for efficient binary data transfer
- ✅ Simplified binary data structure
- ✅ Fixed memory issues with large files
- ✅ Improved middleware order and processing
- ✅ Added comprehensive webhook options (n8n-style)
