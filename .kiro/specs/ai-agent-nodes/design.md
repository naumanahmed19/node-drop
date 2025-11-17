# AI Agent Nodes Design Document

## Overview

This document outlines the design for an AI Agent system built using a modular node architecture. The system enables users to create intelligent agents that can interact with various language models, maintain conversation memory, and execute tools to accomplish tasks. The architecture separates concerns into four primary node types: AI Agent (orchestrator), Model (provider abstraction), Memory (storage abstraction), and Tool (executable functions).

### Design Goals

- **Modularity**: Each component (Agent, Model, Memory, Tool) is independent and reusable
- **Provider Agnostic**: Support multiple AI providers (OpenAI, Anthropic, local models) through a unified interface
- **Extensibility**: Easy to add new models, memory strategies, and tools
- **Flexibility**: Users can mix and match components to create custom agent workflows
- **Reliability**: Robust error handling and graceful degradation
- **Observability**: Clear execution flow and debugging capabilities

## Architecture

### Implementation Approach

All AI Agent nodes will be implemented as **custom nodes** in the `backend/custom-nodes/` directory. This follows the existing pattern for extensible node development and allows for easy distribution and updates.

### Custom Node Package Structure

```
backend/custom-nodes/ai-agent-nodes/
├── package.json
├── index.js
├── nodes/
│   ├── AIAgent.node.js
│   ├── OpenAIModel.node.js
│   ├── AnthropicModel.node.js
│   ├── BufferMemory.node.js
│   ├── WindowMemory.node.js
│   ├── RedisMemory.node.js
│   ├── CalculatorTool.node.js
│   ├── HttpRequestTool.node.js
│   └── KnowledgeBaseTool.node.js
└── credentials/
    ├── OpenAIApi.credentials.js
    ├── AnthropicApi.credentials.js
    └── RedisConnection.credentials.js
```

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AI AGENT NODE                        │
│  (Orchestrator - manages the agent loop)                │
│                                                          │
│  Responsibilities:                                       │
│    - Receive user input                                 │
│    - Coordinate with Model, Memory, and Tool nodes      │
│    - Execute agent loop (reason → act → observe)        │
│    - Handle errors and max iterations                   │
│    - Return final response                              │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
           ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  MODEL   │  │  MEMORY  │  │  TOOL 1  │  │  TOOL 2  │
   │  NODE    │  │  NODE    │  │  NODE    │  │  NODE    │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Note**: Model, Memory, and Tool nodes are **service nodes** (no visual inputs/outputs in the workflow editor). They are connected to the AI Agent node through a special connection mechanism that allows the Agent to discover and invoke them.

### Data Flow

1. **User Input** → AI Agent Node receives trigger/data
2. **Memory Retrieval** → Agent fetches conversation history from Memory Node
3. **Model Request** → Agent sends message + tools + history to Model Node
4. **Model Response** → Model returns either:
   - Tool call request → Agent executes Tool Node → Loop back to step 3
   - Final answer → Agent proceeds to step 5
5. **Memory Storage** → Agent saves conversation to Memory Node
6. **Output** → Agent returns final response

## Components and Interfaces

### 1. AI Agent Node

The orchestrator that manages the agent execution loop.

#### Node Definition

```typescript
type: 'ai-agent'
displayName: 'AI Agent'
group: ['ai', 'agent']
inputs: ['main', 'model', 'memory', 'tools']
outputs: ['main']
```

#### Properties

```typescript
properties: [
  {
    displayName: 'System Prompt',
    name: 'systemPrompt',
    type: 'string',
    required: false,
    default: 'You are a helpful AI assistant.',
    description: 'Instructions that define the agent\'s behavior and personality',
    placeholder: 'You are a helpful assistant that...'
  },
  {
    displayName: 'User Message',
    name: 'userMessage',
    type: 'string',
    required: true,
    default: '',
    description: 'The message to send to the agent. Supports {{json.field}} expressions',
    placeholder: 'Enter your message or use {{json.field}}'
  },
  {
    displayName: 'Max Iterations',
    name: 'maxIterations',
    type: 'number',
    required: false,
    default: 10,
    description: 'Maximum number of agent loop iterations to prevent infinite loops',
    placeholder: '10'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'Additional agent configuration options',
    options: [
      {
        name: 'toolChoice',
        displayName: 'Tool Choice',
        type: 'options',
        default: 'auto',
        description: 'Control when the agent can use tools',
        options: [
          { name: 'Auto (Model Decides)', value: 'auto' },
          { name: 'Required (Must Use Tool)', value: 'required' },
          { name: 'None (Disable Tools)', value: 'none' }
        ]
      },
      {
        name: 'outputFormat',
        displayName: 'Output Format',
        type: 'options',
        default: 'text',
        description: 'Format of the agent response',
        options: [
          { name: 'Text Only', value: 'text' },
          { name: 'JSON', value: 'json' },
          { name: 'Full (with metadata)', value: 'full' }
        ]
      },
      {
        name: 'sessionId',
        displayName: 'Session ID',
        type: 'string',
        default: '',
        placeholder: '{{json.userId}}',
        description: 'Unique identifier for conversation context (supports expressions)'
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 300000,
        description: 'Maximum execution time in milliseconds'
      }
    ]
  }
]
```

#### Execution Context


```typescript
interface AgentExecutionContext {
  modelNode: ModelNodeInterface;
  memoryNode?: MemoryNodeInterface;
  toolNodes: ToolNodeInterface[];
  systemPrompt: string;
  maxIterations: number;
  toolChoice: 'auto' | 'required' | 'none';
  currentIteration: number;
}
```

#### Agent Loop Algorithm

```typescript
async function executeAgentLoop(userMessage: string): Promise<AgentResponse> {
  let iteration = 0;
  let messages: Message[] = [];
  
  // Step 1: Load conversation history
  if (memoryNode) {
    messages = await memoryNode.getMessages(sessionId);
  }
  
  // Step 2: Add system prompt if first message
  if (messages.length === 0 && systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  // Step 3: Add user message
  messages.push({ role: 'user', content: userMessage });
  
  // Step 4: Agent loop
  while (iteration < maxIterations) {
    iteration++;
    
    // Get available tools
    const tools = toolNodes.map(tool => tool.getDefinition());
    
    // Call model
    const response = await modelNode.chat(messages, tools, toolChoice);
    
    // Check if model wants to use a tool
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const tool = findToolByName(toolCall.name);
        const result = await tool.execute(toolCall.arguments);
        
        // Add tool result to messages
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id
        });
      }
      
      // Continue loop
      continue;
    }
    
    // No tool calls - we have final answer
    const finalAnswer = response.content;
    
    // Step 5: Save to memory
    if (memoryNode) {
      await memoryNode.addMessage(sessionId, { role: 'assistant', content: finalAnswer });
    }
    
    return {
      response: finalAnswer,
      iterations: iteration,
      toolsUsed: getToolsUsed(messages)
    };
  }
  
  throw new Error(`Max iterations (${maxIterations}) reached`);
}
```

### 2. Model Node (Abstract Interface)

Provides a unified interface for different AI providers.

#### Base Interface

```typescript
interface ModelNodeInterface {
  // Main chat method
  chat(
    messages: Message[],
    tools?: ToolDefinition[],
    toolChoice?: 'auto' | 'required' | 'none'
  ): Promise<ModelResponse>;
  
  // Capability flags
  supportsTools(): boolean;
  supportsVision(): boolean;
  supportsStreaming(): boolean;
  
  // Model info
  getModelInfo(): ModelInfo;
}

interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

#### Common Properties Pattern (All Model Nodes)

Model nodes follow a consistent property structure with basic parameters and an `options` collection for advanced settings:

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: true,
    allowedTypes: ['openaiApi'] // or 'anthropicApi', etc.
  },
  {
    displayName: 'Model',
    name: 'model',
    type: 'options',
    required: true,
    options: [] // Provider-specific models
  },
  {
    displayName: 'Temperature',
    name: 'temperature',
    type: 'number',
    default: 0.7,
    description: 'Controls randomness (0-2)'
  },
  {
    displayName: 'Max Tokens',
    name: 'maxTokens',
    type: 'number',
    default: 1000,
    description: 'Maximum response length'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    options: [
      // Advanced parameters like topP, penalties, etc.
    ]
  }
]
```

### 3. OpenAI Model Node

Implementation for OpenAI's GPT models.

#### Node Definition

```typescript
type: 'openai-model'
displayName: 'OpenAI Model'
group: ['ai', 'model']
inputs: []  // No inputs - provides service to Agent
outputs: []  // No outputs - called by Agent
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: true,
    default: '',
    description: 'OpenAI API credentials',
    placeholder: 'Select credentials...',
    allowedTypes: ['openaiApi']
  },
  {
    displayName: 'Model',
    name: 'model',
    type: 'options',
    required: true,
    default: 'gpt-4o-mini',
    description: 'The OpenAI model to use',
    options: [
      { name: 'GPT-4o', value: 'gpt-4o' },
      { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
    ]
  },
  {
    displayName: 'Temperature',
    name: 'temperature',
    type: 'number',
    required: false,
    default: 0.7,
    description: 'Controls randomness (0-2). Higher = more random',
    placeholder: '0.7'
  },
  {
    displayName: 'Max Tokens',
    name: 'maxTokens',
    type: 'number',
    required: false,
    default: 1000,
    description: 'Maximum tokens in response',
    placeholder: '1000'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'Advanced OpenAI configuration',
    options: [
      {
        name: 'jsonMode',
        displayName: 'JSON Mode',
        type: 'boolean',
        default: false,
        description: 'Force JSON response format (GPT-4 Turbo and newer)'
      },
      {
        name: 'topP',
        displayName: 'Top P',
        type: 'number',
        default: 1,
        description: 'Nucleus sampling (0-1). Alternative to temperature'
      },
      {
        name: 'frequencyPenalty',
        displayName: 'Frequency Penalty',
        type: 'number',
        default: 0,
        description: 'Reduce repetition (-2 to 2)'
      },
      {
        name: 'presencePenalty',
        displayName: 'Presence Penalty',
        type: 'number',
        default: 0,
        description: 'Encourage new topics (-2 to 2)'
      },
      {
        name: 'seed',
        displayName: 'Seed',
        type: 'number',
        default: undefined,
        description: 'Random seed for deterministic outputs'
      },
      {
        name: 'stop',
        displayName: 'Stop Sequences',
        type: 'string',
        default: '',
        placeholder: '\\n\\n, END',
        description: 'Comma-separated stop sequences (max 4)'
      }
    ]
  }
]
```

#### Tool Format Conversion

OpenAI uses function calling format:

```typescript
// Convert internal tool definition to OpenAI format
function convertToOpenAIFormat(tool: ToolDefinition): OpenAIFunction {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters  // JSON Schema
    }
  };
}

// Convert OpenAI response to internal format
function convertFromOpenAIFormat(response: OpenAIResponse): ModelResponse {
  return {
    content: response.choices[0].message.content,
    toolCalls: response.choices[0].message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    })),
    finishReason: response.choices[0].finish_reason,
    usage: response.usage
  };
}
```

### 4. Anthropic Model Node

Implementation for Anthropic's Claude models.

#### Node Definition

```typescript
type: 'anthropic-model'
displayName: 'Anthropic Model'
group: ['ai', 'model']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: true,
    default: '',
    description: 'Anthropic API credentials',
    placeholder: 'Select credentials...',
    allowedTypes: ['anthropicApi']
  },
  {
    displayName: 'Model',
    name: 'model',
    type: 'options',
    required: true,
    default: 'claude-3-5-sonnet-20241022',
    description: 'The Claude model to use',
    options: [
      { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
      { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
      { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' }
    ]
  },
  {
    displayName: 'Temperature',
    name: 'temperature',
    type: 'number',
    required: false,
    default: 0.7,
    description: 'Controls randomness (0-1). Higher = more random',
    placeholder: '0.7'
  },
  {
    displayName: 'Max Tokens',
    name: 'maxTokens',
    type: 'number',
    required: false,
    default: 1000,
    description: 'Maximum tokens in response',
    placeholder: '1000'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'Advanced Anthropic configuration',
    options: [
      {
        name: 'topP',
        displayName: 'Top P',
        type: 'number',
        default: 1,
        description: 'Nucleus sampling (0-1)'
      },
      {
        name: 'topK',
        displayName: 'Top K',
        type: 'number',
        default: 0,
        description: 'Sample from top K tokens (0 = disabled)'
      },
      {
        name: 'stop',
        displayName: 'Stop Sequences',
        type: 'string',
        default: '',
        placeholder: '\\n\\n, END',
        description: 'Comma-separated stop sequences'
      }
    ]
  }
]
```

#### Tool Format Conversion

Anthropic uses tool use format:

```typescript
// Convert internal tool definition to Anthropic format
function convertToAnthropicFormat(tool: ToolDefinition): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters  // JSON Schema
  };
}

// Convert Anthropic response to internal format
function convertFromAnthropicFormat(response: AnthropicResponse): ModelResponse {
  const content = response.content.find(c => c.type === 'text')?.text || '';
  const toolUse = response.content.filter(c => c.type === 'tool_use');
  
  return {
    content,
    toolCalls: toolUse.map(tu => ({
      id: tu.id,
      name: tu.name,
      arguments: tu.input
    })),
    finishReason: response.stop_reason,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens
    }
  };
}
```

### 5. Memory Node (Abstract Interface)

Manages conversation history with different storage strategies.

#### Base Interface

```typescript
interface MemoryNodeInterface {
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clear(sessionId: string): Promise<void>;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
  toolCallId?: string;
}
```

#### Common Properties Pattern (All Memory Nodes)

All memory nodes share a consistent property structure:

```typescript
properties: [
  {
    displayName: 'Session ID',
    name: 'sessionId',
    type: 'string',
    required: true,
    default: 'default',
    description: 'Unique identifier for conversation context',
    placeholder: '{{json.userId}} or static-session-id'
  }
]
```

### 6. Buffer Memory Node

Stores all messages without limit.

#### Node Definition

```typescript
type: 'buffer-memory'
displayName: 'Buffer Memory'
group: ['ai', 'memory']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Session ID',
    name: 'sessionId',
    type: 'string',
    required: true,
    default: 'default',
    description: 'Unique identifier for conversation',
    placeholder: '{{json.userId}}'
  }
]
```

**Note**: Buffer Memory uses in-memory storage by default. For persistent storage, use Redis Memory Node.

#### Implementation

```typescript
class BufferMemory implements MemoryNodeInterface {
  private storage: Map<string, Message[]> = new Map();
  
  async getMessages(sessionId: string): Promise<Message[]> {
    return this.storage.get(sessionId) || [];
  }
  
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const messages = this.storage.get(sessionId) || [];
    messages.push(message);
    this.storage.set(sessionId, messages);
  }
  
  async clear(sessionId: string): Promise<void> {
    this.storage.delete(sessionId);
  }
}
```

### 7. Window Memory Node

Keeps only the N most recent messages.

#### Node Definition

```typescript
type: 'window-memory'
displayName: 'Window Memory'
group: ['ai', 'memory']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Session ID',
    name: 'sessionId',
    type: 'string',
    required: true,
    default: 'default',
    description: 'Unique identifier for conversation',
    placeholder: '{{json.userId}}'
  },
  {
    displayName: 'Max Messages',
    name: 'maxMessages',
    type: 'number',
    required: false,
    default: 10,
    description: 'Number of recent messages to keep',
    placeholder: '10'
  }
]
```

#### Implementation

```typescript
class WindowMemory implements MemoryNodeInterface {
  private maxMessages: number;
  private storage: Map<string, Message[]> = new Map();
  
  async getMessages(sessionId: string): Promise<Message[]> {
    const messages = this.storage.get(sessionId) || [];
    return messages.slice(-this.maxMessages);
  }
  
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const messages = this.storage.get(sessionId) || [];
    messages.push(message);
    
    // Keep only last N messages
    if (messages.length > this.maxMessages) {
      messages.splice(0, messages.length - this.maxMessages);
    }
    
    this.storage.set(sessionId, messages);
  }
  
  async clear(sessionId: string): Promise<void> {
    this.storage.delete(sessionId);
  }
}
```

### 8. Redis Memory Node

Persistent storage using Redis.

#### Node Definition

```typescript
type: 'redis-memory'
displayName: 'Redis Memory'
group: ['ai', 'memory']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: true,
    default: '',
    description: 'Redis connection credentials',
    placeholder: 'Select credentials...',
    allowedTypes: ['redisConnection']
  },
  {
    displayName: 'Session ID',
    name: 'sessionId',
    type: 'string',
    required: true,
    default: 'default',
    description: 'Unique identifier for conversation',
    placeholder: '{{json.userId}}'
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'Additional Redis memory configuration',
    options: [
      {
        name: 'ttl',
        displayName: 'TTL (seconds)',
        type: 'number',
        default: 0,
        description: 'Time-to-live for messages (0 = no expiration)',
        placeholder: '3600'
      },
      {
        name: 'keyPrefix',
        displayName: 'Key Prefix',
        type: 'string',
        default: 'agent:memory:',
        description: 'Prefix for Redis keys',
        placeholder: 'agent:memory:'
      }
    ]
  }
]
```

#### Implementation

```typescript
class RedisMemory implements MemoryNodeInterface {
  private redis: RedisClient;
  private ttl: number;
  private keyPrefix: string;
  
  async getMessages(sessionId: string): Promise<Message[]> {
    const key = `${this.keyPrefix}${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : [];
  }
  
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    const messages = await this.getMessages(sessionId);
    messages.push(message);
    
    await this.redis.set(key, JSON.stringify(messages));
    
    if (this.ttl > 0) {
      await this.redis.expire(key, this.ttl);
    }
  }
  
  async clear(sessionId: string): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.del(key);
  }
}
```

### 9. Tool Node (Abstract Interface)

Represents an executable function that the agent can invoke.

#### Base Interface

```typescript
interface ToolNodeInterface {
  // Get tool definition for the model
  getDefinition(): ToolDefinition;
  
  // Execute the tool with given arguments
  execute(arguments: Record<string, any>): Promise<ToolResult>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;  // JSON Schema for arguments
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
```

#### Common Pattern for Tool Nodes

```typescript
type: 'tool-{name}'
displayName: '{Name} Tool'
group: ['ai', 'tool']
inputs: []  // No inputs - called by Agent
outputs: []  // No outputs - returns result to Agent
```

### 10. Calculator Tool Node

Performs mathematical calculations.

#### Node Definition

```typescript
type: 'calculator-tool'
displayName: 'Calculator Tool'
group: ['ai', 'tool']
inputs: []
outputs: []
```

#### Tool Definition

```typescript
{
  name: 'calculator',
  description: 'Perform mathematical calculations. Supports basic arithmetic (+, -, *, /), exponents (^), and parentheses.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2", "(10 * 5) / 2")'
      }
    },
    required: ['expression']
  }
}
```

#### Implementation

```typescript
async execute(args: { expression: string }): Promise<ToolResult> {
  try {
    // Validate expression (only allow safe characters)
    if (!/^[0-9+\-*/().\s^]+$/.test(args.expression)) {
      return {
        success: false,
        error: 'Invalid expression: only numbers and operators allowed'
      };
    }
    
    // Evaluate using safe math parser
    const result = evaluateMathExpression(args.expression);
    
    return {
      success: true,
      data: { result, expression: args.expression }
    };
  } catch (error) {
    return {
      success: false,
      error: `Calculation error: ${error.message}`
    };
  }
}
```

### 11. HTTP Request Tool Node

Makes HTTP requests to external APIs.

#### Node Definition

```typescript
type: 'http-request-tool'
displayName: 'HTTP Request Tool'
group: ['ai', 'tool']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: false,
    default: '',
    description: 'Optional authentication for HTTP requests',
    placeholder: 'None',
    allowedTypes: ['httpBasicAuth', 'httpHeaderAuth', 'httpBearerAuth', 'apiKey']
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'HTTP request configuration',
    options: [
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 30000,
        description: 'Request timeout in milliseconds',
        placeholder: '30000'
      },
      {
        name: 'followRedirects',
        displayName: 'Follow Redirects',
        type: 'boolean',
        default: true,
        description: 'Whether to follow HTTP redirects'
      },
      {
        name: 'maxRedirects',
        displayName: 'Max Redirects',
        type: 'number',
        default: 5,
        description: 'Maximum number of redirects to follow'
      }
    ]
  }
]
```

#### Tool Definition

```typescript
{
  name: 'http_request',
  description: 'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE methods.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to make the request to'
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'HTTP method to use'
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include'
      },
      body: {
        type: 'object',
        description: 'Optional request body (for POST/PUT)'
      }
    },
    required: ['url', 'method']
  }
}
```

#### Implementation

```typescript
async execute(args: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<ToolResult> {
  try {
    // Security validation
    const validation = UrlSecurityValidator.validateUrl(args.url);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Security validation failed: ${validation.errors.join(', ')}`
      };
    }
    
    // Make request
    const response = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body ? JSON.stringify(args.body) : undefined,
      timeout: this.timeout
    });
    
    const data = await response.json();
    
    return {
      success: true,
      data: {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: data
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `HTTP request failed: ${error.message}`
    };
  }
}
```

### 12. Knowledge Base Tool Node

Searches a vector database for relevant information.

#### Node Definition

```typescript
type: 'knowledge-base-tool'
displayName: 'Knowledge Base Tool'
group: ['ai', 'tool']
inputs: []
outputs: []
```

#### Properties

```typescript
properties: [
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'credential',
    required: true,
    default: '',
    description: 'Vector database credentials',
    placeholder: 'Select credentials...',
    allowedTypes: ['openaiApi'] // For embeddings
  },
  {
    displayName: 'Collection',
    name: 'collection',
    type: 'string',
    required: true,
    default: '',
    description: 'Vector collection/index name',
    placeholder: 'my-knowledge-base'
  },
  {
    displayName: 'Embedding Model',
    name: 'embeddingModel',
    type: 'options',
    required: false,
    default: 'text-embedding-3-small',
    description: 'Model to use for generating embeddings',
    options: [
      { name: 'Text Embedding 3 Small', value: 'text-embedding-3-small' },
      { name: 'Text Embedding 3 Large', value: 'text-embedding-3-large' },
      { name: 'Text Embedding Ada 002', value: 'text-embedding-ada-002' }
    ]
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    description: 'Knowledge base search configuration',
    options: [
      {
        name: 'topK',
        displayName: 'Top K Results',
        type: 'number',
        default: 5,
        description: 'Number of results to return',
        placeholder: '5'
      },
      {
        name: 'minScore',
        displayName: 'Minimum Score',
        type: 'number',
        default: 0.7,
        description: 'Minimum similarity score (0-1)',
        placeholder: '0.7'
      }
    ]
  }
]
```

#### Tool Definition

```typescript
{
  name: 'knowledge_base_search',
  description: 'Search the knowledge base for relevant information using semantic search.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default 5)'
      }
    },
    required: ['query']
  }
}
```

#### Implementation

```typescript
async execute(args: { query: string; limit?: number }): Promise<ToolResult> {
  try {
    const limit = args.limit || this.topK;
    
    // Generate embedding for query
    const embedding = await this.generateEmbedding(args.query);
    
    // Search vector database
    const results = await this.vectorDB.search({
      collection: this.collection,
      vector: embedding,
      limit
    });
    
    return {
      success: true,
      data: {
        results: results.map(r => ({
          content: r.content,
          score: r.score,
          metadata: r.metadata
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Knowledge base search failed: ${error.message}`
    };
  }
}
```

## Data Models

### Agent State

```typescript
interface AgentState {
  sessionId: string;
  currentIteration: number;
  messages: Message[];
  toolsUsed: string[];
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'max_iterations';
}
```

### Tool Call Tracking

```typescript
interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, any>;
  result: ToolResult;
  timestamp: number;
  duration: number;
}
```

### Execution Metadata

```typescript
interface AgentExecutionMetadata {
  iterations: number;
  toolCalls: ToolCallRecord[];
  totalTokens: number;
  totalCost: number;
  duration: number;
  finishReason: 'completed' | 'max_iterations' | 'error';
}
```

## Error Handling

### Error Types

1. **Configuration Errors**
   - Missing required connections (Model node)
   - Invalid parameters
   - Credential issues

2. **Execution Errors**
   - Model API failures
   - Tool execution failures
   - Memory storage failures
   - Timeout errors

3. **Validation Errors**
   - Invalid tool arguments
   - Security validation failures
   - Resource limit exceeded

### Error Handling Strategy

```typescript
class AgentErrorHandler {
  static handleModelError(error: Error): AgentError {
    if (error.message.includes('401')) {
      return new AgentError('INVALID_CREDENTIALS', 'Model authentication failed');
    }
    if (error.message.includes('429')) {
      return new AgentError('RATE_LIMIT', 'Model rate limit exceeded');
    }
    return new AgentError('MODEL_ERROR', `Model error: ${error.message}`);
  }
  
  static handleToolError(toolName: string, error: Error): ToolResult {
    return {
      success: false,
      error: `Tool '${toolName}' failed: ${error.message}`
    };
  }
  
  static handleMemoryError(error: Error): void {
    // Log error but continue without memory
    logger.warn('Memory operation failed, continuing without memory', { error });
  }
}
```

### Graceful Degradation

- **Memory Failure**: Continue without conversation history
- **Tool Failure**: Return error to model, let it decide next action
- **Model Failure**: Retry with exponential backoff, then fail workflow

## Testing Strategy

### Unit Tests

1. **Agent Loop Logic**
   - Test iteration counting
   - Test max iterations enforcement
   - Test tool call routing
   - Test message formatting

2. **Model Nodes**
   - Test format conversion (internal ↔ provider)
   - Test credential handling
   - Test error responses
   - Mock API calls

3. **Memory Nodes**
   - Test message storage/retrieval
   - Test window size enforcement
   - Test TTL expiration
   - Test session isolation

4. **Tool Nodes**
   - Test argument validation
   - Test execution logic
   - Test error handling
   - Test security validation

### Integration Tests

1. **End-to-End Agent Flow**
   - User message → Model → Tool → Model → Response
   - Multi-turn conversations with memory
   - Multiple tool calls in sequence
   - Error recovery scenarios

2. **Provider Compatibility**
   - Test with OpenAI models
   - Test with Anthropic models
   - Verify tool format conversion

3. **Memory Persistence**
   - Test Redis storage
   - Test session recovery
   - Test concurrent access

### Test Data

```typescript
const testScenarios = [
  {
    name: 'Simple Q&A',
    input: 'What is 2+2?',
    expectedTools: ['calculator'],
    expectedResponse: '4'
  },
  {
    name: 'API Integration',
    input: 'Get weather for New York',
    expectedTools: ['http_request'],
    expectedResponse: /temperature|weather/i
  },
  {
    name: 'Knowledge Search',
    input: 'What is our refund policy?',
    expectedTools: ['knowledge_base_search'],
    expectedResponse: /refund|policy/i
  }
];
```

## Performance Considerations

### Optimization Strategies

1. **Connection Pooling**
   - Reuse HTTP connections for API calls
   - Pool Redis connections

2. **Caching**
   - Cache tool definitions
   - Cache model capabilities
   - Cache embeddings for knowledge base

3. **Parallel Execution**
   - Execute independent tool calls in parallel
   - Batch memory operations

4. **Resource Limits**
   - Enforce max message history size
   - Limit tool execution time
   - Cap response sizes

### Monitoring Metrics

- Agent execution time
- Tool call frequency
- Model token usage
- Memory storage size
- Error rates by type
- Cost per execution

## Security Considerations

### Input Validation

- Sanitize user messages
- Validate tool arguments against JSON Schema
- Prevent injection attacks in tool parameters

### Access Control

- Credential isolation per node
- Tool permission system
- Rate limiting per session

### Data Privacy

- Encrypt sensitive data in memory storage
- Support PII redaction in logs
- Configurable data retention policies

## Future Enhancements

### Phase 2 Features

1. **Streaming Responses**
   - Real-time token streaming from models
   - Progressive tool execution updates

2. **Multi-Agent Collaboration**
   - Agent-to-agent communication
   - Hierarchical agent structures

3. **Advanced Memory**
   - Vector memory for semantic search
   - Summary memory for long conversations
   - Hybrid memory strategies

4. **Additional Tools**
   - Code execution tool
   - File system tool
   - Email tool
   - Database query tool
   - Workflow trigger tool

5. **Model Enhancements**
   - Local model support (Ollama)
   - Azure OpenAI support
   - Google Gemini support
   - Model fallback chains

### Phase 3 Features

1. **Agent Templates**
   - Pre-configured agent workflows
   - Industry-specific agents
   - Template marketplace

2. **Advanced Observability**
   - Agent execution visualization
   - Cost tracking dashboard
   - Performance analytics

3. **Optimization**
   - Automatic prompt optimization
   - Tool selection learning
   - Cost optimization suggestions
