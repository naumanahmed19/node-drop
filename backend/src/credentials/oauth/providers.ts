/**
 * OAuth Provider Registry
 * Centralized configuration for all OAuth providers
 */

export interface OAuthProviderConfig {
  id: string;
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: Record<string, string[]>; // service -> scopes mapping
  useBasicAuth: boolean; // For token refresh
  supportsRefreshTokenRotation: boolean;
  additionalHeaders?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: {
      // Service-specific scopes
      'gmail': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/gmail.compose',
      ],
      'google-drive': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
      'google-sheets': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
      'google-calendar': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      // Service combinations
      'gmail-drive': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
      'gmail-sheets': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
      'drive-sheets': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
      'all': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
      ],
      // Backward compatibility - default to 'all' if no service specified
      'googleOAuth2': [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
      ],
      // Legacy credentials (backward compatibility)
      'googleSheetsOAuth2': [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
      'googleDriveOAuth2': [
        'https://www.googleapis.com/auth/drive',
      ],
    },
    useBasicAuth: false,
    supportsRefreshTokenRotation: false,
  },
  
  github: {
    id: 'github',
    name: 'GitHub',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: {
      'github': ['repo', 'user:email', 'read:user', 'workflow'],
    },
    useBasicAuth: false,
    supportsRefreshTokenRotation: false,
    additionalHeaders: { 'Accept': 'application/json' },
  },

  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: {
      'outlook': [
        'openid',
        'profile',
        'email',
        'Mail.ReadWrite',
        'Mail.Read',
        'Mail.Send',
        'offline_access',
      ],
      'onedrive': [
        'openid',
        'profile',
        'email',
        'Files.Read',
        'Files.ReadWrite',
        'offline_access',
      ],
      'microsoft-teams': [
        'openid',
        'profile',
        'email',
        'Chat.ReadWrite',
        'Team.ReadBasic.All',
        'offline_access',
      ],
    },
    useBasicAuth: false,
    supportsRefreshTokenRotation: false,
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: {
      'slack': [
        'channels:read',
        'channels:history',
        'chat:write',
        'chat:write.public',
        'users:read',
        'files:write',
      ],
    },
    useBasicAuth: false,
    supportsRefreshTokenRotation: true,
  },
};

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[provider] || null;
}

/**
 * Get scopes for a service
 */
export function getScopesForService(provider: string, serviceId: string): string[] {
  const config = getProviderConfig(provider);
  if (!config) return [];
  
  return config.scopes[serviceId] || config.scopes[provider] || [];
}

/**
 * Check if provider supports a service
 */
export function supportsService(provider: string, serviceId: string): boolean {
  const config = getProviderConfig(provider);
  if (!config) return false;
  
  return serviceId in config.scopes;
}
