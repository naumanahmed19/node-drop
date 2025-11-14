# Webhook Options UI Guide

## Overview
The webhook options are now displayed using a clean, collapsible collection field that matches n8n's design pattern.

## UI Components Used

### CollectionField Component
- **Purpose**: Displays optional configuration fields in a collapsible section
- **Design**: Uses shadcn/ui Select component for adding options
- **Features**:
  - Collapsible header showing count of selected options
  - Add options via dropdown with descriptions
  - Remove individual options
  - Expand/collapse to show/hide selected fields

## Visual Structure

```
┌─────────────────────────────────────────────┐
│ Webhook Trigger Configuration              │
├─────────────────────────────────────────────┤
│                                             │
│ Authentication: [None ▼]                    │
│                                             │
│ Webhook Path: [                          ] │
│                                             │
│ Webhook URL: [Generated URL with copy]     │
│                                             │
│ HTTP Method: [POST ▼]                       │
│                                             │
│ Response Mode: [Immediately ▼]              │
│                                             │
│ Response Data: [First Entry JSON ▼]        │
│                                             │
├─────────────────────────────────────────────┤
│ ▼ Options (3)                               │
│ ├─────────────────────────────────────────┤ │
│ │ Allowed Origins (CORS)                  │ │
│ │ [https://example.com              ]     │ │
│ │ Remove                                  │ │
│ ├─────────────────────────────────────────┤ │
│ │ Ignore Bots                             │ │
│ │ ☑ Ignore requests from bots             │ │
│ │ Remove                                  │ │
│ ├─────────────────────────────────────────┤ │
│ │ IP(s) Whitelist                         │ │
│ │ [192.168.1.1, 10.0.0.0/8          ]     │ │
│ │ Remove                                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+ Add Option ▼]                            │
│   ├─ Binary Property                        │
│   ├─ No Response Body                       │
│   ├─ Raw Body                               │
│   ├─ Response Content-Type                  │
│   ├─ Response Headers                       │
│   └─ Property Name                          │
│                                             │
└─────────────────────────────────────────────┘
```

## Option Types

### 1. Simple Text Fields
- **Allowed Origins (CORS)**
- **Binary Property**
- **IP(s) Whitelist**
- **Custom Content-Type**
- **Property Name**

### 2. Boolean Fields
- **Ignore Bots** - Checkbox
- **No Response Body** - Checkbox
- **Raw Body** - Checkbox

### 3. Dropdown Fields
- **Response Content-Type** - Select with options (JSON, Text, HTML, XML, Custom)

### 4. Complex Fields
- **Response Headers** - FixedCollection with repeating Name/Value pairs

## User Flow

### Adding an Option
1. Click "Add Option" dropdown
2. See list of available options with descriptions
3. Select an option
4. Option appears in the expanded section
5. Configure the option value
6. Option is removed from the dropdown

### Removing an Option
1. Click "Remove" button next to the option
2. Option disappears from the section
3. Option becomes available in the dropdown again
4. Value is cleared from the configuration

### Collapsing/Expanding
1. Click the header "▼ Options (3)"
2. Section collapses to save space
3. Header shows "▶ Options (3)" when collapsed
4. Click again to expand

## Example Configurations

### Example 1: Secure API Webhook
```
Options (3):
  ├─ Allowed Origins (CORS): https://app.example.com
  ├─ IP(s) Whitelist: 192.168.1.0/24
  └─ Ignore Bots: ☑
```

### Example 2: Custom Response Webhook
```
Options (4):
  ├─ Response Content-Type: application/json
  ├─ Response Headers:
  │   ├─ X-Request-ID: {{$json.requestId}}
  │   └─ Cache-Control: no-cache
  ├─ Property Name: data.result
  └─ No Response Body: ☐
```

### Example 3: File Upload Webhook
```
Options (2):
  ├─ Binary Property: uploadedFile
  └─ Raw Body: ☑
```

## Styling Details

### Colors & Spacing
- **Border**: `border-border` (subtle gray)
- **Background**: `bg-background` (white/dark mode aware)
- **Hover**: `hover:bg-accent/50` (subtle highlight)
- **Text**: `text-sm` for labels, `text-xs` for descriptions
- **Spacing**: `space-y-4` between options, `space-y-2` within options

### Icons
- **Expand**: `ChevronDown` (4x4)
- **Collapse**: `ChevronRight` (4x4)
- **Add**: `Plus` (4x4)
- **Remove**: Text button with hover effect

### Responsive Design
- Full width on mobile
- Proper padding and margins
- Touch-friendly button sizes
- Readable text at all sizes

## Accessibility

### Keyboard Navigation
- Tab through all fields
- Enter to expand/collapse
- Arrow keys in dropdowns
- Escape to close dropdowns

### Screen Readers
- Proper labels for all fields
- ARIA attributes on interactive elements
- Descriptive button text
- Field descriptions read aloud

### Visual Indicators
- Required fields marked with *
- Error states with red borders
- Disabled states with reduced opacity
- Focus states with ring outline

## Comparison with n8n

| Feature | n8n | Your Implementation | Match |
|---------|-----|---------------------|-------|
| Collapsible section | ✅ | ✅ | ✅ |
| Add option dropdown | ✅ | ✅ | ✅ |
| Remove individual options | ✅ | ✅ | ✅ |
| Option descriptions | ✅ | ✅ | ✅ |
| Count indicator | ✅ | ✅ | ✅ |
| Shadcn/ui components | ❌ | ✅ | Better |
| Dark mode support | ✅ | ✅ | ✅ |

## Technical Implementation

### Component Structure
```typescript
CollectionField
├─ Header (collapsible)
│  ├─ ChevronDown/Right icon
│  └─ "Options (count)" text
├─ Selected Options (when expanded)
│  └─ For each selected option:
│     ├─ Label with Remove button
│     ├─ FieldRenderer (recursive)
│     └─ Description text
└─ Add Option Select
   └─ Available options dropdown
```

### State Management
```typescript
- isExpanded: boolean (collapse/expand state)
- selectedOptions: Set<string> (tracks which options are added)
- value: Record<string, any> (actual option values)
```

### Value Format
```typescript
{
  allowedOrigins: "https://example.com",
  ignoreBots: true,
  ipWhitelist: "192.168.1.0/24",
  responseHeaders: {
    entries: [
      { name: "X-Custom", value: "value" }
    ]
  }
}
```

## Best Practices

### For Users
1. Start with security options (CORS, IP whitelist)
2. Add response customization as needed
3. Use descriptions to understand each option
4. Test webhooks after configuration changes

### For Developers
1. Keep option list organized by category
2. Provide clear descriptions for each option
3. Use appropriate field types (text, boolean, select)
4. Validate values before saving
5. Show helpful error messages

## Future Enhancements

### Potential Improvements
1. **Search in dropdown** - Filter options by name
2. **Option categories** - Group related options
3. **Presets** - Quick configurations (Secure, Public, Custom)
4. **Validation hints** - Show format examples
5. **Copy/paste** - Share configurations between webhooks
6. **Templates** - Save common configurations

### Advanced Features
1. **Conditional options** - Show/hide based on other settings
2. **Option dependencies** - Auto-enable related options
3. **Bulk actions** - Add/remove multiple options
4. **Import/export** - JSON configuration
5. **Documentation links** - Help for each option

## Conclusion

The webhook options UI now provides:
- ✅ Clean, professional appearance
- ✅ Intuitive add/remove workflow
- ✅ Consistent with shadcn/ui design system
- ✅ Better UX than native HTML select
- ✅ Full feature parity with n8n
- ✅ Accessible and responsive
- ✅ Easy to extend with new options

The implementation uses modern React patterns and shadcn/ui components for a polished, production-ready experience.
