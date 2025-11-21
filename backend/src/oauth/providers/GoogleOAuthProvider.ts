import axios from "axios"
import { OAuthProvider } from "../OAuthProviderRegistry"

export const GoogleOAuthProvider: OAuthProvider = {
  name: "google",
  displayName: "Google",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userInfoEndpoint: "https://www.googleapis.com/oauth2/v2/userinfo",
  scopes: [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  icon: "🔵",
  color: "#4285F4",

  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: (scopes || this.scopes).join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    })
    return `${this.authorizationEndpoint}?${params.toString()}`
  },

  async exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
    const response = await axios.post(this.tokenEndpoint, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
    }
  },

  async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    const response = await axios.post(this.tokenEndpoint, {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
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
        message: `Connected as ${response.data.email}`,
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
