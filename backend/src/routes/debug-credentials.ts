/**
 * Debug endpoint to check credential registration
 * Remove this file in production
 */
import { Router } from "express";

const router = Router();

router.get("/debug/oauth-sessions", (req, res) => {
  try {
    // Access the pendingOAuthSessions from oauth-generic route
    // This is a hack for debugging - in production use Redis
    const sessions = Array.from((global as any).pendingOAuthSessions?.entries() || []).map(([state, session]: [string, any]) => ({
      state: state.substring(0, 16) + '...',
      provider: session.provider,
      credentialType: session.credentialType,
      expiresAt: new Date(session.expiresAt).toISOString(),
      expired: Date.now() > session.expiresAt
    }))

    res.json({
      success: true,
      sessionCount: sessions.length,
      sessions
    })
  } catch (error: any) {
    res.json({
      error: error.message,
      stack: error.stack
    })
  }
})

router.get("/debug/credentials", (req, res) => {
  try {
    const credentialService = global.credentialService;
    
    if (!credentialService) {
      return res.json({
        error: "CredentialService not initialized"
      });
    }

    const types = credentialService.getCredentialTypes();
    
    // Calculate the OAuth callback URL
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
    const oauthCallbackUrl = `${backendUrl}/api/oauth/callback`;
    
    res.json({
      success: true,
      totalCount: types.length,
      environment: {
        frontendUrl: process.env.FRONTEND_URL || "NOT SET",
        backendUrl: process.env.BACKEND_URL || "NOT SET",
        port: process.env.PORT || "NOT SET",
        calculatedBackendUrl: backendUrl,
        oauthCallbackUrl: oauthCallbackUrl
      },
      credentials: types.map(t => ({
        name: t.name,
        displayName: t.displayName,
        oauthProvider: t.oauthProvider || null,
        hasTestFunction: !!t.test,
        propertyCount: t.properties?.length || 0
      })),
      oauthCredentials: types.filter(t => t.oauthProvider).map(t => {
        const callbackUrlProp = t.properties.find(p => p.name === 'oauthCallbackUrl');
        return {
          name: t.name,
          displayName: t.displayName,
          provider: t.oauthProvider,
          callbackUrl: callbackUrlProp?.default || callbackUrlProp?.placeholder || 'NOT SET'
        };
      }),
      instructions: {
        message: "Add this URL to your OAuth app's authorized redirect URIs:",
        url: oauthCallbackUrl,
        googleConsole: "https://console.cloud.google.com/apis/credentials",
        microsoftAzure: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
      }
    });
  } catch (error: any) {
    res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
