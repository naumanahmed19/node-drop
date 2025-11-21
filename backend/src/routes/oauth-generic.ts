import { Router } from "express"
import { oauthProviderRegistry } from "../oauth/OAuthProviderRegistry"
import { CredentialService } from "../services/CredentialService"
import { AppError } from "../utils/errors"
import { logger } from "../utils/logger"
import * as crypto from "crypto"

const router = Router()
const credentialService = new CredentialService()

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

/**
 * Generic OAuth authorization endpoint
 * Works with any registered OAuth provider
 */
router.get("/oauth/:provider/authorize", async (req, res, next) => {
  try {
    const { provider } = req.params
    const { clientId, clientSecret, credentialName, credentialType, credentialId, services, useCustomScopes, customScopes } = req.query

    // Get OAuth provider
    const oauthProvider = oauthProviderRegistry.get(provider)
    if (!oauthProvider) {
      throw new AppError(`OAuth provider '${provider}' not found`, 400)
    }

    // Get user ID from session/auth
    const userId = (req as any).user?.id || "default-user" // TODO: Get from auth middleware

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
    pendingOAuthSessions.set(state, {
      provider,
      clientId: clientId as string,
      clientSecret: clientSecret as string,
      credentialName: credentialName as string || `${oauthProvider.displayName} - ${new Date().toLocaleDateString()}`,
      credentialType: credentialType as string,
      userId,
      scopes,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    })

    // Build redirect URI
    const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth/callback`

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
        callbackUrl: redirectUri,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Generic OAuth callback endpoint
 * Handles the callback from any OAuth provider
 */
router.get("/oauth/:provider/callback", async (req, res, next) => {
  try {
    const { provider } = req.params
    const { code, state, error, error_description } = req.query

    // Handle OAuth errors
    if (error) {
      const errorMessage = error_description || error
      return res.redirect(`${process.env.FRONTEND_URL}/oauth/error?error=${encodeURIComponent(errorMessage as string)}`)
    }

    if (!code || !state) {
      throw new AppError("Missing authorization code or state", 400)
    }

    // Get OAuth provider
    const oauthProvider = oauthProviderRegistry.get(provider)
    if (!oauthProvider) {
      throw new AppError(`OAuth provider '${provider}' not found`, 400)
    }

    // Retrieve session data
    const session = pendingOAuthSessions.get(state as string)
    if (!session) {
      throw new AppError("Invalid or expired OAuth session", 400)
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      pendingOAuthSessions.delete(state as string)
      throw new AppError("OAuth session expired", 400)
    }

    // Clean up session
    pendingOAuthSessions.delete(state as string)

    // Exchange code for tokens
    const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth/callback`
    const tokens = await oauthProvider.exchangeCodeForTokens({
      code: code as string,
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

    const credential = await credentialService.createCredential(
      session.userId,
      session.credentialName,
      session.credentialType,
      credentialData
    )

    // Redirect to success page
    res.redirect(`${process.env.FRONTEND_URL}/oauth/success?credentialId=${credential.id}`)
  } catch (error) {
    logger.error("OAuth callback error:", error)
    const errorMessage = error instanceof Error ? error.message : "OAuth authentication failed"
    res.redirect(`${process.env.FRONTEND_URL}/oauth/error?error=${encodeURIComponent(errorMessage)}`)
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
