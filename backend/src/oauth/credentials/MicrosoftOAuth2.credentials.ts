import type { CredentialType, CredentialData } from "../../services/CredentialService";

export const MicrosoftOAuth2Credentials: CredentialType = {
  name: "microsoftOAuth2",
  displayName: "Microsoft OAuth2",
  description: "OAuth2 for Microsoft services (Outlook, OneDrive, Teams, Calendar)",
  icon: "🟦",
  color: "#00A4EF",
  testable: true,
  oauthProvider: "microsoft",
  properties: [
    {
      displayName: "Services",
      name: "services",
      type: "hidden",
      default: "outlook",
    },
    {
      displayName: "Client ID",
      name: "clientId",
      type: "string",
      required: true,
      description: "Application (client) ID from Azure Portal",
      placeholder: "12345678-1234-1234-1234-123456789012",
    },
    {
      displayName: "Client Secret",
      name: "clientSecret",
      type: "password",
      required: true,
      description: "Client secret from Azure Portal",
    },
    {
      displayName: "OAuth Redirect URL",
      name: "oauthCallbackUrl",
      type: "string",
      readonly: true,
      description: "Add this to Redirect URIs in Azure App Registration",
      default: `${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth/callback`,
    },
  ],

  async test(data: CredentialData) {
    try {
      if (!data.accessToken) {
        return {
          success: true,
          message: "Complete OAuth2 authorization to test the connection."
        };
      }

      const axios = require("axios");
      const response = await axios.get("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${data.accessToken}` }
      });

      return {
        success: true,
        message: `Connected as ${response.data.userPrincipalName}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Connection failed"
      };
    }
  }
};
