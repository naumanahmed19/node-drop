# Data Preview Node - Quick Start

## 🚀 Get Started in 30 Seconds

### Step 1: Add the Node
1. Open your workflow
2. Click the "+" button or search for nodes
3. Find "Data Preview" in the Transform category
4. Drag it onto the canvas

### Step 2: Connect It
Connect any node output to the Data Preview input:
```
[Any Node] → [Data Preview]
```

### Step 3: Configure (Optional)
The node works with defaults, but you can customize:
- **Data Input**: Leave empty to preview all data, or use `{{json.field}}` for specific fields
- **Format**: Choose JSON, Text, or Table
- **Max Lines**: Adjust if you have large datasets

### Step 4: Execute
Click the Execute button and see your data in a beautiful terminal-style preview!

## 📋 Common Use Cases

### 1. Debug a Loop
```
Manual Trigger → Loop (1-10) → Data Preview
```
See each iteration's data in real-time.

### 2. Check API Response
```
Manual Trigger → HTTP Request → Data Preview
```
Format: **Table** (if response is an array of objects)

### 3. Test Data Transformation
```
Manual Trigger → Code Node → Data Preview
```
Format: **JSON (Pretty)** to see the transformed structure

### 4. Monitor Counter Values
```
Manual Trigger → Loop → Set (counter) → Data Preview
```
Data Input: `{{json.counter}}`
Format: **Text**

### 5. Validate JSON Structure
```
Manual Trigger → JSON Parse → Data Preview
```
Format: **JSON (Pretty)** to verify structure

## 🎨 Format Guide

| Format | Best For | Example |
|--------|----------|---------|
| **JSON (Pretty)** | Objects, nested data | API responses, complex objects |
| **JSON (Compact)** | Quick inline preview | Small objects, debugging |
| **Text** | Simple values | Strings, numbers, counters |
| **Table** | Arrays of objects | User lists, database results |

## ⚡ Pro Tips

1. **Use Template Expressions**
   - `{{json}}` - All input data
   - `{{json.users}}` - Specific field
   - `{{json.data[0]}}` - Array element

2. **Optimize Performance**
   - Set **Max Lines** to 50 for large datasets
   - Use **Auto Collapse** when you have multiple preview nodes
   - Use **JSON (Compact)** for faster rendering

3. **Table Format Tips**
   - Works best with arrays of objects
   - Columns auto-size based on content
   - Long values are truncated with "..."

4. **Live Preview**
   - The configuration dialog shows a live preview
   - Change settings and see results immediately
   - Click refresh icon to update preview

5. **Debugging Workflows**
   - Add multiple Data Preview nodes at different stages
   - Use **Auto Collapse** to keep the output panel clean
   - Compare data before and after transformations

## 🔧 Configuration Reference

### Data Input
```
Empty          → Preview all input data
{{json}}       → Preview all input data
{{json.field}} → Preview specific field
{{json[0]}}    → Preview first array item
```

### Preview Format
- **JSON (Pretty)**: 2-space indentation, readable
- **JSON (Compact)**: Single line, space-efficient
- **Text**: Plain text representation
- **Table**: ASCII table with borders

### Max Lines
- **Default**: 100 lines
- **Range**: 10-1000 lines
- **Tip**: Lower for performance, higher for completeness

### Show Timestamp
- **On**: Shows execution time in preview
- **Off**: Cleaner output without timestamp

### Auto Collapse
- **On**: Starts collapsed, click to expand
- **Off**: Starts expanded (default)

## 🎯 Real-World Examples

### Example 1: E-commerce Order Processing
```
Webhook → Parse Order → Data Preview → Process Payment
```
**Config**: Format = JSON (Pretty), Max Lines = 200

### Example 2: Data Migration
```
PostgreSQL → Transform → Data Preview → HTTP Request
```
**Config**: Format = Table, Show Timestamp = true

### Example 3: Loop Counter
```
Manual → Loop (1-100) → Data Preview
```
**Config**: Data Input = `{{json.counter}}`, Format = Text

### Example 4: API Testing
```
Manual → HTTP Request → Data Preview → If Condition
```
**Config**: Format = JSON (Pretty), Auto Collapse = false

## 🐛 Troubleshooting

### No Preview Showing?
- Check if the node has input data
- Verify the Data Input field is correct
- Try using `{{json}}` to see all data

### Preview Truncated?
- Increase **Max Lines** setting
- Check the metadata for truncation status
- Use **JSON (Compact)** for more data in fewer lines

### Table Format Not Working?
- Ensure input is an array of objects
- Check if objects have consistent properties
- Try **JSON (Pretty)** format instead

### Performance Issues?
- Reduce **Max Lines** to 50 or less
- Use **JSON (Compact)** instead of Pretty
- Enable **Auto Collapse** for multiple previews

## 📚 Learn More

- See **README.md** for detailed documentation
- Check **example-usage.md** for more examples
- View **VISUAL_GUIDE.md** for UI screenshots
- Read **IMPLEMENTATION.md** for technical details

## 🎉 You're Ready!

Start using the Data Preview node to debug and visualize your workflow data. Happy debugging! 🚀
