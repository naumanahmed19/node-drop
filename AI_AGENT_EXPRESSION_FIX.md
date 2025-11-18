# AI Agent Node Expression Evaluation Fix

## Problem
The AI Agent node was not evaluating expressions like `{{json.userMessage}}` from input data. When users tried to pass data from previous nodes (like Postgres or HTTP Request), the expressions were being used as literal strings instead of being resolved to actual values.

## Root Cause
The AI Agent node was calling `await this.resolveValue(userMessageTemplate)` manually, but this is **not necessary**. The `getNodeParameter` function in the execution context **automatically resolves expressions** when there are input items available.

The issue was that the code was trying to manually resolve expressions instead of letting `getNodeParameter` do it automatically.

## Solution
Simplified the code to rely on `getNodeParameter`'s built-in expression resolution, following the same pattern used by other nodes like Postgres.

### Changes Made

**Before (incorrect manual resolution):**
```javascript
// Get parameters
const systemPrompt = await this.getNodeParameter('systemPrompt');
const userMessageTemplate = await this.getNodeParameter('userMessage');

// Manually resolve expressions
let userMessage;
try {
  userMessage = await this.resolveValue(userMessageTemplate);
} catch (error) {
  throw new Error(`Failed to resolve user message: ${error.message}`);
}
```

**After (correct automatic resolution):**
```javascript
// Get parameters - getNodeParameter automatically resolves expressions like {{json.field}}
const systemPrompt = await this.getNodeParameter('systemPrompt');
const userMessage = await this.getNodeParameter('userMessage');
const maxIterations = await this.getNodeParameter('maxIterations');
const options = (await this.getNodeParameter('options')) || {};
```

## How getNodeParameter Works

The `getNodeParameter` function (defined in `SecureExecutionService.ts`) automatically:

1. Gets the input items from `inputData.main`
2. Extracts JSON data from the items
3. Uses the first item (or specified `itemIndex`) as context
4. Recursively resolves any `{{...}}` expressions in the parameter value
5. Returns the fully resolved value

This means **no manual expression resolution is needed** - just call `getNodeParameter` and it handles everything.

## Example Usage

**Input from Postgres node:**
```javascript
[{ json: { userMessage: "Hello AI!", userId: "123" } }]
```

**AI Agent configuration:**
- User Message: `{{json.userMessage}}`
- Session ID: `{{json.userId}}`

**Result:**
- `userMessage` = "Hello AI!"
- `sessionId` = "123"

All expressions are automatically resolved by `getNodeParameter`.

## Files Modified
- `backend/custom-nodes/ai-agent-nodes/nodes/AIAgent.node.js`

## Pattern Used
This follows the same pattern as:
- `backend/custom-nodes/PostgreSQL/nodes/postgres.node.js`
- All other built-in nodes that use `getNodeParameter`

The key insight: **Trust `getNodeParameter` to handle expression resolution automatically.**
