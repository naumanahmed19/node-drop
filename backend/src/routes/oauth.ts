import axios from "axios";
import { Response, Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { CredentialService } from "../services/CredentialService";
import { AppError } from "../utils/errors";
import { getProviderConfig, getScopesForService } from "../oauth/providers";
import { refreshOAuthToken } from "../oauth/utils/tokenRefresh";

const router = Router();

// Use global credential service instance (shared with core credentials)
const getCredentialService = () => {
  if (!global.credentialService) {
    throw new Error("CredentialService not initialized");
  }
  return global.credentialService;
};

/**
 * GET /api/oauth/:provider/authorize
 * Generic authorization endpoint for any OAuth provider
 */
router.get(
  "/:provider/authorize",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { provider } = req.params;
    const {
      credentialId,
      clientId: queryClientId,
      clientSecret: queryClientSecret,
      credentialName,
      credentialType,
      serviceId,
    } = req.query;

    // Get provider configuration
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
    }

    let clientId: string;

    if (credentialId) {
      // Editing existing credential - get from database
      const credential = await getCredentialService().getCredential(
        credentialId as string,
        req.user!.id
      );

      if (!credential) {
        throw new AppError("Credential not found", 404);
      }

      clientId = credential.data.clientId;
      if (!clientId) {
        throw new AppError("Client ID not found in credential", 400);
      }
    } else {
      // New credential - use provided clientId
      if (!queryClientId || !queryClientSecret) {
        throw new AppError(
          "Client ID and Client Secret are required for new credentials",
          400
        );
      }
      clientId = queryClientId as string;
    }

    // Build callback URL
    const callbackUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/oauth/callback`;

    // Determine credential type and scopes
    const finalCredentialType = (credentialType as string) || `${provider}OAuth2`;
    
    // Check if user specified custom scopes or service selection
    let scopes: string[];
    const selectedService = req.query.services as string;
    const useCustomScopes = req.query.useCustomScopes === 'true';
    
    if (useCustomScopes && req.query.customScopes) {
      // User enabled custom scopes and provided them
      scopes = (req.query.customScopes as string).split(',').map(s => s.trim());
    } else if (selectedService) {
      // User selected a predefined service
      scopes = getScopesForService(provider, selectedService);
    } else {
      // Fallback to credential type or default
      const finalServiceId = (serviceId as string) || finalCredentialType;
      scopes = getScopesForService(provider, finalServiceId);
    }
    
    // Validate that we have scopes
    if (!scopes || scopes.length === 0) {
      throw new AppError(
        'No scopes configured. Please select a service or provide custom scopes.',
        400
      );
    }

    // Encode credential data in state parameter
    const stateData = {
      provider,
      credentialId: credentialId as string | undefined,
      clientId: queryClientId as string | undefined,
      clientSecret: queryClientSecret as string | undefined,
      credentialName: credentialName as string | undefined,
      credentialType: finalCredentialType,
      serviceId: (serviceId as string) || selectedService || finalCredentialType,
      userId: req.user!.id,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    // Build authorization URL with all required parameters
    const authUrl = new URL(providerConfig.authorizationUrl);
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", callbackUrl);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", scopes.join(" "));
    authUrl.searchParams.append("access_type", "offline"); // To get refresh token
    authUrl.searchParams.append("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.append("state", state); // Pass encoded state

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl.toString(),
        callbackUrl,
        provider: providerConfig.name,
        scopes,
      },
    });
  })
);

/**
 * POST /api/oauth/:provider/callback
 * Generic callback endpoint for any OAuth provider
 */
router.post(
  "/:provider/callback",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { provider } = req.params;
    const { code, state } = req.body;

    if (!code || !state) {
      throw new AppError("Authorization code and state are required", 400);
    }

    // Get provider configuration
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
    }

    // Decode state to get credential info
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch (error) {
      throw new AppError("Invalid state parameter", 400);
    }

    const {
      credentialId,
      clientId,
      clientSecret,
      credentialName,
      credentialType,
      userId,
    } = stateData;

    // Verify user matches
    if (userId !== req.user!.id) {
      throw new AppError("User mismatch", 403);
    }

    let finalClientId: string;
    let finalClientSecret: string;
    let isNewCredential = false;

    if (credentialId) {
      // Editing existing credential - get from database
      const credential = await getCredentialService().getCredential(
        credentialId,
        req.user!.id
      );

      if (!credential) {
        throw new AppError("Credential not found", 404);
      }

      finalClientId = credential.data.clientId;
      finalClientSecret = credential.data.clientSecret;
    } else {
      // New credential - use from state
      if (!clientId || !clientSecret) {
        throw new AppError("Client ID and Client Secret are required", 400);
      }
      finalClientId = clientId;
      finalClientSecret = clientSecret;
      isNewCredential = true;
    }

    const callbackUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/oauth/callback`;

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await axios.post(
        providerConfig.tokenUrl,
        {
          code,
          client_id: finalClientId,
          client_secret: finalClientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...providerConfig.additionalHeaders,
          },
        }
      );

      const { access_token, refresh_token, expires_in, token_type } =
        tokenResponse.data;

      let finalCredential;

      try {
        if (isNewCredential) {
          // Create new credential with all data including tokens
          const defaultName =
            credentialName ||
            `${providerConfig.name} OAuth2 - ${new Date().toLocaleDateString()}`;

          finalCredential = await getCredentialService().createCredential(
            req.user!.id,
            defaultName,
            credentialType || `${provider}OAuth2`,
            {
              clientId: finalClientId,
              clientSecret: finalClientSecret,
              accessToken: access_token,
              refreshToken: refresh_token,
              tokenType: token_type,
              expiresIn: expires_in,
              tokenObtainedAt: new Date().toISOString(),
            }
          );
        } else {
          // Update existing credential with tokens
          const existingCredential = await getCredentialService().getCredential(
            credentialId,
            req.user!.id
          );

          finalCredential = await getCredentialService().updateCredential(
            credentialId,
            req.user!.id,
            {
              data: {
                ...existingCredential!.data,
                accessToken: access_token,
                refreshToken:
                  refresh_token || existingCredential!.data.refreshToken,
                tokenType: token_type,
                expiresIn: expires_in,
                tokenObtainedAt: new Date().toISOString(),
              },
            }
          );
        }
      } catch (credentialError: any) {
        console.error("OAuth credential save error:", credentialError.message);
        throw credentialError;
      }

      res.json({
        success: true,
        data: {
          message: `Successfully authenticated with ${providerConfig.name}`,
          credential: finalCredential,
          expiresIn: expires_in,
        },
      });
    } catch (error: any) {
      console.error("OAuth callback error:", error);

      if (error.response?.data) {
        throw new AppError(
          `Failed to exchange authorization code: ${
            error.response.data.error_description ||
            error.response.data.error ||
            error.message
          }`,
          400
        );
      }

      throw error;
    }
  })
);

/**
 * POST /api/oauth/:provider/refresh
 * Generic token refresh endpoint for any OAuth provider
 */
router.post(
  "/:provider/refresh",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { provider } = req.params;
    const { credentialId } = req.body;

    if (!credentialId) {
      throw new AppError("Credential ID is required", 400);
    }

    // Get provider configuration
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
    }

    // Get credential
    const credential = await getCredentialService().getCredential(
      credentialId,
      req.user!.id
    );

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    const { clientId, clientSecret, refreshToken: oldRefreshToken } = credential.data;
    if (!clientId || !clientSecret || !oldRefreshToken) {
      throw new AppError(
        "Client ID, Client Secret, and Refresh Token are required",
        400
      );
    }

    try {
      // Use the centralized refresh utility
      const tokens = await refreshOAuthToken(
        provider,
        oldRefreshToken,
        clientId,
        clientSecret
      );

      // Update credential with new tokens
      const updatedCredential = await getCredentialService().updateCredential(
        credentialId,
        req.user!.id,
        {
          data: {
            ...credential.data,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenType: tokens.tokenType,
            expiresIn: tokens.expiresIn,
            tokenObtainedAt: new Date().toISOString(),
          },
        }
      );

      res.json({
        success: true,
        data: {
          message: "Token refreshed successfully",
          credentialId: updatedCredential.id,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (error: any) {
      console.error("OAuth token refresh error:", error.message);
      throw new AppError(`Failed to refresh token: ${error.message}`, 400);
    }
  })
);

/**
 * GET /api/oauth/:provider/status/:credentialId
 * Check the OAuth2 token status for any provider
 */
router.get(
  "/:provider/status/:credentialId",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { credentialId } = req.params;

    const credential = await getCredentialService().getCredential(
      credentialId,
      req.user!.id
    );

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    const { accessToken, refreshToken, expiresIn, tokenObtainedAt } =
      credential.data;

    const isConfigured = !!(accessToken && refreshToken);
    let isExpired = false;
    let expiresAt = null;

    if (tokenObtainedAt && expiresIn) {
      const obtainedDate = new Date(tokenObtainedAt);
      expiresAt = new Date(obtainedDate.getTime() + expiresIn * 1000);
      isExpired = new Date() > expiresAt;
    }

    res.json({
      success: true,
      data: {
        isConfigured,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        isExpired,
        expiresAt,
        needsReauthorization: !accessToken || (!refreshToken && isExpired),
      },
    });
  })
);

export default router;
