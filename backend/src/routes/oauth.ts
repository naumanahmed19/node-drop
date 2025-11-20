import axios from "axios";
import { Response, Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { CredentialService } from "../services/CredentialService";
import { AppError } from "../utils/errors";

const router = Router();

// Use global credential service instance (shared with core credentials)
const getCredentialService = () => {
  if (!global.credentialService) {
    throw new Error("CredentialService not initialized");
  }
  return global.credentialService;
};

/**
 * Google OAuth2 Configuration
 */
const GOOGLE_OAUTH_CONFIG = {
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: {
    googleOAuth2: [
      // Core credential - comprehensive scopes for all Google services
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    googleSheetsOAuth2: [
      // Legacy credential
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    googleDriveOAuth2: [
      // Legacy credential
      "https://www.googleapis.com/auth/drive",
    ],
  },
};

/**
 * GET /api/oauth/google/authorize
 * Get the authorization URL to redirect user to Google consent screen
 * Now accepts clientId and clientSecret in query params for new credentials
 */
router.get(
  "/google/authorize",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      credentialId,
      clientId: queryClientId,
      clientSecret: queryClientSecret,
      credentialName,
      credentialType,
    } = req.query;

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
    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"
      }/oauth/callback`;

    // Determine credential type and scopes
    const finalCredentialType = credentialType as string || "googleOAuth2";
    const scopes = GOOGLE_OAUTH_CONFIG.scopes[finalCredentialType as keyof typeof GOOGLE_OAUTH_CONFIG.scopes] || GOOGLE_OAUTH_CONFIG.scopes.googleOAuth2;

    // Encode credential data in state parameter
    const stateData = {
      credentialId: credentialId as string | undefined,
      clientId: queryClientId as string | undefined,
      clientSecret: queryClientSecret as string | undefined,
      credentialName: credentialName as string | undefined,
      credentialType: finalCredentialType,
      userId: req.user!.id,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    // Build authorization URL with all required parameters
    const authUrl = new URL(GOOGLE_OAUTH_CONFIG.authorizationUrl);
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
      },
    });
  })
);

/**
 * POST /api/oauth/google/callback
 * Exchange authorization code for access token
 * Now handles both new and existing credentials
 */
router.post(
  "/google/callback",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, state } = req.body;

    if (!code || !state) {
      throw new AppError("Authorization code and state are required", 400);
    }

    // Decode state to get credential info
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch (error) {
      throw new AppError("Invalid state parameter", 400);
    }

    const { credentialId, clientId, clientSecret, credentialName, credentialType, userId } =
      stateData;

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

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"
      }/oauth/callback`;

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await axios.post(
        GOOGLE_OAUTH_CONFIG.tokenUrl,
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
          },
        }
      );

      const { access_token, refresh_token, expires_in, token_type } =
        tokenResponse.data;

      let finalCredential;

      try {
        if (isNewCredential) {
          // Create new credential with all data including tokens
          let defaultName = `Google OAuth2 - ${new Date().toLocaleDateString()}`;
          if (credentialType === "googleDriveOAuth2") {
            defaultName = `Google Drive OAuth2 - ${new Date().toLocaleDateString()}`;
          } else if (credentialType === "googleSheetsOAuth2") {
            defaultName = `Google Sheets OAuth2 - ${new Date().toLocaleDateString()}`;
          }

          finalCredential = await getCredentialService().createCredential(
            req.user!.id,
            credentialName || defaultName,
            credentialType || "googleOAuth2",
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
        // Re-throw credential errors as-is (e.g., duplicate name, validation errors)
        throw credentialError;
      }

      res.json({
        success: true,
        data: {
          message: "Successfully authenticated with Google",
          credential: finalCredential,
          expiresIn: expires_in,
        },
      });
    } catch (error: any) {
      console.error("OAuth callback error:", error);

      // If it's an axios error (from token exchange), format it appropriately
      if (error.response?.data) {
        throw new AppError(
          `Failed to exchange authorization code: ${error.response.data.error_description ||
          error.response.data.error ||
          error.message
          }`,
          400
        );
      }

      // For other errors (like AppError from credential service), re-throw as-is
      throw error;
    }
  })
);

/**
 * POST /api/oauth/google/refresh
 * Refresh an expired access token
 */
router.post(
  "/google/refresh",
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { credentialId } = req.body;

    if (!credentialId) {
      throw new AppError("Credential ID is required", 400);
    }

    // Get credential
    const credential = await getCredentialService().getCredential(
      credentialId,
      req.user!.id
    );

    if (!credential) {
      throw new AppError("Credential not found", 404);
    }

    const { clientId, clientSecret, refreshToken } = credential.data;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new AppError(
        "Client ID, Client Secret, and Refresh Token are required",
        400
      );
    }

    try {
      // Refresh the access token
      const tokenResponse = await axios.post(
        GOOGLE_OAUTH_CONFIG.tokenUrl,
        {
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, expires_in, token_type } = tokenResponse.data;

      // Update credential with new access token
      const updatedCredential = await getCredentialService().updateCredential(
        credentialId,
        req.user!.id,
        {
          data: {
            ...credential.data,
            accessToken: access_token,
            tokenType: token_type,
            expiresIn: expires_in,
            tokenObtainedAt: new Date().toISOString(),
          },
        }
      );

      res.json({
        success: true,
        data: {
          message: "Token refreshed successfully",
          credentialId: updatedCredential.id,
          expiresIn: expires_in,
        },
      });
    } catch (error: any) {
      console.error(
        "OAuth token refresh error:",
        error.response?.data || error.message
      );
      throw new AppError(
        `Failed to refresh token: ${error.response?.data?.error_description || error.message
        }`,
        400
      );
    }
  })
);

/**
 * GET /api/oauth/google/status/:credentialId
 * Check the OAuth2 token status
 */
router.get(
  "/google/status/:credentialId",
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
