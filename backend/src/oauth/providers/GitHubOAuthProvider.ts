import axios from "axios"
import { OAuthProvider } from "../OAuthProviderRegistry"

export const GitHubOAuthProvider: OAuthProvider = {
  name: "github",
  displayName: "GitHub",
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  userInfoEndpoint: "https://api.github.com/user",
  scopes: ["user", "repo"],
  icon: "⚫",
  color: "#24292e",

  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: (scopes || this.scopes).join(" "),
      state,
    })
    return `${this.authorizationEndpoint}?${params.toString()}`
  },

  async exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
    const response = await axios.post(
      this.tokenEndpoint,
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    )

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
    }
  },

  async testConnection({ accessToken }) {
    try {
      const response = await axios.get(this.userInfoEndpoint!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      return {
        success: true,
        message: `Connected as ${response.data.login}`,
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
