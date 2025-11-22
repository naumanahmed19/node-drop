/**
 * OAuth Provider Registration
 * 
 * Import and register all OAuth providers here.
 * This file should be imported during app initialization.
 */

import { oauthProviderRegistry } from "./OAuthProviderRegistry"
import { GoogleOAuthProvider } from "./providers/GoogleOAuthProvider"
import { MicrosoftOAuthProvider } from "./providers/MicrosoftOAuthProvider"
import { GitHubOAuthProvider } from "./providers/GitHubOAuthProvider"

/**
 * Initialize all OAuth providers
 * Call this during application startup
 */
export function initializeOAuthProviders(): void {
  // Register core OAuth providers
  oauthProviderRegistry.register(GoogleOAuthProvider)
  oauthProviderRegistry.register(MicrosoftOAuthProvider)
  oauthProviderRegistry.register(GitHubOAuthProvider)

  // Note: Slack OAuth provider is now provided by the Slack custom node package
  // Custom nodes can register their own OAuth providers dynamically

  // Add more core providers here as needed:
  // oauthProviderRegistry.register(FacebookOAuthProvider)
  // oauthProviderRegistry.register(LinkedInOAuthProvider)
  // oauthProviderRegistry.register(DiscordOAuthProvider)
  // etc.
}

// Export registry for use in routes
export { oauthProviderRegistry } from "./OAuthProviderRegistry"
export type { OAuthProvider } from "./OAuthProviderRegistry"
