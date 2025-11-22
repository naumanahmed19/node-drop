/**
 * Debug endpoint to check credential registration
 * Remove this file in production
 */
import { Router } from "express";

const router = Router();

router.get("/debug/credentials", (req, res) => {
  try {
    const credentialService = global.credentialService;
    
    if (!credentialService) {
      return res.json({
        error: "CredentialService not initialized"
      });
    }

    const types = credentialService.getCredentialTypes();
    
    res.json({
      success: true,
      totalCount: types.length,
      credentials: types.map(t => ({
        name: t.name,
        displayName: t.displayName,
        oauthProvider: t.oauthProvider || null,
        hasTestFunction: !!t.test,
        propertyCount: t.properties?.length || 0
      })),
      oauthCredentials: types.filter(t => t.oauthProvider).map(t => ({
        name: t.name,
        displayName: t.displayName,
        provider: t.oauthProvider
      }))
    });
  } catch (error: any) {
    res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
