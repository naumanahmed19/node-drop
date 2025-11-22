import axios from "axios"
import { OAuthProvider } from "../OAuthProviderRegistry"

export const MicrosoftOAuthProvider: OAuthProvider = {
  name: "microsoft",
  displayName: "Microsoft",
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  userInfoEndpoint: "https://graph.microsoft.com/v1.0/me",
  scopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
  ],
  icon: "🟦",
  color: "#00A4EF",

  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: (scopes || this.scopes).join(" "),
      state,
      response_mode: "query",
    })
    return `${this.authorizationEndpoint}?${params.toString()}`
  },

  async exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })

    const response = await axios.post(this.tokenEndpoint, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
    }
  },

  async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    })

    const response = await axios.post(this.tokenEndpoint, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in,
    }
  },

  async testConnection({ accessToken }) {
    try {
      const response = await axios.get(this.userInfoEndpoint!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      return {
        success: true,
        message: `Connected as ${response.data.userPrincipalName || response.data.mail}`,
        userInfo: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Connection test failed",
      }
    }
  },
}
