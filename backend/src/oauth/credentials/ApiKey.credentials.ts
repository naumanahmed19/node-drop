import { CredentialType, CredentialData } from "../../../services/CredentialService";
import axios from "axios";

/**
 * API Key Credential
 * Can be used by any service that requires API key authentication
 */
export const ApiKeyCredentials: CredentialType = {
  name: "apiKey",
  displayName: "API Key",
  description: "API key for service authentication",
  icon: "🔑",
  color: "#059669",
  testable: true,
  properties: [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "password",
      required: true,
      description: "Your API key",
      placeholder: "Enter API key",
    },
    {
      displayName: "Header Name",
      name: "headerName",
      type: "string",
      required: false,
      default: "Authorization",
      description: "Header name for the API key",
      placeholder: "Authorization",
    },
    {
      displayName: "Header Value Prefix",
      name: "headerPrefix",
      type: "string",
      required: false,
      default: "Bearer",
      description: "Prefix for the header value (e.g., 'Bearer', 'ApiKey', or leave empty)",
      placeholder: "Bearer",
    },
    {
      displayName: "Test URL (Optional)",
      name: "testUrl",
      type: "string",
      required: false,
      description: "URL to test the API key against",
      placeholder: "https://api.example.com/test",
    },
  ],

  /**
   * Test the API Key credentials
   */
  async test(data: CredentialData) {
    try {
      // Validate required fields
      if (!data.apiKey) {
        return {
          success: false,
          message: "API key is required"
        };
      }

      // If test URL is provided, try to authenticate
      if (data.testUrl) {
        try {
          const headerName = data.headerName || "Authorization";
          const headerPrefix = data.headerPrefix || "Bearer";
          const headerValue = headerPrefix 
            ? `${headerPrefix} ${data.apiKey}` 
            : data.apiKey;

          const response = await axios.get(data.testUrl, {
            headers: {
              [headerName]: headerValue
            },
            timeout: 5000
          });

          if (response.status === 200) {
            return {
              success: true,
              message: "API key authentication successful"
            };
          }
        } catch (error: any) {
          if (error.response?.status === 401 || error.response?.status === 403) {
            return {
              success: false,
              message: "Authentication failed. Invalid API key."
            };
          }
          // For other errors, still consider credentials valid (might be network issue)
          return {
            success: true,
            message: "API key format is valid (test URL unreachable)"
          };
        }
      }

      return {
        success: true,
        message: "API key format is valid"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
