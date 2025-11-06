# Text Parser Node

A comprehensive text parsing and manipulation node for workflow automation, providing lodash-like string utilities and transformations.

## Features

### Case Transformations
- **To Uppercase** - Convert to UPPERCASE
- **To Lowercase** - Convert to lowercase
- **To Title Case** - Convert To Title Case
- **To Camel Case** - Convert to camelCase
- **To Snake Case** - Convert to snake_case
- **To Kebab Case** - Convert to kebab-case
- **Capitalize** - Capitalize first letter only

### Trimming & Padding
- **Trim** - Remove whitespace from both ends
- **Trim Start** - Remove whitespace from start
- **Trim End** - Remove whitespace from end
- **Pad Start** - Pad string at the start with custom character
- **Pad End** - Pad string at the end with custom character

### Replacement & Removal
- **Replace** - Replace first occurrence of substring
- **Replace All** - Replace all occurrences of substring
- **Remove** - Remove all occurrences of substring
- **Remove Whitespace** - Remove all whitespace characters

### Extraction
- **Substring** - Extract substring by position
- **Slice** - Extract slice of string
- **Extract Between** - Extract text between two delimiters
- **Truncate** - Truncate string to specified length with suffix

### Splitting & Joining
- **Split** - Split string into array by separator
- **Join Array** - Join array elements into string

### Encoding & Decoding
- **URL Encode** - Encode string for URL (percent encoding)
- **URL Decode** - Decode URL-encoded string
- **Base64 Encode** - Encode string to Base64
- **Base64 Decode** - Decode Base64 string
- **HTML Encode** - Encode HTML entities
- **HTML Decode** - Decode HTML entities

### Validation & Checking
- **Contains** - Check if string contains substring
- **Starts With** - Check if string starts with substring
- **Ends With** - Check if string ends with substring
- **Is Empty** - Check if string is empty (after trimming)
- **Length** - Get string length

### Regex Operations
- **Regex Match** - Match string against regex pattern
- **Regex Replace** - Replace using regex pattern with capture groups
- **Regex Extract** - Extract all matches from regex

### Other Operations
- **Reverse** - Reverse the string
- **Repeat** - Repeat string N times
- **Slugify** - Convert to URL-friendly slug

## Usage Examples

### Example 1: Convert to Title Case
```
Input: "hello world from workflow"
Operation: To Title Case
Output: "Hello World From Workflow"
```

### Example 2: Extract Email Domain
```
Input: "user@example.com"
Operation: Extract Between
Start Delimiter: "@"
End Delimiter: ""
Output: "example.com"
```

### Example 3: Create URL Slug
```
Input: "My Awesome Blog Post!"
Operation: Slugify
Output: "my-awesome-blog-post"
```

### Example 4: Regex Extract Numbers
```
Input: "Order #12345 costs $99.99"
Operation: Regex Extract
Pattern: \d+
Flags: g
Output: ["12345", "99", "99"]
```

### Example 5: Truncate Long Text
```
Input: "This is a very long description that needs to be shortened"
Operation: Truncate
Length: 30
Suffix: "..."
Output: "This is a very long descri..."
```

### Example 6: Base64 Encode
```
Input: "Hello World"
Operation: Base64 Encode
Output: "SGVsbG8gV29ybGQ="
```

### Example 7: Snake Case to Camel Case
```
Input: "user_first_name"
Operation: To Camel Case
Output: "userFirstName"
```

## Configuration

### Input Field
Specify the field containing the string to manipulate. Supports expressions like `{{json.fieldName}}`.

### Output Field
Specify the field name where the result will be stored (default: "result").

### Operation-Specific Parameters
Each operation may have additional parameters:
- **Replace/Remove**: Search value and replacement
- **Substring/Slice**: Start and end positions
- **Pad**: Target length and pad character
- **Split/Join**: Separator character
- **Regex**: Pattern and flags
- **Truncate**: Length and suffix
- **Repeat**: Count

## Tips

1. **Chaining Operations**: Connect multiple Text Parser nodes to perform complex transformations
2. **Regex Patterns**: Use standard JavaScript regex syntax
3. **Expressions**: Input field supports template expressions for dynamic values
4. **Error Handling**: Errors are captured and added to the output with an `error` field

## Installation

This node is a custom node. To use it:

1. Place in `backend/custom-nodes/text-parser/`
2. Restart the backend server
3. The node will appear in the node palette under "Transform" category

## Version

1.0.0

## License

MIT
