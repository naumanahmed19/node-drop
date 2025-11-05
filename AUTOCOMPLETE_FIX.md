# Autocomplete Fix for Multiple Input Nodes

## Problem
When you have multiple input nodes connected to a single node, the autocomplete had three issues:

1. **Fields were being overridden**: Adding a new input node would override the previous node's fields instead of showing both
2. **Wrong data access pattern**: With multiple inputs, data should be accessed as an array (`json[0].title`, `json[1].title`) but it was showing object access (`json.title`)
3. **Preview not working**: The expression preview wasn't evaluating array-based expressions like `{{json[0].id}}`

## Example Scenario
```
HTTP Request 1 → { id: 1, title: "delectus aut autem", userId: 1, completed: false }
HTTP Request 2 → { id: 2, title: "quis ut nam facilis", userId: 1, completed: false }
Both connected to → IF Node
```

Previously:
- Only showed fields from one node
- Suggested `json.id` even though you need `json[0].id` or `json[1].id`
- Preview showed `[Expression: json[0].id]` instead of the actual value `1`

## Solution

### 1. Frontend: Per-Node Field Tracking
Changed from a global `seenFields` Set to a per-node `seenFieldsForNode` Set. Each input connection now maintains its own field list independently.

### 2. Frontend: Array-Based Access for Multiple Inputs
- **Single input**: Fields use `json.fieldName` (object access)
- **Multiple inputs**: Fields use `json[0].fieldName`, `json[1].fieldName` (array access)

The code now detects `hasMultipleInputs = inputConnections.length > 1` and adjusts the base path accordingly.

### 3. Frontend: Better Categorization
Each input is now labeled with its index: `HTTP Request (input 0)`, `HTTP Request (input 1)`, making it clear which input you're accessing.

### 4. Frontend: Value Previews
Field descriptions now show actual data values:
- `"delectus aut autem"` instead of `Type: string`
- `1` instead of `Type: number`
- `array[5]` for arrays

### 5. Frontend: Expression Preview Support
Updated `ExpressionPreview.tsx` to handle array-based access patterns:
- Parses `json[0].field` syntax
- Accesses the correct input by index
- Shows actual values in preview

### 6. Backend: Array-Based Expression Resolution
Updated `nodeHelpers.ts` `resolveValue()` function to support array-based input access:
- Detects `json[0].field` pattern
- When item is an array (multiple inputs), accesses the specific input by index
- Falls back to standard object access for single inputs
- Added comprehensive tests for the new functionality

## Changes Made

### Frontend Files

**`frontend/src/components/ui/form-generator/ExpressionInput.tsx`**
1. Changed loop from `for...of` to `forEach` with index tracking
2. Added `hasMultipleInputs` detection
3. Dynamic `basePath` calculation: `json[${connectionIndex}]` or `json`
4. Updated category names to include input index
5. Per-node field tracking with `seenFieldsForNode`
6. Enhanced value previews in descriptions

**`frontend/src/components/ui/form-generator/ExpressionPreview.tsx`**
1. Added array access pattern matching: `/^json\[(\d+)\]\.(.+)$/`
2. Updated `resolveExpression()` to handle both array and object access
3. Updated expression parsing in `getPreviewText()` to support array syntax
4. Added proper error messages for out-of-bounds access

### Backend Files

**`backend/src/utils/nodeHelpers.ts`**
1. Updated `resolveValue()` to detect array-based access pattern
2. Added logic to handle multiple inputs as an array
3. Uses `resolvePath()` for nested field access
4. Maintains backward compatibility with single-input object access

**`backend/src/utils/__tests__/nodeHelpers.test.ts`**
1. Added test: "should resolve array-based access for multiple inputs"
2. Added test: "should resolve nested fields with array-based access"
3. Added test: "should handle out of bounds array access"
4. Added test: "should handle array access on non-array item"

All tests pass ✅

## Result
Now when you type `{{` in an expression input:
- All connected input nodes show their fields
- Correct array syntax when multiple inputs exist: `json[0].field`, `json[1].field`
- Clear labeling: "HTTP Request (input 0)", "HTTP Request (input 1)"
- Sample data values help identify which input to use
- Preview shows actual values: `{{json[0].id}}` → `1`
- Backend correctly resolves array-based expressions during execution
