/**
 * OAuth Provider Registry
 * 
 * Centralized registry for OAuth providers (Google, Microsoft, GitHub, etc.)
 * Each provider defines its own authorization flow, token exchange, and testing logic
 */

export interface OAuthProvider {
  name: string
  displayName: string
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint?: string
  scopes: string[]
  scopeSeparator?: string // Default: ' '
  icon?: string
  color?: string
  
  /**
   * Build authorization URL
   */
  getAuthorizationUrl(params: {
    clientId: string
    redirectUri: string
    state: string
    scopes?: string[]
  }): string
  
  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(params: {
    code: string
    clientId: string
    clientSecret: string
    redirectUri: string
  }): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    tokenType?: string
  }>
  
  /**
   * Refresh access token
   */
  refreshAccessToken?(params: {
    refreshToken: string
    clientId: string
    clientSecret: string
  }): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
  }>
  
  /**
   * Test the connection
   */
  testConnection?(params: {
    accessToken: string
    clientId: string
    clientSecret: string
  }): Promise<{
    success: boolean
    message: string
    userInfo?: any
  }>
}

class OAuthProviderRegistry {
  private providers: Map<string, OAuthProvider> = new Map()

  /**
   * Register an OAuth provider
   */
  register(provider: OAuthProvider): void {
    this.providers.set(provider.name, provider)
  }

  /**
   * Get a provider by name
   */
  get(name: string): OAuthProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * Get all registered providers
   */
  getAll(): OAuthProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Check if a provider exists
   */
  has(name: string): boolean {
    return this.providers.has(name)
  }
}

export const oauthProviderRegistry = new OAuthProviderRegistry()
