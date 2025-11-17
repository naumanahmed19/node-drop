# Implementation Plan

## Overview

This implementation plan breaks down the AI Agent nodes feature into discrete, manageable coding tasks. Each task builds incrementally on previous tasks, with all code integrated into the custom-nodes package structure.

## Task List

- [x] 1. Set up custom node package structure





  - Create `backend/custom-nodes/ai-agent-nodes/` directory
  - Create `package.json` with dependencies (openai, anthropic, redis, etc.)
  - Create `index.js` to export all nodes
  - Create subdirectories: `nodes/`, `credentials/`, `utils/`
  - _Requirements: 1.1, 2.1_
-

- [x] 2. Implement shared utilities and interfaces




  - [x] 2.1 Create base interfaces for Model, Memory, and Tool nodes


    - Define `ModelNodeInterface` with `chat()`, `supportsTools()`, etc.
    - Define `MemoryNodeInterface` with `getMessages()`, `addMessage()`, `clear()`
    - Define `ToolNodeInterface` with `getDefinition()`, `execute()`
    - Define common types: `Message`, `ToolDefinition`, `ToolResult`, `ModelResponse`
    - _Requirements: 4.1, 4.2, 7.1, 7.2, 11.4_

  - [x] 2.2 Create tool format converters







    - Implement `convertToOpenAIFormat()` for OpenAI function calling
    - Implement `convertFromOpenAIFormat()` for parsing OpenAI responses
    - Implement `convertToAnthropicFormat()` for Anthropic tool use
    - Implement `convertFromAnthropicFormat()` for parsing Anthropic responses
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 2.3 Create agent loop utilities


    - Implement `AgentStateManager` for tracking execution state
    - Implement `ToolCallTracker` for recording tool usage
    - Implement `AgentErrorHandler` for error classification and handling
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
- [x] 3. Implement credential definitions




- [ ] 3. Implement credential definitions

  - [x] 3.1 Create OpenAI API credentials


    - Define `OpenAIApi.credentials.js` with API key field
    - _Requirements: 5.1_

  - [x] 3.2 Create Anthropic API credentials


    - Define `AnthropicApi.credentials.js` with API key field
    - _Requirements: 6.1_

  - [x] 3.3 Create Redis connection credentials


    - Define `RedisConnection.credentials.js` with host, port, password, database fields
    - _Requirements: 10.2_
-

- [x] 4. Implement Model nodes


  - [x] 4.1 Create OpenAI Model node


    - Define node structure with authentication, model, temperature, maxTokens properties
    - Implement options collection with jsonMode, topP, frequencyPenalty, presencePenalty, seed, stop
    - Implement `chat()` method that calls OpenAI API
    - Implement tool format conversion using shared utilities
    - Handle errors with retry logic and user-friendly messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 15.1, 15.2_

  - [x] 4.2 Create Anthropic Model node


    - Define node structure with authentication, model, temperature, maxTokens properties
    - Implement options collection with topP, topK, stop
    - Implement `chat()` method that calls Anthropic API
    - Implement tool format conversion using shared utilities
    - Handle system prompts according to Anthropic's requirements
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 15.1, 15.2_

- [x] 5. Implement Memory nodes






  - [x] 5.1 Create Buffer Memory node

    - Define node structure with sessionId property
    - Implement in-memory storage using Map
    - Implement `getMessages()` to return all messages
    - Implement `addMessage()` to append messages
    - Implement `clear()` to delete session

    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Create Window Memory node

    - Define node structure with sessionId and maxMessages properties
    - Implement in-memory storage with window size enforcement
    - Implement `getMessages()` to return last N messages
    - Implement `addMessage()` with automatic window trimming
    - Implement `clear()` to delete session
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.3 Create Redis Memory node


    - Define node structure with authentication, sessionId properties
    - Implement options collection with ttl and keyPrefix
    - Implement Redis client connection with credentials
    - Implement `getMessages()` to retrieve from Redis
    - Implement `addMessage()` to persist to Redis with TTL
    - Implement `clear()` to delete Redis key
    - Handle connection errors gracefully
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 6. Implement Tool nodes




  - [x] 6.1 Create Calculator Tool node


    - Define node structure (no properties needed)
    - Implement `getDefinition()` returning tool schema with expression parameter
    - Implement `execute()` with safe math expression evaluation
    - Validate expression contains only safe characters
    - Return structured result with success/error
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 6.2 Create HTTP Request Tool node


    - Define node structure with authentication property
    - Implement options collection with timeout, followRedirects, maxRedirects
    - Implement `getDefinition()` returning tool schema with url, method, headers, body parameters
    - Implement `execute()` with fetch API
    - Apply security validation using UrlSecurityValidator
    - Handle authentication credentials
    - Return structured response with status, headers, body
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_



  - [x] 6.3 Create Knowledge Base Tool node





    - Define node structure with authentication, collection, embeddingModel properties
    - Implement options collection with topK and minScore
    - Implement `getDefinition()` returning tool schema with query and limit parameters
    - Implement `execute()` with embedding generation and vector search
    - Return structured results with content, score, metadata
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 7. Implement AI Agent node (orchestrator)


  - [x] 7.1 Create node structure and properties


    - Define node with main input and main output
    - Implement systemPrompt, userMessage, maxIterations properties
    - Implement options collection with toolChoice, outputFormat, sessionId, timeout
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 7.2 Implement node connection discovery


    - Discover connected Model node (required)
    - Discover connected Memory node (optional)
    - Discover connected Tool nodes (optional, multiple)
    - Validate that Model node is connected
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ] 7.3 Implement agent loop execution










    - Initialize agent state with iteration counter
    - Load conversation history from Memory node if present
    - Add system prompt to messages if first message
    - Add user message to messages
    - Implement main loop: call model → check for tool calls → execute tools → repeat
    - Enforce max iterations limit
    - Save conversation to Memory node after completion
    - _Requirements: 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 2.5_

  - [x] 7.4 Implement tool execution routing


    - Parse tool calls from model response
    - Find matching Tool node by name
    - Validate tool arguments against JSON Schema
    - Execute tool and capture result
    - Add tool result to message history
    - Handle tool execution errors gracefully
    - _Requirements: 3.4, 3.5, 15.3, 15.4, 15.5, 17.2_

  - [x] 7.5 Implement output formatting


    - Support text output format (response only)
    - Support json output format (structured response)
    - Support full output format (response + metadata)
    - Include execution metadata: iterations, toolsUsed, totalTokens, duration
    - _Requirements: 2.4, 16.3_

  - [x] 7.6 Implement error handling


    - Handle model API failures with retry logic
    - Handle tool execution failures (return error to model)
    - Handle memory failures (continue without memory)
    - Handle timeout errors
    - Handle max iterations reached
    - Return user-friendly error messages
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 2.5_

- [ ] 8. Implement expression support
  - [ ] 8.1 Add expression resolution to Agent node
    - Resolve {{json.field}} expressions in systemPrompt
    - Resolve {{json.field}} expressions in userMessage
    - Use existing `this.resolveValue()` helper method
    - _Requirements: 18.1, 18.4_

  - [ ] 8.2 Add expression resolution to Memory nodes
    - Resolve {{json.field}} expressions in sessionId parameter
    - Use existing `this.resolveValue()` helper method
    - _Requirements: 18.2, 18.4_

- [ ] 9. Package integration and testing
  - [ ] 9.1 Create package.json with dependencies
    - Add openai SDK
    - Add anthropic SDK
    - Add redis client
    - Add math expression parser
    - Specify node version compatibility
    - _Requirements: 1.1_

  - [ ] 9.2 Create index.js to export all nodes
    - Export AIAgent node
    - Export OpenAIModel and AnthropicModel nodes
    - Export BufferMemory, WindowMemory, RedisMemory nodes
    - Export CalculatorTool, HttpRequestTool, KnowledgeBaseTool nodes
    - _Requirements: 1.1_

  - [ ] 9.3 Create README.md with usage examples
    - Document node connections and workflow setup
    - Provide example workflows for common use cases
    - Document credential setup
    - Include troubleshooting guide
    - _Requirements: 16.1, 16.2, 16.3_

- [ ]* 10. Testing and validation
  - [ ]* 10.1 Create unit tests for utilities
    - Test tool format converters (OpenAI ↔ internal, Anthropic ↔ internal)
    - Test agent state management
    - Test error handling
    - _Requirements: All_

  - [ ]* 10.2 Create integration tests for nodes
    - Test OpenAI Model node with mock API
    - Test Anthropic Model node with mock API
    - Test Memory nodes (Buffer, Window, Redis)
    - Test Tool nodes (Calculator, HTTP Request, Knowledge Base)
    - _Requirements: All_

  - [ ]* 10.3 Create end-to-end agent tests
    - Test simple Q&A flow (no tools)
    - Test single tool call flow (Calculator)
    - Test multi-tool flow (HTTP Request + Calculator)
    - Test conversation memory persistence
    - Test error recovery scenarios
    - Test max iterations enforcement
    - _Requirements: All_

## Notes

- All nodes are implemented as custom nodes in `backend/custom-nodes/ai-agent-nodes/`
- Model, Memory, and Tool nodes are service nodes (no visual inputs/outputs)
- The AI Agent node discovers connected nodes through a special connection mechanism
- Use existing node helper methods: `this.resolveValue()`, `this.getNodeParameter()`, `this.getCredentials()`
- Follow the collection pattern for advanced options (like webhook node)
- All credential types must be defined in the `credentials/` directory
- Error handling should be graceful with user-friendly messages
- Testing tasks are marked as optional (*) to focus on core functionality first
