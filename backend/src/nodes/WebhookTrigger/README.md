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

The Webhook Trigger supports Express-style path parameters (also called URL attributes or route parameters) that allow you to capture dynamic values from the URL path.

#### How to Define Path Parameters

Path parameters are defined in the webhook URL using a colon (`:`) prefix:

```
/users/:userId                    → matches /users/123
/orders/:orderId/items            → matches /orders/456/items
/api/:version/users/:userId       → matches /api/v1/users/789
/posts/:postId/comments/:commentId → matches /posts/42/comments/99
```

#### How to Access Path Parameters

When a webhook is triggered, path parameters are automatically extracted and made available in the `params` object of the webhook output:

**Example 1: Single Parameter**
```
Webhook URL: /users/:userId
Request: GET /webhook/test-webhook/users/123

Output:
{
  "params": {
    "userId": "123"
  },
  "method": "GET",
  "path": "/webhook/test-webhook/users/123",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

**Example 2: Multiple Parameters**
```
Webhook URL: /orders/:orderId/items/:itemId
Request: GET /webhook/test-webhook/orders/456/items/789

Output:
{
  "params": {
    "orderId": "456",
    "itemId": "789"
  },
  "method": "GET",
  "path": "/webhook/test-webhook/orders/456/items/789",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

**Example 3: With Query Parameters and Body**
```
Webhook URL: /api/:version/users/:userId
Request: POST /webhook/test-webhook/api/v2/users/123?format=json
Body: { "name": "John Doe" }

Output:
{
  "params": {
    "version": "v2",
    "userId": "123"
  },
  "query": {
    "format": "json"
  },
  "body": {
    "name": "John Doe"
  },
  "method": "POST",
  "path": "/webhook/test-webhook/api/v2/users/123",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

#### Using Path Parameters in Workflows

Access path parameters in subsequent nodes using expressions:

```javascript
// Get userId from params
{{ $json.params.userId }}

// Use in HTTP Request node URL
https://api.example.com/users/{{ $json.params.userId }}

// Use in conditional logic
{{ $json.params.version === 'v2' }}

// Combine with other data
{{ $json.params.orderId }}-{{ $json.body.status }}
```

#### Path Parameter Rules

1. **Parameter names** must start with a colon (`:`)
2. **Parameter names** can contain letters, numbers, and underscores
3. **Parameters are always strings** - convert to numbers if needed
4. **Parameters are required** - the URL won't match without them
5. **Parameters cannot contain slashes** - use multiple parameters instead

#### Common Use Cases

**RESTful APIs:**
```
GET    /users/:userId           → Get user by ID
POST   /users/:userId/posts     → Create post for user
PUT    /posts/:postId           → Update post
DELETE /posts/:postId           → Delete post
```

**Versioned APIs:**
```
/api/:version/resource/:id
/v:version/users/:userId
```

**Nested Resources:**
```
/organizations/:orgId/teams/:teamId/members/:memberId
/projects/:projectId/tasks/:taskId/comments/:commentId
```

**Multi-tenant Applications:**
```
/:tenantId/api/users/:userId
/tenant/:tenantId/workspace/:workspaceId
```

#### Testing Path Parameters

**Using curl:**
```bash
# Single parameter
curl http://localhost:4000/webhook/test-webhook/users/123

# Multiple parameters
curl http://localhost:4000/webhook/test-webhook/orders/456/items/789

# With query and body
curl -X POST http://localhost:4000/webhook/test-webhook/api/v2/users/123?format=json \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

**Using Postman/Insomnia:**
1. Set the URL with actual values: `http://localhost:4000/webhook/test-webhook/users/123`
2. The webhook will extract `userId: "123"` automatically
3. Check the response or workflow output for the `params` object

#### Important Notes

- Path parameters are **separate from query parameters** (`?key=value`)
- Path parameters are **part of the URL path**, not the query string
- The webhook URL pattern is defined when you create the webhook
- The actual values are extracted when the webhook is called
- All path parameters are **URL-decoded** automatically (e.g., `%20` becomes space)

## Query Parameters (Search Filters)

Query parameters (also called query strings or search filters) allow you to pass additional data to your webhook through the URL. They're perfect for filtering, sorting, pagination, and optional parameters.

### How Query Parameters Work

Query parameters are added to the URL after a `?` symbol, with multiple parameters separated by `&`:

```
Basic syntax:
/webhook/my-webhook?key=value

Multiple parameters:
/webhook/my-webhook?search=john&status=active&page=1

With path parameters:
/webhook/my-webhook/users/123?include=posts&limit=10
```

### Accessing Query Parameters

Query parameters are automatically parsed and available in the `query` object of the webhook output:

**Example 1: Simple Search Filter**
```
Request: GET /webhook/my-webhook?search=john&status=active

Output:
{
  "query": {
    "search": "john",
    "status": "active"
  },
  "method": "GET",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

**Example 2: Pagination and Sorting**
```
Request: GET /webhook/my-webhook?page=2&limit=20&sort=createdAt&order=desc

Output:
{
  "query": {
    "page": "2",
    "limit": "20",
    "sort": "createdAt",
    "order": "desc"
  },
  "method": "GET",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

**Example 3: Array Parameters**
```
Request: GET /webhook/my-webhook?tags=javascript&tags=nodejs&tags=api

Output:
{
  "query": {
    "tags": ["javascript", "nodejs", "api"]
  },
  "method": "GET",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

**Example 4: Combined with Path Parameters and Body**
```
Request: POST /webhook/my-webhook/users/123?notify=true&format=json
Body: { "name": "John Doe", "email": "john@example.com" }

Output:
{
  "params": {
    "userId": "123"
  },
  "query": {
    "notify": "true",
    "format": "json"
  },
  "body": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "method": "POST",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

### Using Query Parameters in Workflows

Access query parameters in subsequent nodes using expressions:

```javascript
// Get single parameter
{{ $json.query.search }}

// Use in conditional logic
{{ $json.query.status === 'active' }}

// Convert to number for pagination
{{ parseInt($json.query.page) }}
{{ parseInt($json.query.limit) }}

// Check if parameter exists
{{ $json.query.notify === 'true' }}

// Access array parameters
{{ $json.query.tags[0] }}
{{ $json.query.tags.length }}

// Build database query
{
  "search": "{{ $json.query.search }}",
  "status": "{{ $json.query.status }}",
  "limit": {{ parseInt($json.query.limit) || 10 }}
}
```

### Common Search Filter Patterns

#### 1. Text Search
```
?search=keyword
?q=search+term
?query=user+name
```

**Usage in workflow:**
```javascript
// Filter users by search term
{{ $json.query.search }}

// Use in database query
SELECT * FROM users WHERE name LIKE '%{{ $json.query.search }}%'
```

#### 2. Filtering by Status/Category
```
?status=active
?category=electronics
?type=premium
?role=admin
```

**Usage in workflow:**
```javascript
// Filter by status
{{ $json.query.status }}

// Multiple filters
{
  "status": "{{ $json.query.status }}",
  "category": "{{ $json.query.category }}"
}
```

#### 3. Pagination
```
?page=1&limit=20
?offset=0&limit=50
?skip=10&take=25
```

**Usage in workflow:**
```javascript
// Calculate offset
{{ (parseInt($json.query.page) - 1) * parseInt($json.query.limit) }}

// Use in database query
{
  "skip": {{ parseInt($json.query.offset) || 0 }},
  "take": {{ parseInt($json.query.limit) || 10 }}
}
```

#### 4. Sorting
```
?sort=createdAt&order=desc
?orderBy=name&direction=asc
?sortBy=price&sortOrder=desc
```

**Usage in workflow:**
```javascript
// Build sort object
{
  "orderBy": {
    "{{ $json.query.sort }}": "{{ $json.query.order }}"
  }
}
```

#### 5. Date Range Filtering
```
?startDate=2024-01-01&endDate=2024-12-31
?from=2024-01-01&to=2024-12-31
?createdAfter=2024-01-01&createdBefore=2024-12-31
```

**Usage in workflow:**
```javascript
// Date range filter
{
  "createdAt": {
    "gte": "{{ $json.query.startDate }}",
    "lte": "{{ $json.query.endDate }}"
  }
}
```

#### 6. Boolean Flags
```
?active=true
?verified=false
?includeDeleted=true
?notify=true
```

**Usage in workflow:**
```javascript
// Convert string to boolean
{{ $json.query.active === 'true' }}
{{ $json.query.verified !== 'false' }}

// Use in conditional
{{ $json.query.notify === 'true' ? 'Send notification' : 'Skip notification' }}
```

#### 7. Multiple Values (Arrays)
```
?tags=javascript&tags=nodejs
?ids=1&ids=2&ids=3
?categories=tech&categories=news
```

**Usage in workflow:**
```javascript
// Access array
{{ $json.query.tags }}

// Check if array contains value
{{ $json.query.tags.includes('javascript') }}

// Join array for SQL IN clause
{{ $json.query.ids.join(',') }}
```

#### 8. Field Selection
```
?fields=name,email,phone
?include=posts,comments
?select=id,title,author
```

**Usage in workflow:**
```javascript
// Split comma-separated fields
{{ $json.query.fields.split(',') }}

// Use in database query
{
  "select": {{ $json.query.fields.split(',') }}
}
```

### Advanced Query Parameter Techniques

#### Default Values
```javascript
// Provide default if parameter is missing
{{ $json.query.limit || '10' }}
{{ $json.query.page || '1' }}
{{ $json.query.sort || 'createdAt' }}
```

#### Type Conversion
```javascript
// String to number
{{ parseInt($json.query.page) }}
{{ parseFloat($json.query.price) }}

// String to boolean
{{ $json.query.active === 'true' }}

// String to array
{{ $json.query.fields.split(',') }}
```

#### Validation
```javascript
// Check if parameter exists
{{ $json.query.search ? 'Search: ' + $json.query.search : 'No search' }}

// Validate number range
{{ Math.min(Math.max(parseInt($json.query.limit), 1), 100) }}

// Validate enum values
{{ ['active', 'inactive', 'pending'].includes($json.query.status) ? $json.query.status : 'active' }}
```

### Testing Query Parameters

**Using curl:**
```bash
# Simple query
curl "http://localhost:4000/webhook/my-webhook?search=john&status=active"

# Pagination
curl "http://localhost:4000/webhook/my-webhook?page=2&limit=20"

# Array parameters
curl "http://localhost:4000/webhook/my-webhook?tags=javascript&tags=nodejs"

# URL encoding (spaces and special characters)
curl "http://localhost:4000/webhook/my-webhook?search=john%20doe&email=test%40example.com"

# Combined with POST body
curl -X POST "http://localhost:4000/webhook/my-webhook?notify=true" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

**Using Postman/Insomnia:**
1. Enter the base URL: `http://localhost:4000/webhook/my-webhook`
2. Go to the "Params" tab
3. Add key-value pairs:
   - `search` = `john`
   - `status` = `active`
   - `page` = `1`
4. The tool will automatically build the URL with `?` and `&`

**Using JavaScript/Fetch:**
```javascript
// Build URL with query parameters
const params = new URLSearchParams({
  search: 'john',
  status: 'active',
  page: '1',
  limit: '20'
});

fetch(`http://localhost:4000/webhook/my-webhook?${params}`)
  .then(response => response.json())
  .then(data => console.log(data));

// With array parameters
const params = new URLSearchParams();
params.append('tags', 'javascript');
params.append('tags', 'nodejs');
params.append('tags', 'api');

fetch(`http://localhost:4000/webhook/my-webhook?${params}`)
  .then(response => response.json())
  .then(data => console.log(data));
```

### Query Parameter Best Practices

1. **Use descriptive names**: `?search=` instead of `?q=`, `?limit=` instead of `?l=`
2. **Be consistent**: Use the same parameter names across all endpoints
3. **Provide defaults**: Handle missing parameters gracefully with default values
4. **Validate input**: Always validate and sanitize query parameters
5. **Document parameters**: List all supported parameters and their formats
6. **Use standard conventions**:
   - Pagination: `page`, `limit`, `offset`
   - Sorting: `sort`, `order`, `orderBy`
   - Search: `search`, `q`, `query`
7. **URL encode special characters**: Spaces become `%20`, `@` becomes `%40`, etc.
8. **Keep URLs under 2000 characters**: Use POST body for large data
9. **Use arrays for multiple values**: `?tags=a&tags=b` instead of `?tags=a,b`
10. **Consider security**: Don't pass sensitive data in query parameters (use headers or body)

### Query Parameters vs Path Parameters vs Body

| Feature | Query Parameters | Path Parameters | Request Body |
|---------|-----------------|-----------------|--------------|
| **Location** | After `?` in URL | Part of URL path | HTTP body |
| **Purpose** | Optional filters, search, pagination | Required resource identifiers | Main data payload |
| **Example** | `?search=john&page=1` | `/users/123` | `{"name": "John"}` |
| **When to use** | Filtering, sorting, options | Resource IDs, required params | Creating/updating data |
| **Visibility** | Visible in URL, logged | Visible in URL, logged | Not visible in URL |
| **Caching** | Affects caching | Affects caching | Doesn't affect caching |
| **HTTP Methods** | GET, POST, PUT, DELETE | GET, POST, PUT, DELETE | POST, PUT, PATCH |

### Real-World Examples

**E-commerce Product Search:**
```
GET /webhook/products?search=laptop&category=electronics&minPrice=500&maxPrice=2000&sort=price&order=asc&page=1&limit=20

Access in workflow:
{
  "search": "{{ $json.query.search }}",
  "category": "{{ $json.query.category }}",
  "price": {
    "gte": {{ parseInt($json.query.minPrice) }},
    "lte": {{ parseInt($json.query.maxPrice) }}
  },
  "orderBy": {
    "{{ $json.query.sort }}": "{{ $json.query.order }}"
  },
  "skip": {{ (parseInt($json.query.page) - 1) * parseInt($json.query.limit) }},
  "take": {{ parseInt($json.query.limit) }}
}
```

**User Management API:**
```
GET /webhook/users?role=admin&status=active&verified=true&search=john&fields=id,name,email

Access in workflow:
{
  "where": {
    "role": "{{ $json.query.role }}",
    "status": "{{ $json.query.status }}",
    "verified": {{ $json.query.verified === 'true' }},
    "name": {
      "contains": "{{ $json.query.search }}"
    }
  },
  "select": {{ $json.query.fields.split(',') }}
}
```

**Analytics Dashboard:**
```
GET /webhook/analytics?startDate=2024-01-01&endDate=2024-12-31&metrics=views,clicks,conversions&groupBy=day

Access in workflow:
{
  "dateRange": {
    "start": "{{ $json.query.startDate }}",
    "end": "{{ $json.query.endDate }}"
  },
  "metrics": {{ $json.query.metrics.split(',') }},
  "groupBy": "{{ $json.query.groupBy }}"
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
