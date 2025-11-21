# OAuth System Documentation

This folder contains the complete OAuth authentication system for Node-Drop, including credential types, OAuth providers, and the infrastructure for dynamic provider registration from custom nodes.

## 📁 Folder Structure

```
backend/src/oauth/
├── credentials/                        # Core credential type definitions
│   ├── GoogleOAuth2.credentials.ts     # Google OAuth2 credential
│   ├── MicrosoftOAuth2.credentials.ts  # Microsoft OAuth2 credential
│   ├── ApiKey.credentials.ts           # Generic API Key credential
│   ├── HttpBasicAuth.credentials.ts    # HTTP Basic Auth credential
│   ├── OAuth2.credentials.ts           # Generic OAuth2 credential
│   └── index.ts                        # Exports all core credentials
│
├── providers/                          # OAuth provider implementations
│   ├── GoogleOAuthProvider.ts          # Google OAuth flow handler
│   ├── MicrosoftOAuthProvider.ts       # Microsoft OAuth flow handler
│   └── GitHubOAuthProvider.ts          # GitHub OAuth flow handler
│
├── OAuthProviderRegistry.ts            # Dynamic provider registry
└── index.ts                            # Main exports & initialization
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│  User clicks "Sign in with Google/Microsoft/Slack"              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OAuth Routes                                 │
│  /api/oauth/:provider/authorize  ← Start OAuth flow             │
│  /api/oauth/:provider/callback   ← Handle OAuth callback        │
│  /api/oauth/:provider/refresh    ← Refresh expired tokens       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              OAuthProviderRegistry                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Google     │  │  Microsoft   │  │    Slack     │           │
│  │   Provider   │  │   Provider   │  │   Provider   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│         ▲                  ▲                  ▲                 │
│         │                  │                  │                 │
│    Core Provider      Core Provider    Custom Node Provider     │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CredentialService                              │
│  Stores encrypted credentials in database                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Google Cred  │  │ Microsoft    │  │  Slack Cred  │           │
│  │   Type       │  │  Cred Type   │  │    Type      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 🔑 Core Concepts

### 1. Credential Types
Define **what fields** a credential needs (Client ID, Client Secret, etc.)

**Location:** `credentials/*.credentials.ts`

**Example:**
```typescript
export const GoogleOAuth2Credentials: CredentialType = {
  name: "googleOAuth2",
  displayName: "Google OAuth2",
  oauthProvider: "google", // ← Links to OAuth provider
  properties: [
    { name: "clientId", type: "string", required: true },
    { name: "clientSecret", type: "password", required: true },
  ],
  async test(data) {
    // Test if credentials work
  }
}
```

### 2. OAuth Providers
Define **how to perform** the OAuth flow (authorization, token exchange, refresh)

**Location:** `providers/*.ts`

**Example:**
```typescript
export const GoogleOAuthProvider: OAuthProvider = {
  name: "google",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  scopes: ["email", "profile"],
  
  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    // Build authorization URL
  },
  
  async exchangeCodeForTokens({ code, clientId, clientSecret }) {
    // Exchange code for access token
  },
  
  async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    // Refresh expired token
  }
}
```

### 3. Provider Registry
Dynamically registers and manages OAuth providers

**Location:** `OAuthProviderRegistry.ts`

```typescript
// Register a provider
oauthProviderRegistry.register(GoogleOAuthProvider)

// Get a provider
const provider = oauthProviderRegistry.get("google")

// List all providers
const allProviders = oauthProviderRegistry.getAll()
```

## 🚀 OAuth Flow

### Step 1: User Initiates OAuth
```
User clicks "Sign in with Google"
  ↓
Frontend: POST /api/oauth/google/authorize
  ↓
Backend: Get Google provider from registry
  ↓
Backend: Generate authorization URL
  ↓
Frontend: Open popup with authorization URL
```

### Step 2: User Authorizes
```
User approves in Google popup
  ↓
Google redirects to: /oauth/callback?code=abc123&state=xyz
  ↓
Frontend: POST /api/oauth/google/callback with code
```

### Step 3: Token Exchange
```
Backend: Get Google provider from registry
  ↓
Backend: provider.exchangeCodeForTokens(code)
  ↓
Backend: Store encrypted tokens in database
  ↓
Frontend: Credential created! ✅
```

### Step 4: Token Refresh (Automatic)
```
Workflow execution needs credential
  ↓
Check: Is token expired?
  ↓
Yes → Get provider from registry
  ↓
provider.refreshAccessToken(refreshToken)
  ↓
Update credential in database
  ↓
Continue execution with fresh token ✅
```

## 📦 Adding a New Core OAuth Provider

### Example: Adding Facebook OAuth

#### 1. Create Provider Implementation

**File:** `providers/FacebookOAuthProvider.ts`

```typescript
import axios from "axios"
import { OAuthProvider } from "../OAuthProviderRegistry"

export const FacebookOAuthProvider: OAuthProvider = {
  name: "facebook",
  displayName: "Facebook",
  authorizationEndpoint: "https://www.facebook.com/v12.0/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/v12.0/oauth/access_token",
  scopes: ["email", "public_profile"],
  icon: "🔵",
  color: "#1877F2",

  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: (scopes || this.scopes).join(","),
    })
    return `${this.authorizationEndpoint}?${params.toString()}`
  },

  async exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
    const response = await axios.get(this.tokenEndpoint, {
      params: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
    })
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    }
  },

  async testConnection({ accessToken }) {
    const response = await axios.get("https://graph.facebook.com/me", {
      params: { access_token: accessToken, fields: "id,name,email" },
    })
    return {
      success: true,
      message: `Connected as ${response.data.name}`,
      userInfo: response.data,
    }
  },
}
```

#### 2. Create Credential Type

**File:** `credentials/FacebookOAuth2.credentials.ts`

```typescript
import type { CredentialType, CredentialData } from "../../services/CredentialService"

export const FacebookOAuth2Credentials: CredentialType = {
  name: "facebookOAuth2",
  displayName: "Facebook OAuth2",
  description: "OAuth2 for Facebook",
  icon: "🔵",
  color: "#1877F2",
  testable: true,
  oauthProvider: "facebook", // ← Links to provider
  
  properties: [
    {
      displayName: "App ID",
      name: "clientId",
      type: "string",
      required: true,
    },
    {
      displayName: "App Secret",
      name: "clientSecret",
      type: "password",
      required: true,
    },
    {
      displayName: "OAuth Redirect URL",
      name: "oauthCallbackUrl",
      type: "string",
      readonly: true,
      default: `${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth/callback`,
    },
  ],

  async test(data: CredentialData) {
    if (!data.accessToken) {
      return {
        success: true,
        message: "Complete OAuth2 authorization to test"
      }
    }
    // Test logic here
  }
}
```

#### 3. Register Provider

**File:** `index.ts`

```typescript
import { FacebookOAuthProvider } from "./providers/FacebookOAuthProvider"

export function initializeOAuthProviders(): void {
  oauthProviderRegistry.register(GoogleOAuthProvider)
  oauthProviderRegistry.register(MicrosoftOAuthProvider)
  oauthProviderRegistry.register(GitHubOAuthProvider)
  oauthProviderRegistry.register(FacebookOAuthProvider) // ← Add this
}
```

#### 4. Export Credential Type

**File:** `credentials/index.ts`

```typescript
import { FacebookOAuth2Credentials } from "./FacebookOAuth2.credentials"

export const CoreCredentials = [
  GoogleOAuth2Credentials,
  MicrosoftOAuth2Credentials,
  FacebookOAuth2Credentials, // ← Add this
  // ...
]
```

#### 5. Done! ✅

Restart backend and Facebook OAuth2 will appear in the credentials UI!

## 🔌 Adding OAuth from Custom Nodes

Custom nodes can register their own OAuth providers **without modifying core code**.

### Example: Slack OAuth in Custom Node

#### File Structure:
```
backend/custom-nodes/slack/
├── credentials/
│   └── SlackOAuth2.credentials.js      # Credential definition
├── oauth/
│   └── SlackOAuthProvider.js           # OAuth provider
├── nodes/
│   └── slack.node.js                   # Slack nodes
├── package.json                         # Declares credentials & providers
└── index.js                             # Exports everything
```

#### 1. Create OAuth Provider

**File:** `oauth/SlackOAuthProvider.js`

```javascript
const axios = require("axios")

module.exports = {
  name: "slack",
  displayName: "Slack",
  authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
  tokenEndpoint: "https://slack.com/api/oauth.v2.access",
  scopes: ["chat:write", "channels:read"],
  
  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    // Implementation
  },
  
  async exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
    // Implementation
  },
  
  async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    // Implementation
  }
}
```

#### 2. Create Credential Type

**File:** `credentials/SlackOAuth2.credentials.js`

```javascript
module.exports = {
  name: "slackOAuth2",
  displayName: "Slack OAuth2",
  oauthProvider: "slack", // ← Links to provider
  properties: [
    { name: "clientId", type: "string", required: true },
    { name: "clientSecret", type: "password", required: true },
  ],
  async test(data) {
    // Test implementation
  }
}
```

#### 3. Declare in package.json

**File:** `package.json`

```json
{
  "name": "@node-drop/slack-nodes",
  "nodeDrop": {
    "nodes": ["nodes/slack.node.js"],
    "credentials": ["credentials/SlackOAuth2.credentials.js"],
    "oauthProviders": ["oauth/SlackOAuthProvider.js"]
  }
}
```

#### 4. Export from index.js

**File:** `index.js`

```javascript
const SlackNode = require("./nodes/slack.node")
const SlackOAuth2Credentials = require("./credentials/SlackOAuth2.credentials")
const SlackOAuthProvider = require("./oauth/SlackOAuthProvider")

module.exports = {
  nodes: [SlackNode],
  credentials: [SlackOAuth2Credentials],
  oauthProviders: [SlackOAuthProvider],
}
```

#### 5. Automatic Registration! ✅

When the custom node is loaded:
1. **NodeLoader** reads `package.json`
2. Registers OAuth provider → `oauthProviderRegistry.register(SlackOAuthProvider)`
3. Registers credential type → `credentialService.registerCredentialType(SlackOAuth2Credentials)`
4. Slack OAuth2 appears in UI automatically!

## 🔄 Token Refresh

Tokens are automatically refreshed in two ways:

### 1. During Workflow Execution
```typescript
// In SecureExecutionService
if (this.shouldRefreshToken(credentialData)) {
  const provider = oauthProviderRegistry.get(credentialType.oauthProvider)
  const tokens = await provider.refreshAccessToken({...})
  // Update credential in database
}
```

### 2. Manual Refresh via API
```bash
POST /api/oauth/:provider/refresh
{
  "credentialId": "credential-id"
}
```

## 🎯 Key Benefits

### ✅ Modular
- Each provider is independent
- Easy to add/remove providers
- No core code changes needed

### ✅ Extensible
- Custom nodes can add OAuth providers
- Providers loaded dynamically at runtime
- Unlimited providers supported

### ✅ Type-Safe
- Full TypeScript support
- Interface-driven design
- Compile-time checks

### ✅ Scalable
- Registry pattern for dynamic loading
- No hardcoded provider lists
- Works with 1000+ providers

### ✅ Maintainable
- Single responsibility principle
- Clear separation of concerns
- Easy to test and debug

## 📚 Related Documentation

- **Custom Nodes Guide:** `backend/docs/CUSTOM_CREDENTIALS_GUIDE.md`
- **Slack Setup:** `SLACK_OAUTH_SETUP.md`
- **Quick Start:** `QUICK_START_OAUTH.md`
- **OAuth Routes:** `backend/src/routes/oauth-generic.ts`

## 🐛 Troubleshooting

### Provider Not Found
```
Error: OAuth provider 'slack' not found
```
**Solution:** Check if provider is registered in `index.ts` or custom node package.json

### Token Refresh Failed
```
Error: Provider does not support token refresh
```
**Solution:** Implement `refreshAccessToken()` method in your provider.

### Redirect URI Mismatch
```
Error: redirect_uri_mismatch
```
**Solution:** Add `http://localhost:3000/oauth/callback` to your OAuth app settings.
