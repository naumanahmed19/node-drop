import { CredentialType, CredentialData } from "../../services/CredentialService";

/**
 * Generic OAuth2 Credential
 * Can be used by any service that supports OAuth2
 */
export const OAuth2Credentials: CredentialType = {
  name: "oauth2",
  displayName: "OAuth2",
  description: "Generic OAuth2 authentication credentials",
  icon: "🔒",
  color: "#DC2626",
  testable: true,
  properties: [
    {
      displayName: "Authorization URL",
      name: "authorizationUrl",
      type: "string",
      required: true,
      description: "OAuth2 authorization endpoint URL",
      placeholder: "https://provider.com/oauth/authorize",
    },
    {
      displayName: "Token URL",
      name: "tokenUrl",
      type: "string",
      required: true,
      description: "OAuth2 token endpoint URL",
      placeholder: "https://provider.com/oauth/token",
    },
    {
      displayName: "Client ID",
      name: "clientId",
      type: "string",
      required: true,
      description: "OAuth2 client ID",
      placeholder: "Enter client ID",
    },
    {
      displayName: "Client Secret",
      name: "clientSecret",
      type: "password",
      required: true,
      description: "OAuth2 client secret",
      placeholder: "Enter client secret",
    },
    {
      displayName: "Scopes",
      name: "scopes",
      type: "string",
      required: false,
      description: "Space-separated list of OAuth2 scopes",
      placeholder: "read write",
    },
    {
      displayName: "Access Token",
      name: "accessToken",
      type: "password",
      required: false,
      description: "OAuth2 access token (filled automatically via OAuth flow)",
      placeholder: "Access token",
    },
    {
      displayName: "Refresh Token",
      name: "refreshToken",
      type: "password",
      required: false,
      description: "OAuth2 refresh token (filled automatically via OAuth flow)",
      placeholder: "Refresh token",
    },
  ],

  /**
   * Test the OAuth2 credentials
   */
  async test(data: CredentialData) {
    try {
      // Validate required fields
      if (!data.clientId || !data.clientSecret) {
        return {
          success: false,
          message: "Client ID and client secret are required"
        };
      }

      if (!data.authorizationUrl || !data.tokenUrl) {
        return {
          success: false,
          message: "Authorization URL and token URL are required"
        };
      }

      // Check if access token is present
      if (!data.accessToken) {
        return {
          success: false,
          message: "No access token found. Please complete the OAuth2 authorization flow."
        };
      }

      // Check if token is expired (if tokenObtainedAt and expiresIn are available)
      if (data.tokenObtainedAt && data.expiresIn) {
        const obtainedDate = new Date(data.tokenObtainedAt);
        const expiresAt = new Date(
          obtainedDate.getTime() + data.expiresIn * 1000
        );

        if (new Date() > expiresAt) {
          if (!data.refreshToken) {
            return {
              success: false,
              message: "Access token has expired and no refresh token is available. Please re-authorize."
            };
          }
          return {
            success: false,
            message: "Access token has expired. Please refresh the token."
          };
        }
      }

      return {
        success: true,
        message: "OAuth2 credentials are configured correctly"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
