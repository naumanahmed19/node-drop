import { CredentialType, CredentialData } from "../../../services/CredentialService";
import axios from "axios";

/**
 * HTTP Basic Authentication Credential
 * Can be used by any node that needs HTTP Basic Auth
 */
export const HttpBasicAuthCredentials: CredentialType = {
  name: "httpBasicAuth",
  displayName: "HTTP Basic Auth",
  description: "Username and password for HTTP Basic Authentication",
  icon: "🔐",
  color: "#4F46E5",
  testable: true,
  properties: [
    {
      displayName: "Username",
      name: "username",
      type: "string",
      required: true,
      description: "Username for authentication",
      placeholder: "Enter username",
    },
    {
      displayName: "Password",
      name: "password",
      type: "password",
      required: true,
      description: "Password for authentication",
      placeholder: "Enter password",
    },
    {
      displayName: "Test URL (Optional)",
      name: "testUrl",
      type: "string",
      required: false,
      description: "URL to test the credentials against",
      placeholder: "https://api.example.com/test",
    },
  ],

  /**
   * Test the HTTP Basic Auth credentials
   */
  async test(data: CredentialData) {
    try {
      // Validate required fields
      if (!data.username || !data.password) {
        return {
          success: false,
          message: "Username and password are required"
        };
      }

      // If test URL is provided, try to authenticate
      if (data.testUrl) {
        try {
          const response = await axios.get(data.testUrl, {
            auth: {
              username: data.username,
              password: data.password
            },
            timeout: 5000
          });

          if (response.status === 200) {
            return {
              success: true,
              message: "Authentication successful"
            };
          }
        } catch (error: any) {
          if (error.response?.status === 401) {
            return {
              success: false,
              message: "Authentication failed. Invalid username or password."
            };
          }
          // For other errors, still consider credentials valid (might be network issue)
          return {
            success: true,
            message: "Credentials format is valid (test URL unreachable)"
          };
        }
      }

      return {
        success: true,
        message: "Credentials format is valid"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
