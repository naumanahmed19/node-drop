# AI Memory Management API Documentation

## Overview

The AI Memory Management API provides endpoints for managing conversation history used by AI nodes (OpenAI, Anthropic, etc.). Conversations are stored in Redis with automatic fallback to in-memory storage.

**Base URL:** `/api/ai-memory`

**Authentication:** All endpoints require JWT authentication via Bearer token.

---

## Endpoints

### 1. Get Conversation Memory

Retrieve the complete conversation history for a specific session.

**Endpoint:** `GET /api/ai-memory/conversations/:sessionId`

**Parameters:**
- `sessionId` (path, required): Unique identifier for the conversation session

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "user-123-chat",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant",
        "timestamp": 1700000000000
      },
      {
        "role": "user",
        "content": "Hello!",
        "timestamp": 1700000001000
      },
      {
        "role": "assistant",
        "content": "Hi! How can I help you today?",
        "timestamp": 1700000002000
      }
    ],
    "createdAt": 1700000000000,
    "updatedAt": 1700000002000
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations/user-123-chat
```

---

### 2. List Active Sessions

Get a list of all active conversation session IDs.

**Endpoint:** `GET /api/ai-memory/conversations`

**Response:**
```json
{
  "success": true,
  "data": [
    "user-123-chat",
    "session-456",
    "customer-789"
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations
```

---

### 3. Clear Conversation

Delete all conversation history for a specific session. This action cannot be undone.

**Endpoint:** `DELETE /api/ai-memory/conversations/:sessionId`

**Parameters:**
- `sessionId` (path, required): Unique identifier for the conversation session

**Response:**
```json
{
  "success": true,
  "message": "Conversation user-123-chat cleared"
}
```

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations/user-123-chat
```

---

### 4. Get Memory Statistics

Retrieve statistics about memory usage across all conversations.

**Endpoint:** `GET /api/ai-memory/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "activeConversations": 42,
    "totalMessages": 1337,
    "averageMessagesPerConversation": 32,
    "usingRedis": true
  }
}
```

**Fields:**
- `activeConversations`: Total number of active conversation sessions
- `totalMessages`: Total messages across all conversations
- `averageMessagesPerConversation`: Average number of messages per session
- `usingRedis`: Whether Redis is currently being used for persistence

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4000/api/ai-memory/stats
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `401` - Unauthorized (missing or invalid JWT token)
- `404` - Session not found
- `500` - Internal server error

---

## Data Models

### ConversationMemory

```typescript
interface ConversationMemory {
  sessionId: string;           // Unique session identifier
  messages: AIMessage[];       // Array of conversation messages
  createdAt: number;          // Unix timestamp (ms)
  updatedAt: number;          // Unix timestamp (ms)
}
```

### AIMessage

```typescript
interface AIMessage {
  role: "system" | "user" | "assistant";  // Message role
  content: string;                         // Message content
  timestamp?: number;                      // Unix timestamp (ms)
}
```

---

## Usage Examples

### Node.js / JavaScript

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:4000/api/ai-memory';
const TOKEN = 'your-jwt-token';

// Get conversation
async function getConversation(sessionId) {
  const response = await axios.get(
    `${API_URL}/conversations/${sessionId}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  return response.data;
}

// List all sessions
async function listSessions() {
  const response = await axios.get(
    `${API_URL}/conversations`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  return response.data;
}

// Clear conversation
async function clearConversation(sessionId) {
  const response = await axios.delete(
    `${API_URL}/conversations/${sessionId}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  return response.data;
}

// Get stats
async function getStats() {
  const response = await axios.get(
    `${API_URL}/stats`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  return response.data;
}
```

### Python

```python
import requests

API_URL = 'http://localhost:4000/api/ai-memory'
TOKEN = 'your-jwt-token'
HEADERS = {'Authorization': f'Bearer {TOKEN}'}

# Get conversation
def get_conversation(session_id):
    response = requests.get(
        f'{API_URL}/conversations/{session_id}',
        headers=HEADERS
    )
    return response.json()

# List all sessions
def list_sessions():
    response = requests.get(
        f'{API_URL}/conversations',
        headers=HEADERS
    )
    return response.json()

# Clear conversation
def clear_conversation(session_id):
    response = requests.delete(
        f'{API_URL}/conversations/{session_id}',
        headers=HEADERS
    )
    return response.json()

# Get stats
def get_stats():
    response = requests.get(
        f'{API_URL}/stats',
        headers=HEADERS
    )
    return response.json()
```

---

## Best Practices

### Session ID Naming

Use descriptive session IDs that help identify conversations:
- ✅ `user-123-support-chat`
- ✅ `customer-456-onboarding`
- ✅ `session-789-product-inquiry`
- ❌ `abc123` (too generic)

### Memory Management

1. **Clear old conversations**: Regularly clear conversations that are no longer needed
2. **Monitor stats**: Use the stats endpoint to track memory usage
3. **Use unique session IDs**: Avoid session ID collisions between different users

### Performance

1. **Batch operations**: If clearing multiple sessions, do it during off-peak hours
2. **Cache locally**: Cache conversation data in your application when possible
3. **Monitor Redis**: Keep an eye on Redis memory usage and connection health

---

## Configuration

### Environment Variables

```env
# Redis connection URL
REDIS_URL=redis://localhost:6379

# Optional: Redis password
REDIS_PASSWORD=your-password
```

### Memory Limits

- **Max messages per conversation**: 50 (automatically pruned)
- **Conversation TTL**: 24 hours (automatically cleaned up)
- **System messages**: Always preserved during pruning

---

## Troubleshooting

### Redis Connection Issues

If Redis is unavailable, the system automatically falls back to in-memory storage:

```
MemoryManager: Redis unavailable, falling back to in-memory storage
```

**Note:** In-memory storage is not persistent and will be lost on server restart.

### Session Not Found

If a session doesn't exist, the API will create a new empty session automatically.

### Memory Cleanup

Old conversations (>24 hours) are automatically cleaned up every hour. You can also manually clear conversations using the DELETE endpoint.

---

## Rate Limiting

Currently, there are no specific rate limits for these endpoints beyond the global API rate limits. However, it's recommended to:

- Avoid polling these endpoints too frequently
- Use webhooks or real-time updates when available
- Cache conversation data in your application

---

## Security

### Authentication

All endpoints require a valid JWT token. Include it in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Data Privacy

- Conversations are isolated by session ID
- Users can only access their own conversations (enforced by authentication)
- Conversations are automatically deleted after 24 hours of inactivity

### Best Practices

1. Never expose session IDs in URLs or logs
2. Use HTTPS in production
3. Rotate JWT tokens regularly
4. Clear sensitive conversations immediately after use
