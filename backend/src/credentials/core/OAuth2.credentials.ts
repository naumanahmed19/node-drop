import { CredentialType, CredentialData } from "../services/CredentialService";
import axios from "axios";

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

      // For OAuth2 testing, we need the access token
      if (!data.accessToken) {
        return {
          success: false,
          message: "Please complete OAuth2 authorization first"
        };
      }

      return {
        success: true,
        message: "OAuth2 credentials are configured"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
