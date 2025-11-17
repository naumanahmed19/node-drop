# AI Features Quick Reference

## 🚀 Quick Start

### Using OpenAI Node with Memory

```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful assistant",
  "userMessage": "{{json.message}}",
  "enableMemory": true,
  "sessionId": "user-{{json.userId}}"
}
```

### Advanced Options

```json
{
  "options": {
    "temperature": 0.7,
    "topP": 0.95,
    "frequencyPenalty": 0.5,
    "presencePenalty": 0.6,
    "maxRetries": 3,
    "timeout": 30000
  }
}
```

---

## 📡 API Endpoints

### Get Conversation
```bash
GET /api/ai-memory/conversations/:sessionId
```

### List Sessions
```bash
GET /api/ai-memory/conversations
```

### Clear Conversation
```bash
DELETE /api/ai-memory/conversations/:sessionId
```

### Get Stats
```bash
GET /api/ai-memory/stats
```

---

## 💡 Common Use Cases

### Customer Support Bot
```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a customer support agent",
  "temperature": 0.7,
  "enableMemory": true,
  "sessionId": "support-{{json.ticketId}}",
  "options": {
    "frequencyPenalty": 0.3,
    "presencePenalty": 0.3
  }
}
```

### Data Extraction (JSON Mode)
```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "Extract data as JSON: {name, email, phone}",
  "jsonMode": true,
  "temperature": 0.2
}
```

### Creative Writing
```json
{
  "model": "gpt-4o",
  "temperature": 0.9,
  "options": {
    "topP": 0.95,
    "presencePenalty": 0.8
  }
}
```

### Deterministic Output
```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.0,
  "options": {
    "seed": 12345
  }
}
```

---

## 🎯 Parameter Guidelines

### Temperature
- **0.0-0.3**: Factual, deterministic
- **0.4-0.7**: Balanced
- **0.8-1.0**: Creative, varied

### Penalties
- **Frequency**: Reduce repetition (0.5-1.0)
- **Presence**: Encourage new topics (0.5-1.0)

### Models
- **gpt-4o-mini**: Fast, cheap, good for most tasks
- **gpt-4o**: Best quality, vision support
- **gpt-4-turbo**: High quality, large context
- **gpt-3.5-turbo**: Legacy, very cheap

---

## 🔧 Configuration

### Environment Variables
```env
REDIS_URL=redis://localhost:6379
```

### Memory Limits
- Max messages: 50 per conversation
- TTL: 24 hours
- Auto-cleanup: Every hour

---

## 📊 Cost Optimization

1. Use **gpt-4o-mini** for simple tasks
2. Set reasonable **maxTokens** limits
3. Clear old conversations regularly
4. Monitor usage via response data

---

## 🐛 Troubleshooting

### Redis Not Connected
```
MemoryManager: Redis unavailable, falling back to in-memory storage
```
**Solution:** Check Redis is running, verify REDIS_URL

### Memory Not Persisting
**Check:**
- `enableMemory: true`
- Same `sessionId` used
- Redis connected

### High Costs
**Solutions:**
- Switch to gpt-4o-mini
- Reduce maxTokens
- Use more specific prompts

---

## 📖 Full Documentation

- [AI Memory API](./AI_MEMORY_API.md)
- [OpenAI Node Guide](./OPENAI_NODE_GUIDE.md)
- [Improvements Summary](../../OPENAI_IMPROVEMENTS.md)
