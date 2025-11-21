import { CredentialType, CredentialData } from "../../services/CredentialService";

/**
 * Bearer Token Credential
 * Can be used by any service that requires Bearer token authentication
 */
export const BearerTokenCredentials: CredentialType = {
  name: "bearerToken",
  displayName: "Bearer Token",
  description: "Bearer token for HTTP Authorization header",
  icon: "🎫",
  color: "#7C3AED",
  testable: true,
  properties: [
    {
      displayName: "Bearer Token",
      name: "token",
      type: "password",
      required: true,
      description: "Bearer token for authentication",
      placeholder: "Enter bearer token",
    },
    {
      displayName: "Token Prefix",
      name: "tokenPrefix",
      type: "string",
      required: false,
      default: "Bearer",
      description: 'Prefix for the token (usually "Bearer")',
      placeholder: "Bearer",
    },
  ],

  /**
   * Test the Bearer Token credentials
   */
  async test(data: CredentialData) {
    try {
      // Validate required fields
      if (!data.token) {
        return {
          success: false,
          message: "Bearer token is required"
        };
      }

      // Basic format validation
      if (data.token.length < 10) {
        return {
          success: false,
          message: "Bearer token appears to be too short"
        };
      }

      // Check if tokenPrefix is provided and valid
      if (data.tokenPrefix && data.tokenPrefix.trim().length === 0) {
        return {
          success: false,
          message: "Token prefix cannot be empty if provided"
        };
      }

      return {
        success: true,
        message: "Bearer token credentials are valid"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
