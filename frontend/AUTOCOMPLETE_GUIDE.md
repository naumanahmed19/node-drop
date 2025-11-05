# Autocomplete Guide for Condition Rows

## How to Use Autocomplete in Condition Rows (If, Switch, Loop nodes)

### The Issue
When using nodes with condition rows (like If, Switch), the key field should show autocomplete suggestions from previous node outputs, but it might not be obvious how to trigger it.

### The Solution

#### Step 1: Type `{{` to Trigger Autocomplete
In the **Key** field of a condition row, type `{{` (two opening curly braces) to trigger the autocomplete menu.

```
Key field: {{
           ↑ Autocomplete menu appears!
```

#### Step 2: Browse Available Fields
The autocomplete menu will show:
- **Variables** (`$vars`, `$local`)
- **Previous Node Outputs** (categorized by node name)
- **Functions** (string, array, math functions)

#### Step 3: Select a Field
Use arrow keys or mouse to select a field, then press Enter or click to insert it.

```
Key field: {{json.status
```

#### Step 4: Close the Expression
Type `}}` to close the expression:

```
Key field: {{json.status}}
```

### Example Workflow

**Workflow**: HTTP Request → If Node

**HTTP Request Output**:
```json
{
  "status": "active",
  "user": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

**If Node Condition**:
- Key: `{{json.status}}` ← Type {{ to see autocomplete
- Expression: Equal
- Value: `active`

### Autocomplete Categories

#### 1. Previous Node Outputs
Shows fields from connected nodes:
```
HTTP Request (input)
  ├─ status
  ├─ user.name
  ├─ user.email
  └─ ...
```

#### 2. Variables
Shows global and local variables:
```
Variables (Global)
  ├─ $vars.apiKey
  ├─ $vars.baseUrl
  └─ ...

Variables (Local)
  ├─ $local.counter
  └─ ...
```

#### 3. Functions
Shows available functions:
```
String Functions
  ├─ toUpperCase()
  ├─ toLowerCase()
  └─ ...
```

### Tips

1. **Always use `{{}}` for dynamic values**
   - ✅ `{{json.status}}`
   - ❌ `json.status` (won't work)

2. **Nested fields are supported**
   - `{{json.user.name}}`
   - `{{json.items[0].id}}`

3. **You can use expressions**
   - `{{json.price * 1.1}}`
   - `{{json.name.toUpperCase()}}`

4. **Autocomplete shows after typing `{{`**
   - Type `{{` and wait a moment
   - Start typing to filter suggestions
   - Use arrow keys to navigate

### Troubleshooting

#### Problem: Autocomplete doesn't show
**Solutions**:
1. Make sure you typed `{{` (two opening braces)
2. Check that previous nodes have executed and have output data
3. Verify the node is connected to previous nodes
4. Try clicking in the field and typing `{{` again

#### Problem: No fields from previous node
**Solutions**:
1. Execute the previous node first (click "Test" or run workflow)
2. Check that the previous node has output data
3. Verify the connection between nodes exists

#### Problem: Field not found at runtime
**Solutions**:
1. Make sure the field name matches exactly (case-sensitive)
2. Check that the previous node always outputs that field
3. Use the If node to check if field exists first

### Advanced Usage

#### Accessing Array Elements
```
{{json.items[0].name}}     // First item
{{json.items.length}}      // Array length
```

#### Using Functions
```
{{json.email.toLowerCase()}}
{{json.name.trim()}}
{{json.price.toFixed(2)}}
```

#### Combining Multiple Fields
```
{{json.firstName + ' ' + json.lastName}}
```

### Quick Reference

| Action | Shortcut |
|--------|----------|
| Show autocomplete | Type `{{` |
| Navigate suggestions | ↑ ↓ Arrow keys |
| Select suggestion | Enter or Click |
| Close autocomplete | Esc |
| Insert variable | Type `$` |

### Example Conditions

#### Check Status
```
Key: {{json.status}}
Expression: Equal
Value: active
```

#### Check Number Range
```
Key: {{json.age}}
Expression: Larger
Value: 18
```

#### Check Email Domain
```
Key: {{json.email}}
Expression: Ends With
Value: @company.com
```

#### Check Array Length
```
Key: {{json.items.length}}
Expression: Larger
Value: 0
```

#### Check Nested Field
```
Key: {{json.user.role}}
Expression: Equal
Value: admin
```

---

## Summary

1. **Type `{{`** in the Key field to trigger autocomplete
2. **Browse** available fields from previous nodes
3. **Select** a field using arrow keys or mouse
4. **Close** with `}}` to complete the expression

The autocomplete feature is working - you just need to type `{{` to activate it! 🎉
