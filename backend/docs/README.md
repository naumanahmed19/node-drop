# Backend Documentation

## AI Features Documentation

### Quick Start
- **[Quick Reference](./QUICK_REFERENCE.md)** - Cheat sheet for common tasks

### Comprehensive Guides
- **[OpenAI Node Guide](./OPENAI_NODE_GUIDE.md)** - Complete guide to using the OpenAI node
- **[AI Memory API](./AI_MEMORY_API.md)** - REST API documentation for conversation management

### Implementation Details
- **[Improvements Summary](../../OPENAI_IMPROVEMENTS.md)** - Technical changes and architecture

---

## What's New

### OpenAI Node Improvements
✅ Fixed parameter resolution (supports `{{json.field}}` templates)  
✅ Added Redis persistence for conversation memory  
✅ Added advanced options (top_p, penalties, seed, etc.)  
✅ Automatic retry logic with exponential backoff  
✅ Cost estimation per request  

### Memory Management
✅ Redis-backed conversation storage  
✅ Automatic fallback to in-memory  
✅ 24-hour TTL with auto-cleanup  
✅ REST API for conversation management  
✅ Support for distributed systems  

---

## Documentation Structure

```
backend/docs/
├── README.md                 # This file
├── QUICK_REFERENCE.md        # Quick reference guide
├── OPENAI_NODE_GUIDE.md      # OpenAI node documentation
└── AI_MEMORY_API.md          # Memory management API docs
```

---

## Getting Started

### 1. Read the Quick Reference
Start with [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for common patterns and examples.

### 2. Explore the OpenAI Node Guide
Read [OPENAI_NODE_GUIDE.md](./OPENAI_NODE_GUIDE.md) for detailed usage instructions.

### 3. Check the API Documentation
See [AI_MEMORY_API.md](./AI_MEMORY_API.md) for REST API endpoints.

---

## Key Features

### Conversation Memory
Maintain context across multiple AI interactions:
```json
{
  "enableMemory": true,
  "sessionId": "user-123-chat"
}
```

### Template Expressions
Reference data from previous nodes:
```json
{
  "userMessage": "Help {{json.customerName}} with {{json.issue}}"
}
```

### Advanced Parameters
Fine-tune AI behavior:
```json
{
  "options": {
    "temperature": 0.7,
    "frequencyPenalty": 0.5,
    "presencePenalty": 0.6,
    "seed": 12345
  }
}
```

### JSON Mode
Get structured outputs:
```json
{
  "jsonMode": true,
  "systemPrompt": "Extract as JSON: {name, email, age}"
}
```

---

## Examples

### Customer Support Chatbot
```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful customer support agent",
  "userMessage": "{{json.message}}",
  "enableMemory": true,
  "sessionId": "support-{{json.ticketId}}",
  "temperature": 0.7,
  "options": {
    "frequencyPenalty": 0.3,
    "presencePenalty": 0.3
  }
}
```

### Data Extraction
```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "Extract user info as JSON: {name, email, phone}",
  "userMessage": "{{json.text}}",
  "jsonMode": true,
  "temperature": 0.2
}
```

### Creative Writing
```json
{
  "model": "gpt-4o",
  "systemPrompt": "You are a creative writer",
  "userMessage": "Write a short story about {{json.topic}}",
  "temperature": 0.9,
  "options": {
    "topP": 0.95,
    "presencePenalty": 0.8
  }
}
```

---

## API Endpoints

### Memory Management

```bash
# Get conversation
GET /api/ai-memory/conversations/:sessionId

# List all sessions
GET /api/ai-memory/conversations

# Clear conversation
DELETE /api/ai-memory/conversations/:sessionId

# Get statistics
GET /api/ai-memory/stats
```

All endpoints require JWT authentication.

---

## Configuration

### Environment Variables
```env
# Redis connection
REDIS_URL=redis://localhost:6379

# Optional Redis password
REDIS_PASSWORD=your-password
```

### Memory Settings
- **Max messages per conversation**: 50
- **Conversation TTL**: 24 hours
- **Cleanup interval**: Every hour
- **System messages**: Always preserved

---

## Best Practices

### 1. Session IDs
Use descriptive, unique identifiers:
- ✅ `user-{userId}-{chatType}`
- ✅ `session-{workflowId}-{timestamp}`
- ❌ `default` (avoid in production)

### 2. Model Selection
- **gpt-4o-mini**: Most tasks (fast, cheap)
- **gpt-4o**: Complex reasoning, vision
- **gpt-4-turbo**: Large context needs
- **gpt-3.5-turbo**: Legacy, budget-constrained

### 3. Temperature
- **0.0-0.3**: Factual tasks
- **0.4-0.7**: Balanced responses
- **0.8-1.0**: Creative tasks

### 4. Cost Optimization
- Use gpt-4o-mini when possible
- Set reasonable maxTokens limits
- Clear old conversations
- Monitor usage data

---

## Troubleshooting

### Common Issues

**Memory not persisting**
- Check `enableMemory: true`
- Verify same `sessionId` used
- Ensure Redis is running

**High costs**
- Switch to gpt-4o-mini
- Reduce maxTokens
- Use specific prompts

**Responses too random**
- Lower temperature (0.3-0.5)
- Lower topP (0.8-0.9)
- Add specific instructions

**Repetitive responses**
- Increase frequencyPenalty (0.5-1.0)
- Increase presencePenalty (0.5-1.0)

---

## Source Code

### Key Files
- `backend/src/nodes/OpenAI/OpenAI.node.ts` - OpenAI node implementation
- `backend/src/utils/ai/MemoryManager.ts` - Memory management
- `backend/src/config/redis.ts` - Redis client
- `backend/src/routes/ai-memory.routes.ts` - API routes

### Tests
- `backend/src/__tests__/memory-manager.test.ts` - Unit tests

---

## Contributing

When adding new AI features:
1. Add JSDoc documentation
2. Update relevant guides
3. Add examples to Quick Reference
4. Write unit tests
5. Update this README

---

## Support

For issues or questions:
1. Check the troubleshooting sections
2. Review the full documentation
3. Check the source code comments
4. Open an issue on GitHub

---

## License

See main project LICENSE file.
