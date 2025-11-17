# OpenAI Node Developer Guide

## Overview

The OpenAI node provides integration with OpenAI's GPT models, supporting conversation memory, advanced parameters, and template expressions.

---

## Features

### Core Features
- ✅ Multiple GPT models (GPT-4o, GPT-4 Turbo, GPT-3.5)
- ✅ Conversation memory with Redis persistence
- ✅ Template expressions in messages (`{{json.field}}`)
- ✅ JSON mode for structured outputs
- ✅ Cost estimation per request
- ✅ Automatic retry logic

### Advanced Options
- ✅ Temperature control
- ✅ Top P (nucleus sampling)
- ✅ Frequency penalty (reduce repetition)
- ✅ Presence penalty (encourage new topics)
- ✅ Stop sequences
- ✅ Seed (for reproducible outputs)
- ✅ User identifier (for abuse monitoring)
- ✅ Configurable timeout and retries

---

## Basic Usage

### Simple Request

```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful assistant.",
  "userMessage": "What is the capital of France?",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### With Template Expressions

Use template expressions to reference data from previous nodes:

```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a customer support agent.",
  "userMessage": "Help customer {{json.customerName}} with issue: {{json.issue}}",
  "temperature": 0.7
}
```

**Input data:**
```json
{
  "customerName": "John Doe",
  "issue": "Cannot login to account"
}
```

**Resolved message:**
```
Help customer John Doe with issue: Cannot login to account
```

---

## Conversation Memory

Enable conversation memory to maintain context across multiple executions.

### Configuration

```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful assistant.",
  "userMessage": "{{json.message}}",
  "enableMemory": true,
  "sessionId": "user-123-chat"
}
```

### How It Works

1. **First message**: System prompt is added to conversation
2. **Subsequent messages**: Full conversation history is included
3. **Persistence**: Conversations stored in Redis (24-hour TTL)
4. **Pruning**: Automatically keeps last 50 messages + system message

### Session ID Best Practices

Use descriptive, unique session IDs:
- ✅ `user-{userId}-{chatType}` - e.g., `user-123-support`
- ✅ `session-{workflowId}-{timestamp}` - e.g., `session-abc-1700000000`
- ❌ `default` - Avoid using default for production

---

## Advanced Options

### Temperature & Top P

Control randomness and creativity:

```json
{
  "temperature": 0.9,
  "options": {
    "topP": 0.95
  }
}
```

**Guidelines:**
- **Low temperature (0.0-0.3)**: Focused, deterministic responses
- **Medium temperature (0.4-0.7)**: Balanced responses
- **High temperature (0.8-1.0)**: Creative, varied responses

### Frequency & Presence Penalties

Reduce repetition and encourage new topics:

```json
{
  "options": {
    "frequencyPenalty": 0.5,
    "presencePenalty": 0.6
  }
}
```

**Frequency Penalty** (-2.0 to 2.0):
- Penalizes tokens based on how often they appear
- Higher values reduce repetition
- Use for: Lists, summaries, creative writing

**Presence Penalty** (-2.0 to 2.0):
- Penalizes tokens based on whether they've appeared
- Higher values encourage new topics
- Use for: Brainstorming, exploration, diverse responses

### Stop Sequences

Define custom stop sequences (max 4):

```json
{
  "options": {
    "stop": "END, ---, \\n\\n\\n"
  }
}
```

**Use cases:**
- Stop at specific markers
- Prevent overly long responses
- Control output format

### Seed for Reproducibility

Use a seed for deterministic outputs:

```json
{
  "options": {
    "seed": 12345
  }
}
```

**Note:** Same seed + same inputs = same output (mostly)

### Timeout & Retries

Configure request timeout and retry behavior:

```json
{
  "options": {
    "timeout": 30000,
    "maxRetries": 3
  }
}
```

**Defaults:**
- Timeout: 60000ms (60 seconds)
- Max retries: 2

---

## JSON Mode

Enable JSON mode for structured outputs:

```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "Extract user information as JSON with fields: name, email, age",
  "userMessage": "My name is John Doe, email is john@example.com, and I'm 30 years old",
  "jsonMode": true
}
```

**Response:**
```json
{
  "response": "{\"name\":\"John Doe\",\"email\":\"john@example.com\",\"age\":30}",
  "model": "gpt-4o-mini",
  "usage": {...}
}
```

**Requirements:**
- Only works with GPT-4 Turbo and newer models
- Must instruct the model to output JSON in the system prompt
- Response will be a JSON string (parse it in your workflow)

---

## Cost Estimation

Every response includes cost estimation:

```json
{
  "response": "...",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 200,
    "totalTokens": 350,
    "estimatedCost": 0.000105
  }
}
```

**Cost Calculation:**
```
cost = (promptTokens / 1000) × inputPrice + (completionTokens / 1000) × outputPrice
```

**Model Pricing (as of implementation):**
- GPT-4o: $0.0025 / $0.01 per 1K tokens
- GPT-4o Mini: $0.00015 / $0.0006 per 1K tokens
- GPT-4 Turbo: $0.01 / $0.03 per 1K tokens
- GPT-4: $0.03 / $0.06 per 1K tokens
- GPT-3.5 Turbo: $0.0005 / $0.0015 per 1K tokens

---

## Error Handling

### Common Errors

**Invalid API Key:**
```json
{
  "error": "Invalid OpenAI API key. Please check your credentials."
}
```

**Rate Limit:**
```json
{
  "error": "OpenAI rate limit exceeded. Please try again later."
}
```

**Service Error:**
```json
{
  "error": "OpenAI service error. Please try again later."
}
```

### Retry Logic

The node automatically retries failed requests with exponential backoff:
- Retry 1: Immediate
- Retry 2: After ~1 second
- Retry 3: After ~2 seconds

Configure retries in options:
```json
{
  "options": {
    "maxRetries": 3
  }
}
```

---

## Complete Example

### Workflow: Customer Support Chatbot

**Node Configuration:**
```json
{
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful customer support agent for TechCorp. Be professional, empathetic, and concise. Always offer to escalate complex issues.",
  "userMessage": "{{json.message}}",
  "temperature": 0.7,
  "maxTokens": 500,
  "enableMemory": true,
  "sessionId": "customer-{{json.customerId}}",
  "options": {
    "frequencyPenalty": 0.3,
    "presencePenalty": 0.3,
    "stop": "\\n\\n\\n",
    "timeout": 30000,
    "maxRetries": 2
  }
}
```

**Input Data:**
```json
{
  "customerId": "12345",
  "message": "I can't access my account",
  "customerName": "Jane Smith",
  "accountType": "Premium"
}
```

**Output:**
```json
{
  "response": "I'm sorry to hear you're having trouble accessing your account, Jane. Let me help you with that...",
  "model": "gpt-4o-mini",
  "usage": {
    "promptTokens": 85,
    "completionTokens": 120,
    "totalTokens": 205,
    "estimatedCost": 0.000085
  },
  "sessionId": "customer-12345",
  "conversationLength": 3
}
```

---

## Best Practices

### 1. System Prompts

**Good:**
```
You are a professional email writer. Write concise, friendly emails with proper formatting. Always include a subject line.
```

**Bad:**
```
Write emails
```

### 2. Temperature Selection

- **Factual tasks** (0.0-0.3): Summaries, translations, data extraction
- **Balanced tasks** (0.4-0.7): Customer support, Q&A, general chat
- **Creative tasks** (0.8-1.0): Story writing, brainstorming, poetry

### 3. Token Management

- Monitor `totalTokens` in responses
- Set appropriate `maxTokens` limits
- Use conversation memory pruning (automatic)
- Clear old sessions regularly

### 4. Cost Optimization

- Use GPT-4o Mini for simple tasks
- Reserve GPT-4 for complex reasoning
- Set reasonable `maxTokens` limits
- Monitor costs via usage data

### 5. Error Handling

- Always handle errors in your workflow
- Implement fallback logic for rate limits
- Log errors for debugging
- Use retry logic appropriately

---

## Troubleshooting

### Issue: Conversation not persisting

**Check:**
1. Is `enableMemory` set to `true`?
2. Is Redis running? Check logs for connection errors
3. Is the same `sessionId` being used?

### Issue: Responses are too random

**Solution:**
- Lower `temperature` (try 0.3-0.5)
- Lower `topP` (try 0.8-0.9)
- Add more specific instructions in system prompt

### Issue: Responses are repetitive

**Solution:**
- Increase `frequencyPenalty` (try 0.5-1.0)
- Increase `presencePenalty` (try 0.5-1.0)
- Vary your prompts

### Issue: High costs

**Solution:**
- Switch to GPT-4o Mini for simple tasks
- Reduce `maxTokens`
- Clear old conversations
- Use more specific prompts (fewer tokens needed)

---

## API Reference

### Node Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | options | Yes | gpt-4o-mini | The OpenAI model to use |
| `systemPrompt` | string | No | "You are a helpful AI assistant." | System instructions |
| `userMessage` | string | Yes | - | User message (supports templates) |
| `temperature` | number | No | 0.7 | Randomness (0.0-1.0) |
| `maxTokens` | number | No | 1000 | Max response tokens |
| `enableMemory` | boolean | No | false | Enable conversation memory |
| `sessionId` | string | No | "default" | Session identifier |
| `jsonMode` | boolean | No | false | Enable JSON output mode |

### Advanced Options

| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `topP` | number | 1 | 0.0-1.0 | Nucleus sampling |
| `frequencyPenalty` | number | 0 | -2.0 to 2.0 | Reduce repetition |
| `presencePenalty` | number | 0 | -2.0 to 2.0 | Encourage new topics |
| `stop` | string | - | - | Stop sequences (comma-separated) |
| `seed` | number | - | - | Random seed |
| `user` | string | - | - | User identifier |
| `timeout` | number | 60000 | - | Request timeout (ms) |
| `maxRetries` | number | 2 | 0-10 | Max retry attempts |

---

## Related Documentation

- [AI Memory Management API](./AI_MEMORY_API.md)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Redis Configuration](../config/redis.ts)
- [MemoryManager Source](../utils/ai/MemoryManager.ts)
