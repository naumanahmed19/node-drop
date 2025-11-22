import { CredentialType, CredentialData } from "../../../services/CredentialService";

/**
 * Generic Google OAuth2 Credential
 * Can be used by Google Drive, Google Sheets, Gmail, Calendar, and other Google services
 * 
 * Default scopes include commonly used permissions:
 * - Gmail: Send, read, modify emails and manage labels
 * - Drive: Read, write, and manage files
 * - Sheets: Read and write spreadsheets
 * - Calendar: Read and write calendar events
 * - User info: Email and profile
 * 
 * Users can customize scopes in the "Scopes (Advanced)" field if they need
 * different permissions or want to limit access.
 */
export const GoogleOAuth2Credentials: CredentialType = {
  name: "googleOAuth2",
  displayName: "Google OAuth2",
  description: "OAuth2 for Google services. Select which services you need access to.",
  icon: "🔐",
  color: "#4285F4",
  testable: true,
  oauthProvider: "google", // Specifies which OAuth provider to use
  properties: [
    {
      displayName: "Services",
      name: "services",
      type: "hidden",
      default: "gmail",
    },
    {
      displayName: "Client ID",
      name: "clientId",
      type: "string",
      required: true,
      description: "OAuth2 Client ID from Google Cloud Console",
      placeholder: "123456789-abc123.apps.googleusercontent.com",
    },
    {
      displayName: "Client Secret",
      name: "clientSecret",
      type: "password",
      required: true,
      description: "OAuth2 Client Secret from Google Cloud Console",
      placeholder: "GOCSPX-***",
    },

      {
      displayName: "OAuth Redirect URL",
      name: "oauthCallbackUrl",
      type: "string",
      readonly: true,
      description:
        "Copy this URL and add it to 'Authorized redirect URIs' in your Google Cloud Console OAuth2 credentials",
      placeholder: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/oauth/callback`,
      default: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/oauth/callback`,
    },
    {
      displayName: "Use Custom Scopes",
      name: "useCustomScopes",
      type: "boolean",
      default: false,
  
    },
    {
      displayName: "Custom Scopes",
      name: "customScopes",
      type: "string",
      placeholder: "https://www.googleapis.com/auth/gmail.readonly, https://www.googleapis.com/auth/drive.readonly",
      description: "Comma-separated list of OAuth scopes",
      displayOptions: {
        show: {
          useCustomScopes: [true],
        },
      },
    },
  
    // Note: accessToken and refreshToken are stored in the credential
    // but not shown in the form - they're automatically filled via OAuth
  ],

  /**
   * Test the Google OAuth2 connection
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

      // For OAuth2 testing, we need the access token
      if (!data.accessToken) {
        // If no access token yet, just validate the format of client ID and secret
        if (data.clientId.length < 10 || data.clientSecret.length < 10) {
          return {
            success: false,
            message: "Client ID or Client Secret appears to be invalid"
          };
        }
        return {
          success: true,
          message: "Credentials format is valid. Complete OAuth2 authorization to test the connection."
        };
      }

      // Dynamically import googleapis to avoid dependency issues
      const { google } = require("googleapis");

      // Create OAuth2 auth
      const auth = new google.auth.OAuth2(
        data.clientId,
        data.clientSecret
      );
      
      auth.setCredentials({
        access_token: data.accessToken,
        refresh_token: data.refreshToken
      });

      // Test the connection by getting user info
      const oauth2 = google.oauth2({ version: "v2", auth });
      const response = await oauth2.userinfo.get();

      if (response.data && response.data.email) {
        return {
          success: true,
          message: `Connected successfully as ${response.data.email}`
        };
      }

      return {
        success: true,
        message: "Connection successful"
      };
    } catch (error: any) {
      // Handle specific Google API errors
      if (error.code === 401) {
        return {
          success: false,
          message: "Authentication failed. Please re-authorize with Google."
        };
      } else if (error.code === 403) {
        return {
          success: false,
          message: "Access denied. Please check your API permissions and scopes."
        };
      } else if (error.message && error.message.includes("invalid_grant")) {
        return {
          success: false,
          message: "Invalid grant. Please re-authorize with Google."
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${error.message || "Unknown error"}`
        };
      }
    }
  }
};
