import { Router, Response } from "express"
import { oauthProviderRegistry } from "../oauth/OAuthProviderRegistry"
import { CredentialService } from "../services/CredentialService"
import { AppError } from "../utils/errors"
import { logger } from "../utils/logger"
import * as crypto from "crypto"
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth"

const router = Router()
// Use the global credential service instance (has core credentials registered)
const getCredentialService = () => global.credentialService

// Store pending OAuth sessions (in production, use Redis)
const pendingOAuthSessions = new Map<string, {
  provider: string
  clientId: string
  clientSecret: string
  credentialName: string
  credentialType: string
  userId: string
  scopes?: string[]
  expiresAt: number
}>()

// Expose for debugging (remove in production)
;(global as any).pendingOAuthSessions = pendingOAuthSessions

/**
 * Generic OAuth authorization endpoint
 * Works with any registered OAuth provider
 */
router.get("/oauth/:provider/authorize", authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { provider } = req.params
    const { clientId, clientSecret, credentialName, credentialType, credentialId, services, useCustomScopes, customScopes } = req.query

    // Get OAuth provider
    const oauthProvider = oauthProviderRegistry.get(provider)
    if (!oauthProvider) {
      throw new AppError(`OAuth provider '${provider}' not found`, 400)
    }

    // Get user ID from authenticated request
    const userId = req.user!.id

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString("hex")

    // Determine scopes
    let scopes = oauthProvider.scopes
    if (useCustomScopes === "true" && customScopes) {
      scopes = (customScopes as string).split(",").map(s => s.trim())
    } else if (services) {
      // Service-specific scopes (for Google, Microsoft, etc.)
      scopes = getScopesForService(provider, services as string)
    }

    // Store session data
    const sessionData = {
      provider,
      clientId: clientId as string,
      clientSecret: clientSecret as string,
      credentialName: credentialName as string || `${oauthProvider.displayName} - ${new Date().toLocaleDateString()}`,
      credentialType: credentialType as string,
      userId,
      scopes,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    }
    pendingOAuthSessions.set(state, sessionData)
    
    logger.info(`OAuth session created`, {
      state,
      provider,
      credentialType: credentialType as string,
      sessionCount: pendingOAuthSessions.size
    })

    // Build redirect URI - frontend callback URL (frontend handles the OAuth popup)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
    const redirectUri = `${frontendUrl}/oauth/callback`

    // Get authorization URL
    const authorizationUrl = oauthProvider.getAuthorizationUrl({
      clientId: clientId as string,
      redirectUri,
      state,
      scopes,
    })

    res.json({
      success: true,
      data: {
        authorizationUrl,
        callbackUrl: redirectUri, // Return the backend callback URL for user to add to OAuth app
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * OAuth callback endpoint - NOT USED
 * Google/Microsoft redirect to the FRONTEND /oauth/callback page
 * The frontend then POSTs to /oauth/:provider/callback with the code
 */

/**
 * Backend endpoint to exchange OAuth code for tokens
 * Called by the frontend after receiving the code from OAuth provider
 */
router.post("/oauth/:provider/callback", async (req, res, next) => {
  try {
    const { provider } = req.params
    const { code, state } = req.body

    logger.info(`OAuth callback received`, {
      provider,
      hasCode: !!code,
      hasState: !!state,
      stateLength: state?.length,
      sessionCount: pendingOAuthSessions.size,
      availableStates: Array.from(pendingOAuthSessions.keys()).map(s => s.substring(0, 8) + '...')
    })

    if (!code || !state) {
      throw new AppError("Missing authorization code or state", 400)
    }

    // Get OAuth provider
    const oauthProvider = oauthProviderRegistry.get(provider)
    if (!oauthProvider) {
      throw new AppError(`OAuth provider '${provider}' not found`, 400)
    }

    // Retrieve session data
    const session = pendingOAuthSessions.get(state)
    if (!session) {
      logger.error(`OAuth session not found`, {
        state: state.substring(0, 8) + '...',
        sessionCount: pendingOAuthSessions.size
      })
      throw new AppError("Invalid or expired OAuth session", 400)
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      pendingOAuthSessions.delete(state)
      throw new AppError("OAuth session expired", 400)
    }

    // Don't delete session yet - only delete after successful credential creation
    // This prevents issues with duplicate requests

    // Exchange code for tokens - must match the redirectUri used in authorization
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
    const redirectUri = `${frontendUrl}/oauth/callback`
    const tokens = await oauthProvider.exchangeCodeForTokens({
      code,
      clientId: session.clientId,
      clientSecret: session.clientSecret,
      redirectUri,
    })

    // Create credential
    const credentialData = {
      clientId: session.clientId,
      clientSecret: session.clientSecret,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType || "Bearer",
      expiresIn: tokens.expiresIn,
    }

    const credential = await getCredentialService().createCredential(
      session.userId,
      session.credentialName,
      session.credentialType,
      credentialData
    )

    // Clean up session after successful credential creation
    pendingOAuthSessions.delete(state)
    
    logger.info(`OAuth credential created successfully`, {
      credentialId: credential.id,
      provider,
      credentialType: session.credentialType
    })

    // Return success response to frontend
    res.json({
      success: true,
      data: {
        credential
      }
    })
  } catch (error) {
    logger.error("OAuth callback error:", error)
    next(error)
  }
})

/**
 * Refresh OAuth token
 * POST /oauth/:provider/refresh
 */
router.post("/:provider/refresh", async (req, res, next) => {
  try {
    const { provider } = req.params
    const { credentialId } = req.body

    if (!credentialId) {
      throw new AppError("Credential ID is required", 400)
    }

    // Get OAuth provider
    const oauthProvider = oauthProviderRegistry.get(provider)
    if (!oauthProvider) {
      throw new AppError(`OAuth provider '${provider}' not found`, 400)
    }

    // Check if provider supports token refresh
    if (!oauthProvider.refreshAccessToken) {
      throw new AppError(`Provider '${provider}' does not support token refresh`, 400)
    }

    // Get credential
    const credentialService = global.credentialService
    if (!credentialService) {
      throw new AppError("Credential service not initialized", 500)
    }

    const credential = await credentialService.getCredential(credentialId, "default-user") // TODO: Get user from auth
    if (!credential) {
      throw new AppError("Credential not found", 404)
    }

    const { clientId, clientSecret, refreshToken } = credential.data
    if (!clientId || !clientSecret || !refreshToken) {
      throw new AppError("Missing required credential data for token refresh", 400)
    }

    // Refresh the token
    const tokens = await oauthProvider.refreshAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    })

    // Update credential with new tokens
    const updatedData = {
      ...credential.data,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || refreshToken, // Use new refresh token if provided
      expiresIn: tokens.expiresIn,
      tokenObtainedAt: new Date().toISOString(),
    }

    await credentialService.updateCredential(credentialId, "default-user", { data: updatedData })

    res.json({
      success: true,
      data: {
        message: "Token refreshed successfully",
        expiresIn: tokens.expiresIn,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Get service-specific scopes
 */
function getScopesForService(provider: string, service: string): string[] {
  if (provider === "google") {
    const scopeMap: Record<string, string[]> = {
      gmail: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      drive: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      "google-drive": [ // Alias for drive
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      sheets: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      calendar: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      all: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
    }
    return scopeMap[service] || scopeMap.gmail
  }

  if (provider === "microsoft") {
    const scopeMap: Record<string, string[]> = {
      outlook: ["Mail.Read", "Mail.Send", "User.Read", "offline_access"],
      onedrive: ["Files.ReadWrite.All", "User.Read", "offline_access"],
      calendar: ["Calendars.ReadWrite", "User.Read", "offline_access"],
      all: ["Mail.ReadWrite", "Files.ReadWrite.All", "Calendars.ReadWrite", "User.Read", "offline_access"],
    }
    return scopeMap[service] || scopeMap.outlook
  }

  if (provider === "slack") {
    const scopeMap: Record<string, string[]> = {
      basic: ["chat:write", "channels:read", "users:read"],
      messaging: ["chat:write", "chat:write.public", "channels:read", "channels:history", "users:read"],
      admin: ["chat:write", "channels:read", "channels:manage", "users:read", "users:write", "team:read"],
      all: ["chat:write", "chat:write.public", "channels:read", "channels:history", "channels:manage", "users:read", "users:write", "team:read", "files:read", "files:write"],
    }
    return scopeMap[service] || scopeMap.basic
  }

  // Default scopes
  return oauthProviderRegistry.get(provider)?.scopes || []
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [state, session] of pendingOAuthSessions.entries()) {
    if (now > session.expiresAt) {
      pendingOAuthSessions.delete(state)
    }
  }
}, 60 * 1000) // Every minute

export default router
