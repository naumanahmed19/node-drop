# Credential Context-Specific Defaults Implementation

## Overview
Implemented a simplified system where credential forms automatically fetch and apply node-specific defaults and display names when opened from a node context (e.g., Gmail node). Fields with node-specific values are shown as **readonly/disabled** for transparency.

## How It Works

### 1. Backend API Enhancement
**File**: `backend/src/routes/credentials.ts`

The `/api/credentials/types/:typeName/defaults` endpoint now:
- Accepts a `nodeType` query parameter
- Fetches the node definition to extract credential configuration
- Returns context-specific `displayName`, default property values, and **hidden fields**

**Example Request**:
```
GET /api/credentials/types/googleOAuth2/defaults?nodeType=gmail
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "credentialType": {
      "name": "googleOAuth2",
      "displayName": "Gmail Account",  // ← Context-specific!
      "properties": [...]
    },
    "defaults": {
      "services": "gmail"  // ← Auto-set value
    },
    "readonlyFields": ["services"]  // ← Fields to make readonly!
  }
}
```

### 2. Frontend Component Chain

#### FieldRenderer → UnifiedCredentialSelector
**File**: `frontend/src/components/ui/form-generator/FieldRenderer.tsx`
- Passes `nodeType` prop to `UnifiedCredentialSelector`

#### UnifiedCredentialSelector → CredentialModal
**File**: `frontend/src/components/credential/UnifiedCredentialSelector.tsx`
- Receives `nodeType` from parent
- Passes it to `CredentialModal` when creating new credentials

#### CredentialModal → CredentialForm
**File**: `frontend/src/components/credential/CredentialModal.tsx`
- Fetches context-specific displayName on mount
- Updates modal title with contextual name (e.g., "Create Gmail Account")
- Passes `nodeType` to `CredentialForm`

#### CredentialForm
**File**: `frontend/src/components/credential/CredentialForm.tsx`
- Fetches defaults and readonly fields from API when `nodeType` is provided
- Pre-populates form fields with default values
- **Marks readonly fields as disabled** so they're visible but not editable
- Updates header with contextual displayName

## User Experience

### Before
When creating a credential from Gmail node:
```
┌─────────────────────────────────────────────┐
│ Create Google OAuth2                         │
│ [OAuth Redirect URL: ___________]  ← Editable│
│ [Client ID: ___________]                     │
│ [Client Secret: ___________]                 │
│ [Services: ___________]  ← Empty!            │
└─────────────────────────────────────────────┘
```

### After
When creating a credential from Gmail node:
```
┌─────────────────────────────────────────────┐
│ Create Gmail Account  ← Context-specific!    │
│ [Service: Gmail] 🔒 ← Readonly/disabled!    │
│ [Client ID: ___________]                     │
│ [Client Secret: ___________]                 │
│ ☐ Use Custom Scopes (Advanced)              │
│ [OAuth Redirect URL: http://...] [Copy]     │
└─────────────────────────────────────────────┘
```

## Node Configuration Example

In `gmail.node.js`:
```javascript
credentials: [{
  name: "googleOAuth2",
  displayName: "Gmail Account",  // ← Used in credential form
  properties: [
    { 
      name: "services", 
      value: "gmail"  // ← Auto-set and shown as READONLY!
    }
  ],
}]
```

**Key Feature**: When a node sets a credential property value, that field is **automatically made readonly/disabled**. Users can see what's configured but can't change it!

## Benefits

1. **Better UX**: Users see context-appropriate labels ("Gmail Account" vs "Google OAuth2")
2. **Transparent**: Fields with node-specific values are shown but readonly - users can see what's configured
3. **Fewer Errors**: No chance to select wrong service - it's locked to the correct value
4. **Easy Copy**: OAuth Redirect URL is readonly with a copy button
5. **Simpler Code**: No complex hiding logic - just mark fields as readonly
6. **Advanced Option**: "Use Custom Scopes" checkbox for power users
7. **Consistency**: Each node can customize how credentials appear
8. **Flexibility**: Works for any node type and credential combination

## Additional Improvements

### OAuth Redirect URL Field
- **Made readonly**: Users cannot accidentally edit the fixed redirect URL
- **Added copy button**: One-click copy to clipboard for easy setup
- **Visual feedback**: Shows "Copied" confirmation when clicked

### Implementation Details
**Backend** (`backend/src/services/CredentialService.ts`):
- Added `readonly?: boolean` to `CredentialProperty` interface
- Set `readonly: true` for all OAuth redirect URL fields

**Frontend** (`frontend/src/components/ui/form-generator/FieldRenderer.tsx`):
- Enhanced text field rendering to detect readonly fields
- Added copy button with visual feedback for readonly fields
- Uses `navigator.clipboard.writeText()` for copying

## Testing

To test this feature:
1. Open a workflow with a Gmail node
2. Click to add a new credential
3. Observe:
   - Modal title shows "Create Gmail Account"
   - **Service field shows "Gmail" and is disabled** (can't be changed)
   - Shows: Service (disabled), Client ID, Client Secret, Use Custom Scopes checkbox, OAuth Redirect URL
   - OAuth Redirect URL is readonly with a "Copy" button
   - Form header shows "Gmail Account"
4. Click the "Copy" button next to OAuth Redirect URL
5. Verify it shows "Copied" feedback
6. Optionally check "Use Custom Scopes" to specify custom OAuth scopes
7. Complete OAuth flow - the credential will have `services: "gmail"` automatically set

Same for Google Drive node:
- Modal shows "Create Google Drive Account"
- Service field shows "Google Drive" and is disabled
- Credential automatically gets `services: "google-drive"`
