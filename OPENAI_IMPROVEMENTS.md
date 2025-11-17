# OpenAI Node & Memory Manager Improvements

## 📚 Documentation Added

All code now includes comprehensive JSDoc documentation:
- ✅ Module-level documentation
- ✅ Function/method documentation with parameters and return types
- ✅ Usage examples in JSDoc comments
- ✅ API endpoint documentation
- ✅ Developer guides

**Documentation Files:**
- `backend/docs/AI_MEMORY_API.md` - Complete API reference
- `backend/docs/OPENAI_NODE_GUIDE.md` - Developer guide with examples
- Inline JSDoc in all source files

## Summary of Changes

### 1. Fixed Parameter Resolution in OpenAI Node ✅

**Problem:** The OpenAI node was manually trying to extract messages from input data, which was inconsistent with other nodes and didn't properly support template expressions like `{{json.field}}`.

**Solution:** 
- Updated to use `this.resolveValue()`, `this.extractJsonData()`, and `this.normalizeInputItems()` helper methods
- Now properly resolves template expressions in user messages
- Consistent with Anthropic node implementation

**Files Changed:**
- `backend/src/nodes/OpenAI/OpenAI.node.ts`

### 2. Added Redis Persistence to MemoryManager ✅

**Problem:** MemoryManager was in-memory only, causing data loss on restart and no support for distributed systems.

**Solution:**
- Created Redis client configuration with automatic reconnection
- Updated MemoryManager to use Redis as primary storage with in-memory fallback
- All methods now async to support Redis operations
- Graceful degradation when Redis is unavailable

**Features:**
- ✅ Redis persistence with 24-hour TTL
- ✅ Automatic fallback to in-memory storage
- ✅ Reconnection strategy with exponential backoff
- ✅ Distributed system support (multiple backend instances share memory)
- ✅ Cleanup interval for old conversations

**Files Changed:**
- `backend/src/config/redis.ts` (new)
- `backend/src/utils/ai/MemoryManager.ts`
- `backend/src/nodes/OpenAI/OpenAI.node.ts`
- `backend/src/nodes/Anthropic/Anthropic.node.ts`

### 3. Added Advanced Options to OpenAI Node ✅

**Problem:** Missing advanced OpenAI parameters that users might need for fine-tuning responses.

**Solution:** Added "Options" collection with the following parameters:

**Advanced Options:**
- **Top P** (0.0-1.0): Nucleus sampling alternative to temperature
- **Frequency Penalty** (-2.0 to 2.0): Reduce repetition
- **Presence Penalty** (-2.0 to 2.0): Encourage new topics
- **Stop Sequences**: Up to 4 custom stop sequences
- **Seed**: For deterministic/reproducible outputs
- **User Identifier**: For abuse monitoring
- **Timeout**: Request timeout in milliseconds (default: 60000)
- **Max Retries**: Retry attempts for failed requests (default: 2)

**Files Changed:**
- `backend/src/nodes/OpenAI/OpenAI.node.ts`

### 4. Added AI Memory Management API ✅

**New Endpoints:**
- `GET /api/ai-memory/conversations` - List all active sessions
- `GET /api/ai-memory/conversations/:sessionId` - Get conversation memory
- `DELETE /api/ai-memory/conversations/:sessionId` - Clear conversation
- `GET /api/ai-memory/stats` - Get memory statistics

**Files Changed:**
- `backend/src/routes/ai-memory.routes.ts` (new)
- `backend/src/index.ts`

## Configuration

### Environment Variables

Ensure your `.env` file has:
```env
REDIS_URL=redis://localhost:6379
```

### Redis Setup

Redis is already configured in `docker-compose.yml`. If running locally:
```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Or use docker-compose
npm run docker:dev
```

## Usage Examples

### Using Advanced Options in OpenAI Node

```json
{
  "model": "gpt-4o-mini",
  "userMessage": "Write a creative story",
  "temperature": 0.9,
  "options": {
    "frequencyPenalty": 0.5,
    "presencePenalty": 0.6,
    "topP": 0.95,
    "seed": 12345,
    "maxRetries": 3,
    "timeout": 30000
  }
}
```

### Managing Conversations via API

```bash
# Get all active conversations
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations

# Get specific conversation
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations/user-123

# Clear conversation
curl -X DELETE -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/ai-memory/conversations/user-123

# Get memory stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/ai-memory/stats
```

## Benefits

1. **Reliability**: Conversations persist across server restarts
2. **Scalability**: Multiple backend instances can share conversation state
3. **Flexibility**: Advanced OpenAI parameters for fine-tuned control
4. **Consistency**: Parameter resolution works the same across all AI nodes
5. **Monitoring**: API endpoints to inspect and manage conversations
6. **Resilience**: Automatic fallback to in-memory when Redis unavailable

## Testing

1. Start the backend with Redis:
```bash
npm run docker:dev
```

2. Create a workflow with OpenAI node
3. Enable "Conversation Memory"
4. Set a session ID (e.g., "test-session")
5. Execute multiple times - conversation history persists
6. Restart backend - conversation still available
7. Check stats: `GET /api/ai-memory/stats`

## Next Steps (Future Improvements)

- [ ] Add streaming support for real-time responses
- [ ] Add function calling / tool use support
- [ ] Add vision support for GPT-4o (image inputs)
- [ ] Add token counting to prevent context overflow
- [ ] Add conversation summarization for long threads
- [ ] Add cost tracking and budgeting
- [ ] Add unit tests for AI nodes
- [ ] Add conversation export/import
- [ ] Add conversation branching
