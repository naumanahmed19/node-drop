# ConditionRow Field Type

The `conditionRow` field type is a specialized form field that combines three inputs in a single row:
- **Key** (left): The first value to compare (supports expressions)
- **Expression** (middle): The comparison operation (dropdown)
- **Value** (right): The second value to compare (supports expressions, hidden for isEmpty/isNotEmpty)

## Usage Example

### In Node Definition (Backend)

```typescript
{
  displayName: "Condition",
  name: "condition",
  type: "conditionRow",
  required: true,
  default: {
    key: "",
    expression: "equal",
    value: "",
  },
  description: "Define the condition to evaluate",
  options: [
    { name: "Equal", value: "equal" },
    { name: "Not Equal", value: "notEqual" },
    { name: "Larger", value: "larger" },
    { name: "Larger Equal", value: "largerEqual" },
    { name: "Smaller", value: "smaller" },
    { name: "Smaller Equal", value: "smallerEqual" },
    { name: "Contains", value: "contains" },
    { name: "Not Contains", value: "notContains" },
    { name: "Starts With", value: "startsWith" },
    { name: "Ends With", value: "endsWith" },
    { name: "Is Empty", value: "isEmpty" },
    { name: "Is Not Empty", value: "isNotEmpty" },
    { name: "Regex", value: "regex" },
  ],
  componentProps: {
    keyPlaceholder: "Value 1 (e.g., {{json.fieldName}})",
    valuePlaceholder: "Value 2 (e.g., {{json.fieldName}})",
    expressionPlaceholder: "Select operation",
  },
}
```

### Value Structure

The field value is an object with three properties:

```typescript
{
  key: string,      // First value to compare
  expression: string, // Operation type (equal, notEqual, etc.)
  value: string     // Second value to compare
}
```

### Accessing Values in Execute Function

```typescript
const condition = await this.getNodeParameter("condition", i) as {
  key: string;
  expression: string;
  value: string;
};

// Use the values
const result = evaluateCondition(condition.key, condition.expression, condition.value);
```

## Features

- **Expression Support**: Both key and value fields support expression syntax (e.g., `{{json.fieldName}}`)
- **Dynamic Layout**: Value field is automatically hidden when expression is "isEmpty" or "isNotEmpty"
- **Validation**: Supports standard form validation through the FormGenerator
- **Customizable Placeholders**: Configure placeholder text via `componentProps`
- **Customizable Operations**: Define available operations via the `options` array

## Example: If Node

See `backend/src/nodes/If/If.node.ts` for a complete implementation example.
